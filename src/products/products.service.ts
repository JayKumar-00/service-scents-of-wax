import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { subtreeCategoryIds, subtreeCategoryIdsById } from './catalog-helpers';
import { RedisService } from 'src/redis/redis.service';
import { IAttributeValue } from './attributes/attributes.service';
import {
  CreateVariantDto,
  VariantAttributeDto,
} from './product-controllers/dto/create-product-variant.dto';
import { CreateProductDto as NewProduct } from './product-controllers/dto/create-product.dto';
import { generateSlug } from 'src/common/utils/generate-slug-sku.util';
import { generateSearchText } from './utils/generate-search-text.util';
import { ConfigService } from '@nestjs/config';
import { ProductQueryDto } from './product-controllers/dto/product-query.dto';
import { buildPrismaProductTextSearchFilter } from 'src/common/utils/search.util';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { OrderType } from 'src/common/dto/query.dto';
import {
  DeleteBulkProductsDto,
  ProductStatusDto,
  ProductVisibilityDto,
  UpdateProductDto,
} from './product-controllers/dto/update-product.dto';
import {
  buildPrismaDateRangeFilter,
  buildPrismaPriceRangeFilter,
  buildPrismaRatingRangeFilter,
} from './utils/range-filter.util';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { UpdateProductVariantDto } from './product-controllers/dto/update-product-variant.dto';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { randomUUID } from 'crypto';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { NotificationType } from 'src/notification/enums/notification-type.enum';

export type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  children: CategoryTreeNode[];
};

export type CatalogListParams = {
  page: number;
  pageSize: number;
  categorySlug?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  brands?: string[];
  occasions?: string[];
  minRating?: number;
  inStock?: boolean;
  fastDelivery?: boolean;
  /** true = featured only, false = exclude featured, undefined = any */
  featuredOnly?: boolean;
  sort:
  | 'relevance'
  | 'featured'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'rating_desc'
  | 'bestseller';
};

const categoryIncludeBreadcrumb = {
  include: {
    parent: {
      include: {
        parent: {
          include: { parent: true },
        },
      },
    },
  },
} as const;

@Injectable()
export class ProductsService {
  private readonly BASE_CHACHE = `product`; // seconds

  private getDisplayStock(p: any) {
    let baseStock = 0;
    if (Array.isArray(p?.variants) && p.variants.length > 0) {
      baseStock = p.variants
        .filter((variant: any) => variant?.isActive !== false)
        .reduce((sum: number, variant: any) => sum + (variant?.stock || 0), 0);
    } else {
      baseStock = p?.stock ?? 0;
    }

    const warehouseStockQty = p?.warehouseStocks?.quantity ?? baseStock;

    return warehouseStockQty;
  }

  private buildVariantTitle(variant: any) {
    const titles = Array.isArray(variant?.attributes)
      ? variant.attributes
        .map((attr: any) => attr?.attributeValue?.title?.trim())
        .filter((title: string | undefined): title is string =>
          Boolean(title),
        )
      : [];

    if (titles.length > 0) {
      return titles.join(' / ').toUpperCase();
    }

    if (
      typeof variant?.attributeSummary === 'string' &&
      variant.attributeSummary
    ) {
      return variant.attributeSummary.toUpperCase();
    }

    return null;
  }

  private mapVariantResponse(variant: any) {
    if (!variant) return variant;
    return {
      ...variant,
      title: this.buildVariantTitle(variant),
    };
  }

