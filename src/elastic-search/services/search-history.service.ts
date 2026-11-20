import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, SearchHistoryType } from '@prisma/client';
import { OrderType } from 'src/common/dto/query.dto';
import { buildPrismaProductTextSearchFilter } from 'src/common/utils/search.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchHistoryQueryDto } from '../dto/search-history-query.dto';
import { RedisService } from 'src/redis/redis.service';

const MAX_HISTORY_ENTRIES = 100;
const DUPLICATE_VIEW_WINDOW_MS = 60 * 60 * 1000;

export interface SearchHistoryInput {
  customerId?: string | null;
  query: string;
  categoryId?: string | null;
}

export interface ViewProductInput extends SearchHistoryInput {
  productId?: string;
}

@Injectable()
export class SearchHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async recordSearch(input: SearchHistoryInput) {
    const query = this.normalizeQuery(input.query);

    if (!query) {
      throw new BadRequestException('Search query is required');
    }

    const history = await this.prisma.searchHistory.create({
      data: {
        customerId: input.customerId ?? null,
        query,
        categoryId: input.categoryId ?? null,
        type: SearchHistoryType.SEARCH,
      },
    });

    await this.pruneCustomerHistory(input.customerId ?? null);

    if (input.customerId) {
      try {
        await this.redisService.clearCacheByPrefix(`customer:search-history:${input.customerId}`);
        await this.redisService.clearCacheByPrefix(`customer:search-recommendations:${input.customerId}`);
      } catch (err) {
        // Ignore cache clear error
      }
    }