  private mapProductResponse(p: any) {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      features: p.features,
      description: p.description,
      stock: this.getDisplayStock(p),
      basePrice: p.basePrice,
      price: p.price,
      wholesalePrice: p.wholesalePrice,
      mrpPrice: p.mrpPrice,
      gstTax: p.gstTax,

      status: p.status,
      visibility: p.visibility,
      fastDelivery: p.fastDelivery,
      featuredOnly: p.featuredOnly,
      isFeatured: p.isFeatured,

      category: p.category
        ? {
          id: p.category.id,
          name: p.category.name,
          slug: p.category.slug,
        }
        : null,

      brand: p.brandRef
        ? {
          id: p.brandRef.id,
          name: p.brandRef.name,
          description: p.brandRef.description,
        }
        : null,

      ratingAvg: p.ratingAvg,

      variants: Array.isArray(p.variants)
        ? p.variants.map((variant: any) => this.mapVariantResponse(variant))
        : p.variants,
      seo: p.seo,

      franchiseStocks: p.franchiseStocks,
      hubInventories: p.hubInventories,
      replenPolicies: p.replenPolicies,
      warehouseStocks: p.warehouseStocks,

      imageUrls: p.imageUrls,
      // images: {
      //   // primary: p.imageUrl,
      // },

      createdAt: p.createdAt,
    };
  }

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,

    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roleBasedNotificationService: RoleBasedNotificationService,
  ) { }

  private awsPrefix = this.configService
    .get<string>('AWS_PREFIX_URL')
    ?.replace(/\/$/, '');

  private applyAwsPrefixToUrl(url?: string | null) {
    if (!url) return url;
    if (!this.awsPrefix) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `${this.awsPrefix}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private applyAwsPrefixToProduct<T extends Record<string, any>>(p: T): T {
    if (!p) return p;
    const copy = { ...p } as any;
    copy.imageUrl = this.applyAwsPrefixToUrl(copy.imageUrl);
    if (Array.isArray(copy.imageUrls)) {
      copy.imageUrls = copy.imageUrls.map((u: string) =>
        this.applyAwsPrefixToUrl(u),
      );
    }
    if (Array.isArray(copy.variants)) {
      copy.variants = copy.variants.map((variant: any) => {
        const variantCopy = { ...variant };
        variantCopy.imageUrl = this.applyAwsPrefixToUrl(variantCopy.imageUrl);
        if (Array.isArray(variantCopy.imageUrls)) {
          variantCopy.imageUrls = variantCopy.imageUrls.map((u: string) =>
            this.applyAwsPrefixToUrl(u),
          );
        }
        return variantCopy;
      });
    }
    return copy;
  }

  private generateSummary(attrs: VariantAttributeDto[]) {
    return attrs
      .sort((a, b) => a.attributeNameId.localeCompare(b.attributeNameId))
      .map((a) => `${a.attributeNameId}:${a.attributeValueId}`)
      .join('|');
  }

  private generateSKU(name: string, attrs: VariantAttributeDto[]) {
    const base = name.slice(0, 4).toUpperCase();
    const suffix = attrs.map((a) => a.attributeValueId.slice(-4)).join('-');
    return `${base}-${suffix}-${randomUUID()}`;
  }

  private async prepareVariants(
    productName: string,
    variants: CreateVariantDto[],
  ) {
    const allIds = variants.flatMap((v) =>
      v.attributes.map((a) => a.attributeValueId),
    );

    const values = await this.prisma.attributeValue.findMany({
      where: { id: { in: allIds } },
    });

    const summarySet = new Set();

    return variants.map((v) => {
      // Validation
      for (const attr of v.attributes) {
        const val = values.find(
          (x: IAttributeValue) => x.id === attr.attributeValueId,
        );

        if (!val || val.attributeNameId !== attr.attributeNameId) {
          throw new BadRequestException(
            `Invalid attribute mapping ${attr.attributeNameId}:${attr.attributeValueId}`,
          );
        }
      }

      const summary = this.generateSummary(v.attributes);

      if (summarySet.has(summary)) {
        throw new BadRequestException('Duplicate variant');
      }

      summarySet.add(summary);

      return {
        sku: v.sku
          ? (v.sku as string)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with "-"
            .replace(/-+/g, '-') // collapse multiple "-"
            .replace(/^-+|-+$/g, '') // trim leading/trailing "-"
          : this.generateSKU(productName, v.attributes),
        basePrice: v.basePrice,
        price: v.price,
        mrpPrice: v.mrpPrice,
        wholesalePrice: v.wholesalePrice,
        stock: v.stock || 0,
        gstTax: v.gstTax ?? 18,
        imageUrl: v.imageUrl,
        imageUrls: v.imageUrls,
        attributeSummary: summary,
        searchText: generateSearchText(
          productName,
          Object.fromEntries(
            values.map((v: any, i) => [i.toString(), v.title]),
          ) as Record<string, string>,
        ),
        attributes: {
          create: v.attributes.map((attr) => ({
            attributeValue: { connect: { id: attr.attributeValueId } },
          })),
        },
      };
    });
  }

  private buildProductSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'name']);

  async create(dto: NewProduct, actor: { userId: string; ip?: string | null }) {
    const normalizedImages = (dto.imageUrls ?? [])
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    const primaryImage = dto.imageUrl?.trim() || normalizedImages[0] || null;

    const preparedVariants = dto.variants
      ? await this.prepareVariants(dto.name, dto.variants)
      : undefined;

    const baseStock =
      dto.variants?.length && dto.variants?.length > 0
        ? dto.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : (dto.stock ?? 0);

    const hasVariants = !!preparedVariants?.length;
    const variantPrices = hasVariants
      ? preparedVariants.map((v) => Number(v.price))
      : [];
    const variantMrpPrices = hasVariants
      ? preparedVariants.map((v) => Number(v.mrpPrice ?? v.price))
      : [];

    const effectivePrice = hasVariants
      ? (dto.price ??
        (variantPrices.length ? Math.min(...variantPrices) : undefined))
      : dto.price;
    const effectiveMrpPrice = hasVariants
      ? (dto.mrpPrice ??
        (variantMrpPrices.length
          ? Math.max(...variantMrpPrices)
          : effectivePrice != null
            ? effectivePrice + 100
            : undefined))
      : dto.mrpPrice;

    if (!hasVariants) {
      if (effectivePrice == null || Number.isNaN(effectivePrice)) {
        throw new BadRequestException(
          'price is required when variants are not provided',
        );
      }

      if (
        effectiveMrpPrice != null &&
        !Number.isNaN(effectiveMrpPrice) &&
        effectivePrice > effectiveMrpPrice
      ) {
        throw new BadRequestException(
          'Selling price cannot be greater than MRP',
        );
      }
    }

    const normalizedCategoryId = dto.categoryId?.trim();
    const normalizedBrandId = dto.brandId?.trim() || undefined;

    const category = await this.prisma.category.findUnique({
      where: { id: normalizedCategoryId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }

    if (normalizedBrandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: normalizedBrandId },
        select: { id: true },
      });
      if (!brand) {
        throw new BadRequestException('Brand not found');
      }
    }

    const row = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug
          ? dto.slug
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with "-"
            .replace(/-+/g, '-') // collapse multiple "-"
            .replace(/^-+|-+$/g, '') // trim leading/trailing "-"
          : generateSlug(dto.name),
        description: dto.description,
        features: dto.features,
        stock: baseStock,
        gstTax:
          dto.variants?.length && dto.variants?.length > 0
            ? undefined
            : (dto.gstTax ?? 18),
        categoryId: normalizedCategoryId,
        brandId: normalizedBrandId,
        basePrice:
          dto.basePrice != null && !dto.variants?.length
            ? new Prisma.Decimal(dto.basePrice)
            : 0,
        price:
          dto.price != null && !dto.variants?.length
            ? new Prisma.Decimal(effectivePrice)
            : 0,
        wholesalePrice:
          dto.wholesalePrice != null && !dto.variants?.length
            ? new Prisma.Decimal(dto.wholesalePrice)
            : undefined,
        mrpPrice:
          effectiveMrpPrice != null && !dto.variants?.length
            ? new Prisma.Decimal(effectiveMrpPrice)
            : undefined,
        seo: dto.seo
          ? {
            create: {
              title: dto.seo.title,
              keywords: dto.seo.keywords,
              tags: dto.seo.tags || [],
            },
          }
          : undefined,
        variants: preparedVariants
          ? {
            create: preparedVariants,
          }
          : undefined,
        explicitAttributes: dto.explicitAttributes
          ? instanceToPlain(dto.explicitAttributes)
          : [],
        imageUrl: primaryImage,
        imageUrls: normalizedImages,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        basePrice: true,
        wholesalePrice: true,
        price: true,
        mrpPrice: true,
        gstTax: true,
        stock: true,
        visibility: true,

        category: {
          select: {
            id: true,
            name: true,
          },
        },

        brandRef: {
          select: {
            id: true,
            name: true,
          },
        },

        variants: true,
        seo: true,
        imageUrl: false,
        imageUrls: true,
        createdAt: true,
      },
    });

    await this.prisma.warehouseStock.upsert({
      where: { productId: row.id },
      create: { productId: row.id, quantity: baseStock || 0 },
      update: {},
    });

    await this.audit.log({
      userId: actor.userId,
      action: 'product.create',
      resource: 'Product',
      resourceId: row.id,
      metadata: { slug: row.slug, name: row.name },
      ip: actor.ip,
    });

    await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);

    if (row.visibility) {
      const productImage = this.applyAwsPrefixToUrl(primaryImage);
      void this.roleBasedNotificationService.notifyAllCustomers(
        'New Product Available',
        `A new product "${row.name}" has been published! Check it out now.`,
        NotificationType.SYSTEM,
        {
          productId: row.id,
          slug: row.slug,
          productName: row.name,
          productImage,
        },
      );
    }

    return row;
  }

  async createBulk(dtos: NewProduct[]) {
    const results: any[] = [];
    for (const dto of dtos) {
      const normalizedImages = (dto.imageUrls ?? [])
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
      const primaryImage = dto.imageUrl?.trim() || normalizedImages[0] || null;

      const preparedVariants = dto.variants
        ? await this.prepareVariants(dto.name, dto.variants)
        : undefined;

      const hasVariants = !!preparedVariants?.length;
      const baseStock =
        dto.variants?.length && dto.variants.length > 0
          ? dto.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0)
          : (dto.stock ?? 0);

      const variantPrices = hasVariants
        ? preparedVariants.map((v) => Number(v.price))
        : [];
      const variantMrpPrices = hasVariants
        ? preparedVariants.map((v) => Number(v.mrpPrice ?? v.price))
        : [];
      const effectivePrice = hasVariants
        ? (dto.price ??
          (variantPrices.length ? Math.min(...variantPrices) : undefined))
        : dto.price;
      const effectiveMrpPrice = hasVariants
        ? (dto.mrpPrice ??
          (variantMrpPrices.length
            ? Math.max(...variantMrpPrices)
            : effectivePrice != null
              ? effectivePrice + 100
              : undefined))
        : dto.mrpPrice;

      if (!hasVariants) {
        if (effectivePrice == null || Number.isNaN(effectivePrice)) {
          throw new BadRequestException(
            'price is required when variants are not provided',
          );
        }

        if (
          effectiveMrpPrice != null &&
          !Number.isNaN(effectiveMrpPrice) &&
          effectivePrice > effectiveMrpPrice
        ) {
          throw new BadRequestException(
            'Selling price cannot be greater than MRP',
          );
        }
      }

      const row = await this.prisma.product.create({
        data: {
          name: dto.name,
          slug: dto.slug
            ? dto.slug
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-+|-+$/g, '')
            : generateSlug(dto.name),
          description: dto.description,
          features: dto.features ?? [],
          categoryId: dto.categoryId,
          brandId: dto.brandId,
          price: new Prisma.Decimal(effectivePrice ?? dto.price ?? 0),
          mrpPrice:
            effectiveMrpPrice != null
              ? new Prisma.Decimal(effectiveMrpPrice)
              : effectivePrice != null
                ? new Prisma.Decimal(effectivePrice)
                : undefined,
          variants: preparedVariants ? { create: preparedVariants } : undefined,
          explicitAttributes: dto.explicitAttributes
            ? instanceToPlain(dto.explicitAttributes)
            : [],
          imageUrl: primaryImage,
          imageUrls: normalizedImages,
        },
        include: { category: true, brandRef: true, variants: true, seo: true },
      });

      await this.prisma.warehouseStock.upsert({
        where: { productId: row.id },
        create: { productId: row.id, quantity: baseStock },
        update: {},
      });

      results.push(row);
    }

    await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);

    for (const row of results) {
      if (row.visibility) {
        const firstImage = Array.isArray(row.imageUrls) && row.imageUrls.length > 0
          ? String(row.imageUrls[0])
          : (row.imageUrl || null);
        const productImage = this.applyAwsPrefixToUrl(firstImage);
        void this.roleBasedNotificationService.notifyAllCustomers(
          'New Product Available',
          `A new product "${row.name}" has been published! Check it out now.`,
          NotificationType.SYSTEM,
          {
            productId: row.id,
            slug: row.slug,
            productName: row.name,
            productImage,
          },
        );
      }
    }

    return results;
  }

  async list(query: ProductQueryDto) {
    const q: any = query ?? {};

    const clauses: Record<string, unknown>[] = [];

    const searchFilter = buildPrismaProductTextSearchFilter(q.search);

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.status !== null && query.status !== undefined) {
      clauses.push({ status: query.status });
    }

    if (query.visibility !== undefined && query.visibility !== null) {
      console.log({ visibility: !query.visibility });
      clauses.push({
        visibility: query.visibility.includes('true') ? true : false,
      });
    }

    if (query.brandId) {
      clauses.push({ brandRef: { id: q.brandId } });
    }

    if (query.categoryId || query.categorySlug) {
      const flat = await this.prisma.category.findMany({
        select: { id: true, parentId: true, slug: true },
      });

      let categoryIds: string[] | null = null;

      if (query.categoryId) {
        categoryIds = subtreeCategoryIdsById(flat, query.categoryId);
      } else if (query.categorySlug) {
        categoryIds = subtreeCategoryIds(flat, query.categorySlug);
      }

      if (categoryIds && categoryIds.length > 0) {
        clauses.push({ categoryId: { in: categoryIds } });
      } else {
        clauses.push({ id: { in: [] } });
      }
    }


    if (query.featuredOnly !== undefined && query.featuredOnly !== null) {
      clauses.push({
        isFeatured: query.featuredOnly.includes('true') ? true : false,
      });
    }

    if (query.fastDelivery !== undefined && query.fastDelivery !== null) {
      clauses.push({
        fastDelivery: query.fastDelivery.includes('true') ? true : false,
      });
    }

    if (query.minRating != null && !Number.isNaN(query.minRating)) {
      clauses.push({
        ratingAvg: { gte: new Prisma.Decimal(query.minRating) },
      });
    }

    if (query.inStock?.includes('true')) {
      clauses.push({
        OR: [
          { warehouseStocks: { is: { quantity: { gt: 0 } } } },
          { AND: [{ warehouseStocks: null }, { stock: { gt: 0 } }] },
        ],
      });
    } else if (query.inStock?.includes('false')) {
      clauses.push({
        OR: [
          { warehouseStocks: { is: { quantity: { lte: 0 } } } },
          {
            AND: [
              { warehouseStocks: null },
              { OR: [{ stock: null }, { stock: { lte: 0 } }] },
            ],
          },
        ],
      });
    }

    if (query.franchiseId) {
      clauses.push({
        franchiseStocks: { some: { franchiseId: q.franchiseId } },
      });
    }

    if (query.stockNodeId) {
      clauses.push({
        hubInventory: { some: { stockingNodeId: q.stockNodeId } },
      });
    }



    if (query.brands) {
      if (query.brands) {
        const brandList = query.brands.split(',').map((b) => b.trim());

        clauses.push({
          brandRef: {
            name: {
              in: brandList,
              mode: 'insensitive',
            },
          },
        });
      }
    }

    if (query.occasions) {
      const occasionList = query.occasions.split(',').map((o) => o.trim());

      clauses.push({
        OR: occasionList.map((o) => ({
          occasions: { contains: o, mode: 'insensitive' },
        })),
      });
    }

    if (query.minRating != null && !Number.isNaN(query.minRating)) {
      const ratingFilter = buildPrismaRatingRangeFilter({
        minRatingOrComment: query.minRating,
        maxRatingOrComment: query.maxRating,
      });

      clauses.push({ ratingAvg: ratingFilter });
    }

    if (query.minPrice || query.maxPrice) {
      const price = buildPrismaPriceRangeFilter({
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
      });

      clauses.push({ price });
    }

    if (query.fromDate || query.lastDate) {
      const createdAt = buildPrismaDateRangeFilter({
        fromDate: query.fromDate,
        toDate: query.lastDate,
      });

      clauses.push({ createdAt });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildProductSortOrder(q.sortBy, q.order);

    // const cacheKey = `${this.BASE_CHACHE}:list:page=${page}:limit=${limit}:order=${q.order ?? ''}:sortBy=${q.sortBy ?? ''}:search=${encodeURIComponent(
    //   String(q.search ?? ''),
    // )}`;

    // const cached = await this.redisService.get<any>(cacheKey);
    // if (cached) return cached;

    const paged = await paginatePrisma<any>({
      model: this.prisma.product as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        franchiseStocks: { select: { quantity: true, franchiseId: true } },
        hubInventories: true,
        replenPolicies: true,
        warehouseStocks: { select: { quantity: true } },
        category: categoryIncludeBreadcrumb,
        brandRef: true,
        variants: {
          include: {
            attributes: {
              include: {
                attributeValue: {
                  select: {
                    id: true,
                    title: true,
                    attributeNameId: true,
                  },
                },
              },
            },
          },
        },
        seo: true,
      },
    });

    paged.data = paged.data.map((p: any) =>
      this.mapProductResponse(this.applyAwsPrefixToProduct(p)),
    );

    const result = paged;

    // await this.redisService.set(cacheKey, result);

    return result;
  }

  async get(id: string) {
    const cacheKey = `${this.BASE_CHACHE}:${id}`;
    const cached = await this.redisService.get<any>(cacheKey);

    // // If cache exists but is missing related data (brand/category/variants),
    // // ignore it and fetch fresh data so callers always get relations.
    if (cached) {
      const hasBrand = cached.brand != null;
      const hasCategory = cached.category != null;
      const hasVariants =
        Array.isArray(cached.variants) && cached.variants.length > 0;
      if (hasBrand || hasCategory || hasVariants) return cached;
      // otherwise proceed to fetch fresh record and replace cache
    }

    if (cached) {
      const hasVariantAttributes =
        Array.isArray(cached.variants) &&
        cached.variants.some(
          (variant: any) =>
            Array.isArray(variant?.attributes) && variant.attributes.length > 0,
        );

      if (hasVariantAttributes) {
        return this.mapProductResponse(this.applyAwsPrefixToProduct(cached));
      }
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: categoryIncludeBreadcrumb,
        brandRef: true,
        variants: {
          include: {
            attributes: {
              include: {
                attributeValue: {
                  select: {
                    id: true,
                    title: true,
                    attributeNameId: true,
                  },
                },
              },
            },
          },
        },
        seo: true,
        warehouseStocks: { select: { quantity: true } },
        franchiseStocks: { select: { quantity: true, franchiseId: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    const result = this.mapProductResponse(
      this.applyAwsPrefixToProduct(product as any),
    );

    await this.redisService.set(cacheKey, result);

    return result;
  }

  async update(id: string, dto: UpdateProductDto, user: JwtUser, ip: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    if (
      !dto.variants?.length &&
      dto.mrpPrice !== null &&
      dto.mrpPrice !== undefined
    ) {
      const mrp = Math.round(Number(dto.mrpPrice) * 100); // in cents
      const existingPrice = Math.round((existing.price as any) * 100);

      if (mrp < existingPrice) {
        throw new BadRequestException('MRP cannot be less than existing price');
      }
    }

    if (
      !dto.variants?.length &&
      dto.wholesalePrice !== null &&
      dto.wholesalePrice !== undefined
    ) {
      const wholeSalePrice = Math.round(Number(dto.wholesalePrice) * 100); // in cents
      const existingBasePrice = Math.round((existing.basePrice as any) * 100);

      if (wholeSalePrice < existingBasePrice) {
        throw new BadRequestException(
          'Wholesale price cannot be less than existing base price',
        );
      }
    }

    if (dto.slug != null) {
      const s = dto.slug.trim();
      if (s.length < 2) {
        throw new BadRequestException('Slug must be at least 2 characters');
      }
      const clash = await this.prisma.product.findFirst({
        where: { slug: s, NOT: { id } },
      });
      if (clash) {
        throw new BadRequestException('Slug already in use');
      }
    }

    // Validate foreign keys provided to give clearer error messages
    if (
      dto.categoryId != undefined &&
      dto.categoryId !== null &&
      dto.categoryId !== ''
    ) {
      const cat = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat) throw new BadRequestException('Category not found');
    }

    if (
      (dto as any).brandId !== undefined &&
      (dto as any).brandId !== null &&
      (dto as any).brandId !== ''
    ) {
      const br = await this.prisma.brand.findUnique({
        where: { id: (dto as any).brandId },
      });
      if (!br) throw new BadRequestException('Brand not found');
    }

    // Properly calculate stock based on variants or direct stock update
    let finalStock: number | undefined;

    if (dto.variants?.length && dto.variants.length > 0) {
      // If variants exist, always calculate stock from variant sum
      finalStock = dto.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    } else if (dto.stock !== undefined && dto.stock >= 0) {
      // If no variants, use provided stock value
      finalStock = dto.stock;
    }

    // Update warehouseStock if stock was calculated/provided
    if (finalStock !== undefined && finalStock >= 0) {
      await this.prisma.warehouseStock.upsert({
        where: { productId: id },
        create: { productId: id, quantity: finalStock },
        update: { quantity: finalStock }, // FIX: Actually update quantity on existing record
      });
    }

    const normalizedImages =
      dto.imageUrls?.map((u) => u.trim()).filter((u) => u.length > 0) ??
      undefined;
    const primaryImageFromArray = normalizedImages?.[0] ?? null;

    try {
      const row = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.wholesalePrice != null
            ? { wholesalePrice: new Prisma.Decimal(dto.wholesalePrice) }
            : {}),
          ...(dto.mrpPrice != null
            ? { mrpPrice: new Prisma.Decimal(dto.mrpPrice) }
            : {}),
          ...(dto.price != null
            ? { price: new Prisma.Decimal(dto.price) }
            : {}),
          ...(dto.basePrice != null
            ? { basePrice: new Prisma.Decimal(dto.basePrice) }
            : {}),
          name: dto.name != null ? dto.name.trim() : undefined,
          slug: dto.slug != null ? dto.slug.trim() : undefined,
          stock: finalStock,
          features:
            dto.features?.length && dto.features.length > 0
              ? dto.features.map((f) => f.trim()).filter((f) => f.length > 0)
              : undefined,
          description:
            dto.description !== undefined
              ? dto.description?.trim() || null
              : undefined,
          categoryId: dto.categoryId != null ? dto.categoryId : undefined,
          brandId: dto.brandId !== null ? dto.brandId : undefined,
          fastDelivery:
            dto.fastDelivery !== undefined ? dto.fastDelivery : undefined,
          isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : undefined,
          imageUrl:
            dto.imageUrl != null
              ? dto.imageUrl.trim() || null
              : normalizedImages != null
                ? primaryImageFromArray
                : undefined,
          imageUrls: normalizedImages != null ? normalizedImages : undefined,
        },
        include: {
          category: categoryIncludeBreadcrumb,
          brandRef: true,
          variants: true,
          seo: true,
        },
      });

      await this.audit.log({
        userId: user.sub,
        action: 'product.catalog.update',
        resource: 'Product',
        resourceId: id,
        metadata: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
        ip: ip,
      });

      return row;
    } catch (err) {
      // Prisma P2003 = foreign key constraint failed. Include meta for debugging.
      const code = (err as any)?.code;
      const meta = (err as any)?.meta;
      console.error('Prisma update error', { code, meta, err });
      if (code === 'P2003') {
        throw new BadRequestException(
          `Invalid relation / foreign key - ${JSON.stringify(meta)}`,
        );
      }
      throw err;
    } finally {
      // Invalidate caches after update
      fireAndForget(
        this.redisService.clearCacheByPrefix(this.BASE_CHACHE),
        'product update',
      );
      fireAndForget(
        this.redisService.del([this.BASE_CHACHE, `${this.BASE_CHACHE}:${id}`]),
        'product update',
      );
    }
  }

  async updateVariant(
    id: string,
    dto: UpdateProductVariantDto,
    user: JwtUser,
    ip: string,
  ) {
    // Find the variant to get productId
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      select: { productId: true, stock: true },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    // Update the variant with provided fields
    const updatedVariant = await this.prisma.productVariant.update({
      where: { id },
      data: {
        ...(dto.wholesalePrice != null
          ? { wholesalePrice: new Prisma.Decimal(dto.wholesalePrice) }
          : {}),
        ...(dto.mrpPrice != null
          ? { mrpPrice: new Prisma.Decimal(dto.mrpPrice) }
          : {}),
        ...(dto.price != null ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.basePrice != null
          ? { basePrice: new Prisma.Decimal(dto.basePrice) }
          : {}),
        sku: dto.sku != null ? dto.sku.trim() : undefined,
        price: dto.price != null ? new Prisma.Decimal(dto.price) : undefined,
        mrpPrice:
          dto.mrpPrice != null ? new Prisma.Decimal(dto.mrpPrice) : undefined,
        stock: dto.stock != null ? Math.max(0, dto.stock) : undefined,
        gstTax: dto.gstTax != null ? dto.gstTax : undefined,
      },
    });

    // Recalculate base product stock: sum of all active variant stocks
    const allVariants = await this.prisma.productVariant.findMany({
      where: { productId: variant.productId, isActive: true },
      select: { stock: true },
    });

    const totalVariantStock = allVariants.reduce(
      (sum, v) => sum + (v.stock || 0),
      0,
    );

    // Update base product stock to match total variant stock
    await this.prisma.product.update({
      where: { id: variant.productId },
      data: { stock: totalVariantStock },
    });

    // Update warehouse stock to match
    await this.prisma.warehouseStock.upsert({
      where: { productId: variant.productId },
      create: { productId: variant.productId, quantity: totalVariantStock },
      update: { quantity: totalVariantStock },
    });

    await this.audit.log({
      userId: user.sub,
      action: 'product.variant.update',
      resource: 'ProductVariant',
      resourceId: id,
      metadata: {
        productId: variant.productId,
        variantId: id,
        changes: {
          sku: dto.sku,
          price: dto.price,
          mrpPrice: dto.mrpPrice,
          stock: dto.stock,
          gstTax: dto.gstTax,
        },
        newProductStock: totalVariantStock,
      },
      ip,
    });

    // Invalidate caches after update
    fireAndForget(
      this.redisService.clearCacheByPrefix(this.BASE_CHACHE),
      'variant update',
    );
    fireAndForget(
      this.redisService.del([this.BASE_CHACHE, `${this.BASE_CHACHE}:${id}`]),
      'variant update',
    );

    return updatedVariant;
  }

  async hardDeleteVarient(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Find the variant to get productId
      const variant = await tx.productVariant.findUnique({
        where: { id },
        select: { productId: true },
      });

      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }

      // 0. Clean up variant references
      await tx.orderItem.updateMany({
        where: { variantId: id },
        data: { variantId: null },
      });
      await tx.productReview.updateMany({
        where: { variantId: id },
        data: { variantId: null },
      });
      await tx.returnItem.updateMany({
        where: { variantId: id },
        data: { variantId: null },
      });
      await tx.returnExchangeItem.updateMany({
        where: { variantId: id },
        data: { variantId: null },
      });
      await tx.inventoryMovement.updateMany({
        where: { variantId: id },
        data: { variantId: null },
      });
      await tx.returnInventoryMovement.updateMany({
        where: { variantId: id },
        data: { variantId: null },
      });
      await tx.supplyChainEvent.updateMany({
        where: { variantId: id },
        data: { variantId: null },
      });
      await tx.wishlist.deleteMany({
        where: { variantId: id },
      });

      // Delete the variant
      await tx.productVariant.delete({
        where: { id },
      });

      // Recalculate base product stock: sum of remaining active variant stocks
      const remainingVariants = await tx.productVariant.findMany({
        where: { productId: variant.productId, isActive: true },
        select: { stock: true },
      });

      const totalVariantStock = remainingVariants.reduce(
        (sum: number, v: { stock: number }) => sum + (v.stock || 0),
        0,
      );

      // Update base product stock to match remaining variants
      await tx.product.update({
        where: { id: variant.productId },
        data: { stock: totalVariantStock },
      });

      // Update warehouse stock to match
      await tx.warehouseStock.upsert({
        where: { productId: variant.productId },
        create: { productId: variant.productId, quantity: totalVariantStock },
        update: { quantity: totalVariantStock },
      });

      return {
        productId: variant.productId,
        totalVariantStock,
      };
    });

    // Invalidate caches
    await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);
    await this.redisService.del([
      this.BASE_CHACHE,
      `${this.BASE_CHACHE}:${result.productId}`,
    ]);

    return {
      deleted: id,
      productId: result.productId,
      newProductStock: result.totalVariantStock,
    };
  }

  async clearAllVarients(dto: DeleteBulkProductsDto) {
    const variantIds = dto.ids ?? [];
    if (variantIds.length === 0) {
      return { deleted: 0, productIds: [] };
    }

    const affectedProductIds = await this.prisma.$transaction(async (tx) => {
      // Find all variants to get their productIds
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, productId: true },
      });

      if (variants.length === 0) {
        return [];
      }

      // Group by productId to track which products are affected
      const productIdSet = new Set(variants.map((v: { productId: string }) => v.productId));
      const affectedProductIds = Array.from(productIdSet);

      // 0. Clean up variant references
      await tx.orderItem.updateMany({
        where: { variantId: { in: variantIds } },
        data: { variantId: null },
      });
      await tx.productReview.updateMany({
        where: { variantId: { in: variantIds } },
        data: { variantId: null },
      });
      await tx.returnItem.updateMany({
        where: { variantId: { in: variantIds } },
        data: { variantId: null },
      });
      await tx.returnExchangeItem.updateMany({
        where: { variantId: { in: variantIds } },
        data: { variantId: null },
      });
      await tx.inventoryMovement.updateMany({
        where: { variantId: { in: variantIds } },
        data: { variantId: null },
      });
      await tx.returnInventoryMovement.updateMany({
        where: { variantId: { in: variantIds } },
        data: { variantId: null },
      });
      await tx.supplyChainEvent.updateMany({
        where: { variantId: { in: variantIds } },
        data: { variantId: null },
      });
      await tx.wishlist.deleteMany({
        where: { variantId: { in: variantIds } },
      });

      // Delete all specified variants
      await tx.productVariant.deleteMany({
        where: { id: { in: variantIds } },
      });

      // For each affected product, recalculate stock from remaining variants
      for (const productId of affectedProductIds) {
        const remainingVariants = await tx.productVariant.findMany({
          where: { productId, isActive: true },
          select: { stock: true },
        });

        const totalVariantStock = remainingVariants.reduce(
          (sum: number, v: { stock: number }) => sum + (v.stock || 0),
          0,
        );

        // Update base product stock to match remaining variants
        await tx.product.update({
          where: { id: productId },
          data: { stock: totalVariantStock },
        });

        // Update warehouse stock to match
        await tx.warehouseStock.upsert({
          where: { productId },
          create: { productId, quantity: totalVariantStock },
          update: { quantity: totalVariantStock },
        });
      }

      return affectedProductIds;
    });

    // Invalidate caches
    await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);
    await this.redisService.del([this.BASE_CHACHE]);

    return { deleted: variantIds.length, productIds: affectedProductIds };
  }

  async updateStatus(
    id: string,
    dto: ProductStatusDto,
    actorUserId: string,
    ip: string,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1. Fetch INSIDE transaction (consistency ke liye)
        const existing = await tx.product.findUnique({
          where: { id },
          select: { status: true },
        });

        if (!existing) {
          throw new NotFoundException('Product not found');
        }

        if (existing.status === dto.status) {
          throw new BadRequestException('Status already same');
        }

        // 2. Update
        const updated = await tx.product.update({
          where: { id },
          data: { status: dto.status },
        });

        return {
          updated,
          previousStatus: existing.status,
        };
      },
      {
        timeout: 10000, //  increase from 10s
      },
    );

    fireAndForget(
      this.audit.log({
        userId: actorUserId,
        action: 'product.status.update',
        resource: 'Product',
        resourceId: id,
        metadata: {
          newStatus: dto.status,
          previousStatus: result.previousStatus,
        },
        ip,
      }),
    );

    // Invalidate caches after update
    await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);
    await this.redisService.del([this.BASE_CHACHE]);

    return result.updated;
  }

  /*
  async updateStatuss(id: string, dto: ProductStatusDto, user: JwtUser) {
    const existing = await this.prisma.product.findUniqueOrThrow({
      where: { id },
    });


    const row = await this.prisma.product.update({
      where: { id },
      data: {
        status: dto.status,
      },
    });

    await this.audit.log({
      userId: user.sub,
      action: 'product.status.update',
      resource: 'Product',
      resourceId: id,
      metadata: { status: dto.status },
    });

    // Invalidate caches after update
    await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);
    await this.redisService.del([this.BASE_CHACHE]);

    return row;
  }*/

  async updateVisibility(
    id: string,
    dto: ProductVisibilityDto,
    user: JwtUser,
    ip?: string,
  ) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');
    const row = await this.prisma.product.update({
      where: { id },
      data: { visibility: dto.visibility },
    });

    await this.audit.log({
      userId: user.sub,
      action: 'product.visibility.update',
      resource: 'Product',
      resourceId: id,
      metadata: { visibility: dto.visibility },
      ip,
    });

    if (dto.visibility && !existing.visibility) {
      const firstImage = Array.isArray(row.imageUrls) && row.imageUrls.length > 0
        ? String(row.imageUrls[0])
        : (row.imageUrl || null);
      const productImage = this.applyAwsPrefixToUrl(firstImage);
      void this.roleBasedNotificationService.notifyAllCustomers(
        'New Product Available',
        `A new product "${row.name}" has been published! Check it out now.`,
        NotificationType.SYSTEM,
        {
          productId: row.id,
          slug: row.slug,
          productName: row.name,
          productImage,
        },
      );
    }

    // Invalidate caches after update
    await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);
    await this.redisService.del([this.BASE_CHACHE]);

    return row;
  }

  async updateBulk(items: { id: string; data: UpdateProductDto }[]) {
    const updated: any[] = [];
    for (const it of items) {
      const existing = await this.prisma.product.findUnique({
        where: { id: it.id },
      });
      if (!existing) continue;
      // Validate FKs for bulk items
      if (it.data.categoryId != null && it.data.categoryId !== '') {
        const cat = await this.prisma.category.findUnique({
          where: { id: it.data.categoryId },
        });
        if (!cat) continue; // skip invalid
      }

      if (
        (it.data as any).brandId !== undefined &&
        (it.data as any).brandId !== null &&
        (it.data as any).brandId !== ''
      ) {
        const br = await this.prisma.brand.findUnique({
          where: { id: (it.data as any).brandId },
        });
        if (!br) continue; // skip invalid
      }
      const normalizedImages =
        it.data.imageUrls?.map((u) => u.trim()).filter((u) => u.length > 0) ??
        undefined;
      const primaryImageFromArray = normalizedImages?.[0] ?? null;

      // Calculate stock for bulk update (same logic as in update method)
      let finalStock: number | undefined;
      if (it.data.variants?.length && it.data.variants.length > 0) {
        // If variants exist, always calculate stock from variant sum
        finalStock = it.data.variants.reduce(
          (sum, v) => sum + (v.stock || 0),
          0,
        );
      } else if (it.data.stock !== undefined && it.data.stock >= 0) {
        // If no variants, use provided stock value
        finalStock = it.data.stock;
      }

      // Update warehouseStock if stock was calculated/provided
      if (finalStock !== undefined && finalStock >= 0) {
        await this.prisma.warehouseStock.upsert({
          where: { productId: it.id },
          create: { productId: it.id, quantity: finalStock },
          update: { quantity: finalStock },
        });
      }

      const row = await this.prisma.product.update({
        where: { id: it.id },
        data: {
          name: it.data.name != null ? it.data.name.trim() : undefined,
          slug: it.data.slug != null ? it.data.slug.trim() : undefined,
          stock: finalStock,
          description:
            it.data.description !== undefined
              ? it.data.description?.trim() || null
              : undefined,
          brandId:
            (it.data as any).brandId !== undefined
              ? (it.data as any).brandId || null
              : undefined,
          categoryId:
            it.data.categoryId != null && it.data.categoryId !== ''
              ? it.data.categoryId
              : undefined,
          status:
            (it.data as any).status !== undefined
              ? (it.data as any).status
              : undefined,
          price:
            it.data.price != null
              ? new Prisma.Decimal(it.data.price)
              : undefined,
          mrpPrice:
            it.data.mrpPrice != null
              ? new Prisma.Decimal(it.data.mrpPrice)
              : undefined,
          imageUrl:
            it.data.imageUrl != null
              ? it.data.imageUrl.trim() || null
              : normalizedImages != null
                ? primaryImageFromArray
                : undefined,
          imageUrls: normalizedImages != null ? normalizedImages : undefined,
        },
      });
      updated.push(row);
    }

    // Invalidate caches after update
    await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);
    await this.redisService.del([this.BASE_CHACHE]);

    return updated;
  }

  async hardDelete(id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // =========================
        // 0. relation cleanup to ensure deletion at any cost
        // =========================
        await tx.orderItem.deleteMany({ where: { productId: id } });
        await tx.wishlist.deleteMany({ where: { productId: id } });
        await tx.productReview.deleteMany({ where: { productId: id } });
        await tx.returnItem.deleteMany({ where: { productId: id } });
        await tx.returnExchangeItem.deleteMany({ where: { productId: id } });
        await tx.inventoryMovement.deleteMany({ where: { productId: id } });
        await tx.returnInventoryMovement.deleteMany({ where: { productId: id } });
        await tx.searchHistory.deleteMany({ where: { productId: id } });

        // =========================
        // 1. deepest chain
        // =========================

        await tx.inboundDelivery.deleteMany({
          where: {
            stockRequest: { productId: id },
          },
        });

        // 🔥 FIX: delete reservations linked to stockRequest FIRST
        await tx.inventoryReservation.deleteMany({
          where: {
            stockRequest: {
              productId: id,
            },
          },
        });

        await tx.seoMeta.deleteMany({ where: { productId: id } });

        // =========================
        // 2. non-cascade
        // =========================

        await tx.supplyChainEvent.deleteMany({ where: { productId: id } });

        // =========================
        // 3. remaining reservations
        // =========================

        await tx.inventoryReservation.deleteMany({
          where: {
            productId: id,
            stockRequestId: null,
          },
        });

        // =========================
        // 4. now safe
        // =========================

        await tx.stockRequest.deleteMany({ where: { productId: id } });

        await tx.stockTransferLine.deleteMany({ where: { productId: id } });
        await tx.replenishmentPolicy.deleteMany({ where: { productId: id } });
        await tx.promotionProduct.deleteMany({ where: { productId: id } });

        await tx.franchiseStock.deleteMany({ where: { productId: id } });
        await tx.hubInventory.deleteMany({ where: { productId: id } });
        await tx.warehouseStock.deleteMany({ where: { productId: id } });

        // variant chain
        await tx.variantAttribute.deleteMany({
          where: {
            variant: { productId: id },
          },
        });

        await tx.productVariant.deleteMany({ where: { productId: id } });

        // final
        await tx.product.delete({ where: { id } });

        // Invalidate caches after delete
        await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);
        await this.redisService.del([this.BASE_CHACHE]);

        return { id };
      },
      { timeout: 60000 },
    );
  }

  async hardDeleteBulk(dto: DeleteBulkProductsDto) {
    const ids = dto.ids ?? [];
    if (ids.length === 0) return { deleted: 0 };

    await this.prisma.$transaction(
      async (tx) => {
        // =========================
        // 0. relation cleanup to ensure deletion at any cost
        // =========================
        await tx.orderItem.deleteMany({ where: { productId: { in: ids } } });
        await tx.wishlist.deleteMany({ where: { productId: { in: ids } } });
        await tx.productReview.deleteMany({ where: { productId: { in: ids } } });
        await tx.returnItem.deleteMany({ where: { productId: { in: ids } } });
        await tx.returnExchangeItem.deleteMany({ where: { productId: { in: ids } } });
        await tx.inventoryMovement.deleteMany({ where: { productId: { in: ids } } });
        await tx.returnInventoryMovement.deleteMany({ where: { productId: { in: ids } } });
        await tx.searchHistory.deleteMany({ where: { productId: { in: ids } } });

        // 1. deepest chain: inbound deliveries that point to stockRequests for these products
        await tx.inboundDelivery.deleteMany({
          where: { stockRequest: { productId: { in: ids } } },
        });

        // delete reservations linked to those stockRequests first
        await tx.inventoryReservation.deleteMany({
          where: { stockRequest: { productId: { in: ids } } },
        });

        // 2. non-cascade cleanup
        await tx.seoMeta.deleteMany({ where: { productId: { in: ids } } });
        await tx.supplyChainEvent.deleteMany({
          where: { productId: { in: ids } },
        });

        // 3. remaining reservations not tied to stockRequests
        await tx.inventoryReservation.deleteMany({
          where: { productId: { in: ids }, stockRequestId: null },
        });

        // 4. now safe to remove stock requests and other dependents
        await tx.stockRequest.deleteMany({ where: { productId: { in: ids } } });

        await tx.stockTransferLine.deleteMany({
          where: { productId: { in: ids } },
        });
        await tx.replenishmentPolicy.deleteMany({
          where: { productId: { in: ids } },
        });
        await tx.promotionProduct.deleteMany({
          where: { productId: { in: ids } },
        });

        await tx.franchiseStock.deleteMany({
          where: { productId: { in: ids } },
        });
        await tx.hubInventory.deleteMany({ where: { productId: { in: ids } } });
        await tx.warehouseStock.deleteMany({
          where: { productId: { in: ids } },
        });

        // variant chain
        await tx.variantAttribute.deleteMany({
          where: { variant: { productId: { in: ids } } },
        });

        await tx.productVariant.deleteMany({
          where: { productId: { in: ids } },
        });

        // final
        await tx.product.deleteMany({ where: { id: { in: ids } } });
      },
      { timeout: 60000 },
    );

    // Invalidate caches after delete
    await this.redisService.clearCacheByPrefix(this.BASE_CHACHE);
    await this.redisService.del([this.BASE_CHACHE]);

    return { deleted: ids.length };
  }

  // async update(
  //   productId: string,
  //   dto: UpdateProductDto,
  //   // actor: { userId: string; ip?: string | null },
  // ) {
  //   const existing = await this.prisma.product.findUnique({
  //     where: { id: productId },
  //   });
  //   if (!existing) {
  //     throw new NotFoundException('Product not found');
  //   }
  //   if (dto.slug != null) {
  //     const s = dto.slug.trim();
  //     if (s.length < 2) {
  //       throw new BadRequestException('Slug must be at least 2 characters');
  //     }
  //     const clash = await this.prisma.product.findFirst({
  //       where: { slug: s, NOT: { id: productId } },
  //     });
  //     if (clash) {
  //       throw new BadRequestException('Slug already in use');
  //     }
  //   }
  //   if (dto.categoryId != null) {
  //     const cat = await this.prisma.category.findUnique({
  //       where: { id: dto.categoryId },
  //     });
  //     if (!cat) {
  //       throw new BadRequestException('Category not found');
  //     }
  //   }
  //   const nextPrice = dto.price ?? Number(existing.price);
  //   const nextMrp = dto.mrpPrice ?? Number(existing.mrpPrice ?? existing.price);
  //   if (nextPrice > nextMrp) {
  //     throw new BadRequestException('Selling price cannot be greater than MRP');
  //   }
  //   const normalizedImages =
  //     dto.imageUrls?.map((u) => u.trim()).filter((u) => u.length > 0) ??
  //     undefined;
  //   const primaryImageFromArray = normalizedImages?.[0] ?? null;

  //   const row = await this.prisma.product.update({
  //     where: { id: productId },
  //     data: {
  //       name: dto.name != null ? dto.name.trim() : undefined,
  //       slug: dto.slug != null ? dto.slug.trim() : undefined,
  //       description:
  //         dto.description !== undefined
  //           ? dto.description?.trim() || null
  //           : undefined,
  //       // brand: dto.brand !== undefined ? dto.brand?.trim() || null : undefined,
  //       occasions:
  //         dto.occasions !== undefined
  //           ? dto.occasions?.trim() || null
  //           : undefined,
  //       categoryId: dto.categoryId != null ? dto.categoryId : undefined,
  //       // active: dto.active !== undefined ? dto.active : undefined,
  //       fastDelivery:
  //         dto.fastDelivery !== undefined ? dto.fastDelivery : undefined,
  //       isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : undefined,
  //       price: dto.price != null ? new Prisma.Decimal(dto.price) : undefined,
  //       mrpPrice:
  //         dto.mrpPrice != null ? new Prisma.Decimal(dto.mrpPrice) : undefined,
  //       // defaultGstRatePercent:
  //       //   dto.defaultGstRatePercent != null
  //       //     ? new Prisma.Decimal(dto.defaultGstRatePercent)
  //       //     : undefined,
  //       imageUrl:
  //         dto.imageUrl != null
  //           ? dto.imageUrl.trim() || null
  //           : normalizedImages != null
  //             ? primaryImageFromArray
  //             : undefined,
  //       imageUrls: normalizedImages != null ? normalizedImages : undefined,
  //     },
  //     include: { category: true },
  //   });
  //   // await this.audit.log({
  //   //   userId: actor.userId,
  //   //   action: 'product.catalog.update',
  //   //   resource: 'Product',
  //   //   resourceId: productId,
  //   //   metadata: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
  //   //   ip: actor.ip,
  //   // });
  //   return row;
  // }
}