    return history;
  }

  async getListByCustomerId(query: SearchHistoryQueryDto) {
    const { customerId, limit } = query;
    const cacheKey = `customer:search-history:${customerId || 'unknown'}:limit=${limit || ''}`;

    if (customerId) {
      try {
        const cached = await this.redisService.get<any>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (err) {
        // Fallback to database
      }
    }

    const history = await this.prisma.searchHistory.findMany({
      where: {
        customerId,
      },
      take: limit ? Number(limit) : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            variants: {
              where: { isActive: true },
              include: {
                attributes: {
                  include: {
                    attributeValue: {
                      include: {
                        attributeName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = history.map((item) => {
      if (!item.product) {
        return {
          ...item,
          query: item.query ? item.query : '',
        };
      }

      const productInfo = {
        id: item.product.id,
        name: item.product.name,
        variants: item.product.variants.map((v) => {
          const variantObj: any = {
            id: v.id,
            title: v.attributeSummary,
          };
          if (v.attributes) {
            for (const attr of v.attributes) {
              const name = attr.attributeValue?.attributeName?.title;
              const value = attr.attributeValue?.title;
              if (name && value) {
                variantObj[name] = value;
              }
            }
          }
          return variantObj;
        }),
      };

      const { product, ...rest } = item;
      return {
        ...rest,
        query: item.query ? item.query : (productInfo.name || ''),
        product: productInfo,
      };
    });

    if (customerId) {
      try {
        await this.redisService.set(cacheKey, result, 300);
      } catch (err) {
        // Ignore cache write error
      }
    }

    return result;
  }
  async recordView(input: ViewProductInput) {
    const query = this.normalizeQuery(input.query || '');

    if (!input.productId) {
      throw new BadRequestException('Product ID is required');
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: input.productId,
        status: ProductStatus.ACTIVE,
        visibility: true,
      },
      select: {
        id: true,
        categoryId: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const customerId = input.customerId ?? null;

    if (customerId) {
      const duplicate = await this.prisma.searchHistory.findFirst({
        where: {
          customerId,
          productId: input.productId,
          type: SearchHistoryType.VIEW,
          createdAt: {
            gte: new Date(Date.now() - DUPLICATE_VIEW_WINDOW_MS),
          },
        },
        orderBy: { createdAt: OrderType.DESC },
      });

      if (duplicate) {
        return duplicate;
      }
    }

    const history = await this.prisma.$transaction(async (tx) => {
      const created = await tx.searchHistory.create({
        data: {
          customerId,
          query,
          categoryId: input.categoryId ?? product.categoryId ?? null,
          productId: input.productId,
          type: SearchHistoryType.VIEW,
        },
      });

      await tx.product.update({
        where: { id: input.productId },
        data: {
          viewCount: {
            increment: 1,
          },
        },
      });

      return created;
    });

    await this.pruneCustomerHistory(customerId);

    if (customerId) {
      try {
        await this.redisService.clearCacheByPrefix(`customer:search-history:${customerId}`);
        await this.redisService.clearCacheByPrefix(`customer:search-recommendations:${customerId}`);
      } catch (err) {
        // Ignore cache clear error
      }
    }

    return history;
  }

  async recommended(customerId?: string | null, limit = 12): Promise<any[]> {
    const normalizedLimit = this.normalizeLimit(limit);
    const cacheKey = `customer:search-recommendations:${customerId || 'guest'}:limit=${normalizedLimit}`;

    try {
      const cached = await this.redisService.get<any[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (err) {
      // Fallback to database
    }

    const history = customerId
      ? await this.prisma.searchHistory.findMany({
          where: {
            customerId,
          },
          orderBy: {
            createdAt: OrderType.DESC,
          },
          take: MAX_HISTORY_ENTRIES,
        })
      : [];

    const searchTerms = this.uniqueTerms(
      history
        .filter((item) => item.type === SearchHistoryType.SEARCH)
        .map((item) => item.query),
    );
    const categoryIds = this.uniqueTerms(
      history
        .filter((item) => item.categoryId)
        .map((item) => item.categoryId as string),
    );
    const viewedProductIds = this.uniqueTerms(
      history
        .filter(
          (item) => item.type === SearchHistoryType.VIEW && item.productId,
        )
        .map((item) => item.productId as string),
    );

    const personalizedWhere: Prisma.ProductWhereInput[] = [
      {
        status: ProductStatus.ACTIVE,
        visibility: true,
      },
    ];

    const searchClauses: any[] = [];

    if (searchTerms.length > 0) {
      searchClauses.push({
        OR: searchTerms.map((term) => ({
          ...(buildPrismaProductTextSearchFilter(term) as any),
        })),
      });
    }

    if (categoryIds.length > 0) {
      searchClauses.push({ categoryId: { in: categoryIds } });
    }

    if (searchClauses.length > 0) {
      personalizedWhere.push({ OR: searchClauses });
    }

    if (viewedProductIds.length > 0) {
      personalizedWhere.push({ id: { notIn: viewedProductIds } });
    }

    const candidates = await this.prisma.product.findMany({
      where:
        personalizedWhere.length > 1
          ? { AND: personalizedWhere }
          : personalizedWhere[0],
      include: {
        category: true,
        brandRef: true,
        seo: true,
      },
      take: normalizedLimit * 4,
      orderBy: [
        { viewCount: 'desc' },
        { reviewCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const personalized = await this.rankProducts(candidates);

    if (personalized.length >= normalizedLimit) {
      return personalized.slice(0, normalizedLimit);
    }

    const remainingLimit = normalizedLimit - personalized.length;
    const existingIds = personalized.map((product) => product.id);

    const trending = await this.prisma.product.findMany({
      where: {
        AND: [
          {
            status: ProductStatus.ACTIVE,
            visibility: true,
          },
          existingIds.length > 0 ? { id: { notIn: existingIds } } : {},
          viewedProductIds.length > 0
            ? { id: { notIn: viewedProductIds } }
            : {},
        ],
      },
      include: {
        category: true,
        brandRef: true,
        seo: true,
      },
      take: remainingLimit,
      orderBy: [
        { viewCount: 'desc' },
        { reviewCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const result = [
      ...personalized,
      ...trending.map((product) => this.mapProduct(product)),
    ].slice(0, normalizedLimit);

    try {
      await this.redisService.set(cacheKey, result, 300);
    } catch (err) {
      // Ignore cache write error
    }

    return result;
  }

  async remove(id: string, customerId: string) {
    const history = await this.prisma.searchHistory.findUnique({
      where: { id },
    });

    if (!history) {
      throw new NotFoundException(
        `Search history record not found or does not belong to the customer`,
      );
    }

    if (history.customerId !== customerId) {
      throw new NotFoundException(
        `Search history record not found or does not belong to the customer ${history.customerId}-${customerId}`,
      );
    }

    const deleted = await this.prisma.searchHistory.delete({
      where: { id },
    });

    if (customerId) {
      try {
        await this.redisService.clearCacheByPrefix(`customer:search-history:${customerId}`);
        await this.redisService.clearCacheByPrefix(`customer:search-recommendations:${customerId}`);
      } catch (err) {
        // Ignore cache clear error
      }
    }

    return deleted;
  }

  async clearAllCustomerHistory(customerId: string) {
    if (!customerId) {
      throw new BadRequestException('Customer ID is required');
    }

    const result = await this.prisma.searchHistory.deleteMany({
      where: { customerId },
    });

    try {
      await this.redisService.clearCacheByPrefix(`customer:search-history:${customerId}`);
      await this.redisService.clearCacheByPrefix(`customer:search-recommendations:${customerId}`);
    } catch (err) {
      // Ignore cache clear error
    }

    return result;
  }

  private async rankProducts(products: any[]) {
    const ids = products.map((product) => product.id);

    if (ids.length === 0) {
      return [];
    }

    const soldCounts = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: ids },
      },
      _sum: {
        quantity: true,
      },
    });

    const soldMap = new Map(
      soldCounts.map((row) => [row.productId, row._sum.quantity ?? 0]),
    );

    return products
      .map((product) => ({
        ...this.mapProduct(product),
        soldCount: soldMap.get(product.id) ?? 0,
      }))
      .sort((left, right) => {
        const viewDiff = (right.viewCount ?? 0) - (left.viewCount ?? 0);
        if (viewDiff !== 0) {
          return viewDiff;
        }

        const soldDiff = (right.soldCount ?? 0) - (left.soldCount ?? 0);
        if (soldDiff !== 0) {
          return soldDiff;
        }

        return (
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
        );
      });
  }

  private mapProduct(product: any) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      mrpPrice: product.mrpPrice,
      viewCount: product.viewCount,
      reviewCount: product.reviewCount,
      ratingAvg: product.ratingAvg,
      imageUrl: product.imageUrl,
      imageUrls: product.imageUrls,
      category: product.category,
      brandRef: product.brandRef,
      seo: product.seo,
      createdAt: product.createdAt,
    };
  }

  private async pruneCustomerHistory(customerId: string | null) {
    if (!customerId) {
      return;
    }

    const count = await this.prisma.searchHistory.count({
      where: {
        customerId,
      },
    });

    if (count <= MAX_HISTORY_ENTRIES) {
      return;
    }

    const excess = count - MAX_HISTORY_ENTRIES;

    const oldest = await this.prisma.searchHistory.findMany({
      where: {
        customerId,
      },
      orderBy: {
        createdAt: OrderType.ASC,
      },
      take: excess,
      select: {
        id: true,
      },
    });

    if (oldest.length > 0) {
      await this.prisma.searchHistory.deleteMany({
        where: {
          id: {
            in: oldest.map((row) => row.id),
          },
        },
      });
    }
  }

  private normalizeQuery(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit < 1) {
      return 12;
    }

    return Math.min(Math.floor(limit), 24);
  }

  private uniqueTerms(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }
}