/*
@Injectable()
export class ProductsService {
  constructor(
    private readonly redisService: RedisService,
    private readonly attributesService: AttributesService,

    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalogPromotions: CatalogPromotionService,
  ) {}

  async list(params: CatalogListParams) {
    const skip = (params.page - 1) * params.pageSize;
    const andBlocks: Prisma.ProductWhereInput[] = [{ active: true }];

    if (params.featuredOnly === true) {
      andBlocks.push({ isFeatured: true });
    } else if (params.featuredOnly === false) {
      andBlocks.push({ isFeatured: false });
    }
    if (params.fastDelivery === true) {
      andBlocks.push({ fastDelivery: true });
    } else if (params.fastDelivery === false) {
      andBlocks.push({ fastDelivery: false });
    }
    if (params.minRating != null && !Number.isNaN(params.minRating)) {
      andBlocks.push({
        ratingAvg: { gte: new Prisma.Decimal(params.minRating) },
      });
    }
    if (params.inStock === true) {
      andBlocks.push({
        OR: [
          { warehouseStocks: { is: { quantity: { gt: 0 } } } },
          { franchiseStocks: { some: { quantity: { gt: 0 } } } },
        ],
      });
    } else if (params.inStock === false) {
      andBlocks.push({
        AND: [
          { NOT: { warehouseStocks: { is: { quantity: { gt: 0 } } } } },
          { NOT: { franchiseStocks: { some: { quantity: { gt: 0 } } } } },
        ],
      });
    }

    if (params.categorySlug) {
      const flat = await this.prisma.category.findMany({
        select: { id: true, parentId: true, slug: true },
      });
      const ids = subtreeCategoryIds(flat, params.categorySlug);
      if (ids === null) {
        andBlocks.push({ id: { in: [] } });
      } else {
        andBlocks.push({ categoryId: { in: ids } });
      }
    }

    if (params.brands?.length) {
      andBlocks.push({
        OR: params.brands.map((b) => ({
          brand: { equals: b, mode: 'insensitive' },
        })),
      });
    }

    if (params.occasions?.length) {
      andBlocks.push({
        OR: params.occasions.map((o) => ({
          occasions: { contains: o, mode: 'insensitive' },
        })),
      });
    }

    if (params.q?.trim()) {
      const q = params.q.trim();
      andBlocks.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (params.minPrice != null || params.maxPrice != null) {
      const price: Prisma.DecimalFilter = {};
      if (params.minPrice != null) {
        price.gte = new Prisma.Decimal(params.minPrice);
      }
      if (params.maxPrice != null) {
        price.lte = new Prisma.Decimal(params.maxPrice);
      }
      andBlocks.push({ price });
    }

    const where: Prisma.ProductWhereInput =
      andBlocks.length === 1 ? andBlocks[0] : { AND: andBlocks };

    const orderBy = this.buildOrderBy(params);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy,
        include: { category: categoryIncludeBreadcrumb },
      }),
      this.prisma.product.count({ where }),
    ]);

    const discountMap = await this.catalogPromotions.bestPercentOffByProductId(
      items.map((p) => p.id),
    );
    const itemsDecorated = items.map((p) => {
      const off = discountMap.get(p.id) ?? 0;
      const sale = this.catalogPromotions.effectiveUnitPrice(p.price, off);
      return {
        ...p,
        listPrice: p.price,
        price: sale,
        promotionPercentOff: off > 0 ? off : null,
      };
    });

    return {
      items: itemsDecorated,
      total,
      page: params.page,
      pageSize: params.pageSize,
      applied: {
        categorySlug: params.categorySlug ?? null,
        q: params.q ?? null,
        sort: params.sort,
      },
    };
  }

  private buildOrderBy(
    params: CatalogListParams,
  ): Prisma.ProductOrderByWithRelationInput[] {
    const tie = { id: 'asc' as const };
    switch (params.sort) {
      case 'price_asc':
        return [{ price: 'asc' }, tie];
      case 'price_desc':
        return [{ price: 'desc' }, tie];
      case 'newest':
        return [{ createdAt: 'desc' }, tie];
      case 'rating_desc':
        return [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }, tie];
      case 'bestseller':
        return [{ reviewCount: 'desc' }, { ratingAvg: 'desc' }, tie];
      case 'featured':
        return [{ isFeatured: 'desc' }, { reviewCount: 'desc' }, tie];
      case 'relevance':
      default:
        if (params.q?.trim()) {
          return [
            { isFeatured: 'desc' },
            { ratingAvg: 'desc' },
            { name: 'asc' },
            tie,
          ];
        }
        return [{ isFeatured: 'desc' }, { createdAt: 'desc' }, tie];
    }
  }

  async getBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, active: true },
      include: { category: categoryIncludeBreadcrumb },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const discountMap = await this.catalogPromotions.bestPercentOffByProductId([
      product.id,
    ]);
    const off = discountMap.get(product.id) ?? 0;
    const sale = this.catalogPromotions.effectiveUnitPrice(product.price, off);
    return {
      ...product,
      listPrice: product.price,
      price: sale,
      promotionPercentOff: off > 0 ? off : null,
    };
  }

  async findByIdForAdmin(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(
    dto: CreateProductDto,
    actor: { userId: string; ip?: string | null },
  ) {
    if (dto.mrpPrice != null && dto.price > dto.mrpPrice) {
      throw new BadRequestException('Selling price cannot be greater than MRP');
    }
    const normalizedImages = (dto.imageUrls ?? [])
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    const primaryImage = dto.imageUrl?.trim() || normalizedImages[0] || null;
    const row = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        mrpPrice:
          dto.mrpPrice != null
            ? new Prisma.Decimal(dto.mrpPrice)
            : new Prisma.Decimal(dto.price),
        price: new Prisma.Decimal(dto.price),
        imageUrl: primaryImage,
        imageUrls: normalizedImages,
        active: dto.active ?? true,
        categoryId: dto.categoryId,
        brand: dto.brand ?? undefined,
        occasions: dto.occasions ?? undefined,
        fastDelivery: dto.fastDelivery ?? false,
        isFeatured: dto.isFeatured ?? false,
        ratingAvg:
          dto.ratingAvg != null && !Number.isNaN(dto.ratingAvg)
            ? new Prisma.Decimal(dto.ratingAvg)
            : new Prisma.Decimal(0),
        reviewCount: dto.reviewCount ?? 0,
        defaultGstRatePercent: new Prisma.Decimal(0),
      },
      include: { category: true },
    });
    await this.prisma.warehouseStock.upsert({
      where: { productId: row.id },
      create: { productId: row.id, quantity: 0 },
      update: {},
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'product.create',
      resource: 'Product',
      resourceId: row.id,
      metadata: { slug: row.slug, name: row.name },
      ip: actor.ip,
    });
    return row;
  }

  async updateCatalog(
    productId: string,
    dto: UpdateProductCatalogDto,
    actor: { userId: string; ip?: string | null },
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    if (dto.slug != null) {
      const s = dto.slug.trim();
      if (s.length < 2) {
        throw new BadRequestException('Slug must be at least 2 characters');
      }
      const clash = await this.prisma.product.findFirst({
        where: { slug: s, NOT: { id: productId } },
      });
      if (clash) {
        throw new BadRequestException('Slug already in use');
      }
    }
    if (dto.categoryId != null) {
      const cat = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat) {
        throw new BadRequestException('Category not found');
      }
    }
    const nextPrice = dto.price ?? Number(existing.price);
    const nextMrp = dto.mrpPrice ?? Number(existing.mrpPrice ?? existing.price);
    if (nextPrice > nextMrp) {
      throw new BadRequestException('Selling price cannot be greater than MRP');
    }
    const normalizedImages =
      dto.imageUrls?.map((u) => u.trim()).filter((u) => u.length > 0) ??
      undefined;
    const primaryImageFromArray = normalizedImages?.[0] ?? null;
    const row = await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: dto.name != null ? dto.name.trim() : undefined,
        slug: dto.slug != null ? dto.slug.trim() : undefined,
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : undefined,
        brand: dto.brand !== undefined ? dto.brand?.trim() || null : undefined,
        occasions:
          dto.occasions !== undefined
            ? dto.occasions?.trim() || null
            : undefined,
        categoryId: dto.categoryId != null ? dto.categoryId : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
        fastDelivery:
          dto.fastDelivery !== undefined ? dto.fastDelivery : undefined,
        isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : undefined,
        price: dto.price != null ? new Prisma.Decimal(dto.price) : undefined,
        mrpPrice:
          dto.mrpPrice != null ? new Prisma.Decimal(dto.mrpPrice) : undefined,
        defaultGstRatePercent:
          dto.defaultGstRatePercent != null
            ? new Prisma.Decimal(dto.defaultGstRatePercent)
            : undefined,
        imageUrl:
          dto.imageUrl != null
            ? dto.imageUrl.trim() || null
            : normalizedImages != null
              ? primaryImageFromArray
              : undefined,
        imageUrls: normalizedImages != null ? normalizedImages : undefined,
      },
      include: { category: true },
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'product.catalog.update',
      resource: 'Product',
      resourceId: productId,
      metadata: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
      ip: actor.ip,
    });
    return row;
  }

  async filterMeta() {
    const [priceAgg, brands, productsForOccasions, ratingAgg] =
      await Promise.all([
        this.prisma.product.aggregate({
          where: { active: true },
          _min: { price: true },
          _max: { price: true },
        }),
        this.prisma.product.groupBy({
          by: ['brand'],
          where: { active: true, brand: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.product.findMany({
          where: { active: true, occasions: { not: null } },
          select: { occasions: true },
        }),
        this.prisma.product.aggregate({
          where: { active: true },
          _max: { ratingAvg: true },
          _min: { ratingAvg: true },
        }),
      ]);

    const occasionSet = new Set<string>();
    for (const p of productsForOccasions) {
      if (!p.occasions) continue;
      for (const part of p.occasions.split(',')) {
        const t = part.trim();
        if (t) {
          occasionSet.add(t);
        }
      }
    }

    return {
      price: {
        min: priceAgg._min.price?.toString() ?? '0',
        max: priceAgg._max.price?.toString() ?? '0',
      },
      rating: {
        min: ratingAgg._min.ratingAvg?.toString() ?? '0',
        max: ratingAgg._max.ratingAvg?.toString() ?? '5',
      },
      brands: brands
        .filter((b) => b.brand)
        .map((b) => ({ name: b.brand as string, count: b._count._all }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      occasions: [...occasionSet].sort((a, b) => a.localeCompare(b)),
      flags: ['inStock', 'fastDelivery', 'featuredOnly'],
      sorts: [
        { id: 'relevance', label: 'Relevance' },
        { id: 'featured', label: 'Featured' },
        { id: 'price_asc', label: 'Price: low to high' },
        { id: 'price_desc', label: 'Price: high to low' },
        { id: 'newest', label: 'Newest arrivals' },
        { id: 'rating_desc', label: 'Avg. customer review' },
        { id: 'bestseller', label: 'Bestselling' },
      ],
    };
  }
}
*/
