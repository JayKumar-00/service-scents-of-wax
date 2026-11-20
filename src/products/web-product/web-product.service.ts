import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { ProductsService } from '../products.service';
import {
  WebProductQueryDto,
  WebProductSortBy,
} from './dto/web-product-query.dto';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { paginatePrisma } from 'src/common/utils/pagination.util';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildPrismaPriceRangeFilter,
  buildPrismaRatingRangeFilter,
} from '../utils/range-filter.util';
import { CategoriesService } from '../categories/categories.service';
import { BrandsService } from '../brands/brands.service';
import { ReportService } from 'src/report/services/report.service';
import { subtreeCategoryIds, subtreeCategoryIdsById } from '../catalog-helpers';


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

const categoryWebListSelect = {
  select: {
    id: true,
    name: true,
    slug: true,
    parent: {
      select: {
        id: true,
        name: true,
        slug: true,
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
            parent: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    },
  },
} as const;

const productWebListSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  mrpPrice: true,
  stock: true,
  isFeatured: true,
  fastDelivery: true,
  ratingAvg: true,
  reviewCount: true,
  viewCount: true,
  imageUrl: true,
  imageUrls: true,
  createdAt: true,
  category: categoryWebListSelect,
  brandRef: {
    select: {
      id: true,
      name: true,
      description: true,
      slug: true,
      imageUrl: true,
    },
  },
  variants: {
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
  seo: true,
  warehouseStocks: { select: { quantity: true, reserved: true } },
  franchiseStocks: { select: { quantity: true, reserved: true, franchiseId: true } },
  reservations: {
    where: { status: 'ACTIVE' },
    select: { quantity: true, note: true },
  },
} as const;

@Injectable()
export class WebProductService {
  private logger = new Logger(WebProductService.name);

  private readonly BASE_CACHE = `web_product`;

  private getDisplayStock(p: any) {
    if (Array.isArray(p?.variants) && p.variants.length > 0) {
      const reservedByVariant = new Map<string, number>();
      if (Array.isArray(p.reservations)) {
        for (const r of p.reservations) {
          if (r.note && r.note.includes('__variantId:')) {
            const match = r.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
            if (match && match[1]) {
              const vId = match[1];
              reservedByVariant.set(vId, (reservedByVariant.get(vId) ?? 0) + r.quantity);
            }
          }
        }
      }
      return p.variants
        .filter((variant: any) => variant?.isActive !== false)
        .reduce((sum: number, variant: any) => {
          const reservedQty = reservedByVariant.get(variant.id) ?? 0;
          const displayStock = Math.max(0, (variant?.stock ?? 0) - reservedQty);
          return sum + displayStock;
        }, 0);
    }

    const baseStock = p?.stock ?? 0;
    const quantity = p?.warehouseStocks?.quantity ?? baseStock;
    const reserved = p?.warehouseStocks?.reserved ?? 0;
    const warehouseStockQty = Math.max(0, quantity - reserved);

    let franchiseStockQty = 0;
    if (Array.isArray(p?.franchiseStocks)) {
      franchiseStockQty = p.franchiseStocks.reduce(
        (sum: number, fs: any) => sum + Math.max(0, (fs?.quantity ?? 0) - (fs?.reserved ?? 0)),
        0,
      );
    }

    return warehouseStockQty + franchiseStockQty;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly redisService: RedisService,
    private readonly categoriesService: CategoriesService,
    private readonly brandsService: BrandsService,
    private readonly reportService: ReportService,
  ) {}

  /**
   * Map product response with AWS prefix handling
   */
  private mapProductResponse(p: any) {
    const reservedByVariant = new Map<string, number>();
    if (Array.isArray(p.reservations)) {
      for (const r of p.reservations) {
        if (r.note && r.note.includes('__variantId:')) {
          const match = r.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
          if (match && match[1]) {
            const vId = match[1];
            reservedByVariant.set(vId, (reservedByVariant.get(vId) ?? 0) + r.quantity);
          }
        }
      }
    }

    const mapVariant = (v: any) => {
      const reservedQty = reservedByVariant.get(v.id) ?? 0;
      const displayStock = Math.max(0, (v.stock ?? 0) - reservedQty);
      return {
        ...v,
        stock: displayStock,
        ratingAvg: v.ratingAvg ? Number(v.ratingAvg) : 0,
        ratingCount: v.reviewCount ?? 0,
        reviews: v.reviews || [],
        attributes: Array.isArray(v.attributes)
          ? v.attributes.map((attr: any) => ({
              ...attr,
              attributeName: attr.attributeValue?.attributeName?.title || attr.attributeName || null,
              attributeValue: attr.attributeValue?.title || (typeof attr.attributeValue === 'string' ? attr.attributeValue : null),
            }))
          : [],
      };
    };

    const mappedVariants = p.variants ? p.variants.map(mapVariant) : [];

    let finalPrice = p.price ? Number(p.price) : 0;
    let finalMrpPrice = p.mrpPrice ? Number(p.mrpPrice) : null;

    if (mappedVariants.length > 0) {
      const activeVariants = mappedVariants.filter((v: any) => v.isActive !== false);
      if (activeVariants.length > 0) {
        const sumPrice = activeVariants.reduce((sum: number, v: any) => sum + (v.price ? Number(v.price) : 0), 0);
        finalPrice = sumPrice / activeVariants.length;

        const mrpVariants = activeVariants.filter((v: any) => v.mrpPrice !== null && v.mrpPrice !== undefined);
        if (mrpVariants.length > 0) {
          const sumMrp = mrpVariants.reduce((sum: number, v: any) => sum + Number(v.mrpPrice), 0);
          finalMrpPrice = sumMrp / mrpVariants.length;
        } else {
          finalMrpPrice = null;
        }
      }
    }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: finalPrice,
      mrpPrice: finalMrpPrice,
      stock: this.getDisplayStock(p),
      isFeatured: p.isFeatured,
      fastDelivery: p.fastDelivery,
      ratingAvg: p.ratingAvg ? Number(p.ratingAvg) : 0,
      ratingCount: p.reviewCount ?? 0,
      viewCount: p.viewCount ?? 0,
      imageUrl: p.imageUrl,
      imageUrls: p.imageUrls,
      category: p.category,
      brandRef: p.brandRef,
      variants: mappedVariants,
      reviews: p.reviews || [],
      seo: p.seo,
      createdAt: p.createdAt,
    };
  }

  /**
   * Helper: Get all category IDs including children (tree traversal)
   */
  private async getCategoryTreeIds(searchTerm: string): Promise<string[]> {
    const flat = await this.prisma.category.findMany({
      select: { id: true, parentId: true, slug: true, name: true },
    });

    const result: string[] = [];

    // Find categories matching search term (by name or slug)
    const matches = flat.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const traverse = (categoryId: string) => {
      if (result.includes(categoryId)) return; // avoid duplicates
      result.push(categoryId);

      // Find all children
      for (const c of flat) {
        if (c.parentId === categoryId) {
          traverse(c.id);
        }
      }
    };

    // For each matched category, traverse and collect all children
    for (const match of matches) {
      traverse(match.id);
    }

    return result;
  }

  /**
   * Build sort order for web product queries
   */
  private buildProductSortOrder(
    sortBy: WebProductSortBy | undefined,
    order?: OrderType,
  ): Record<string, OrderType> {
    const orderBy: Record<string, OrderType> = {};

    switch (sortBy) {
      case WebProductSortBy.NEWEST:
        orderBy['createdAt'] = order ?? OrderType.DESC;
        break;
      case WebProductSortBy.OLDEST:
        orderBy['createdAt'] = OrderType.ASC;
        break;
      case WebProductSortBy.PRICE_ASC:
        orderBy['price'] = OrderType.ASC;
        break;
      case WebProductSortBy.PRICE_DESC:
        orderBy['price'] = OrderType.DESC;
        break;
      case WebProductSortBy.RATING_DESC:
        orderBy['ratingAvg'] = OrderType.DESC;
        break;
      case WebProductSortBy.A_Z:
        orderBy['name'] = OrderType.ASC;
        break;
      case WebProductSortBy.Z_A:
        orderBy['name'] = OrderType.DESC;
        break;
      case WebProductSortBy.POPULAR:
        orderBy['viewCount'] = order ?? OrderType.DESC;
        break;
      case WebProductSortBy.FEATURED:
        orderBy['isFeatured'] = order ?? OrderType.DESC;
        break;
      case WebProductSortBy.BESTSELLER:
        // For bestseller, sort by popularity (review count) descending
        orderBy['reviewCount'] = order ?? OrderType.DESC;
        break;
      case WebProductSortBy.RELEVANCE:
      default:
        orderBy['createdAt'] = order ?? OrderType.DESC;
        break;
    }

    return orderBy;
  }

  /**
   * Comprehensive product listing with search, filters, pagination & sorting
   */
  async findAll(
    query: WebProductQueryDto,
  ): Promise<{ data: any[]; meta: IMeta; brands?: any[]; categories?: any[] }> {
    const q = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    // 1. SEARCH - product name, brand, slug, category name, and all child category products
    if (q.search && q.search.trim().length > 0) {
      const searchTerm = q.search.trim();

      // Check if search term matches category name/slug and get all children
      const categoryIds = await this.getCategoryTreeIds(searchTerm);

      // Build OR clause combining product search + category tree search
      const searchClauses: any[] = [
        {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { slug: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            {
              brandRef: { name: { contains: searchTerm, mode: 'insensitive' } },
            },
            {
              category: { name: { contains: searchTerm, mode: 'insensitive' } },
            },
            { seo: { title: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        },
      ];

      // If categories matched, also include all products from those categories and their children
      if (categoryIds.length > 0) {
        searchClauses.push({
          categoryId: { in: categoryIds },
        });
      }

      // Combine all search conditions with OR
      clauses.push({ OR: searchClauses });
    }

    // 2. CATEGORY filters (explicit category filter parameter)
    if (q.categoryId || q.categorySlug) {
      const flat = await this.prisma.category.findMany({
        select: { id: true, parentId: true, slug: true },
      });

      let categoryIds: string[] | null = null;

      if (q.categoryId) {
        categoryIds = subtreeCategoryIdsById(flat, q.categoryId);
      } else if (q.categorySlug) {
        categoryIds = subtreeCategoryIds(flat, q.categorySlug);
      }

      if (categoryIds && categoryIds.length > 0) {
        clauses.push({ categoryId: { in: categoryIds } });
      } else {
        // If the category does not exist, return no products
        clauses.push({ id: { in: [] } });
      }
    }


    // 3. BRAND filters
    if (q.brandId) {
      clauses.push({ brandRef: { id: q.brandId } });
    }

    if (q.brands) {
      const brandList = q.brands.split(',').map((b) => b.trim());
      clauses.push({
        brandRef: {
          name: {
            in: brandList,
            mode: 'insensitive',
          },
        },
      });
    }

    // 4. PRICE range filter
    if (q.minPrice || q.maxPrice) {
      const priceFilter = buildPrismaPriceRangeFilter({
        minPrice: q.minPrice,
        maxPrice: q.maxPrice,
      });
      clauses.push({ price: priceFilter });
    }

    // 5. RATING filter
    if (q.minRating != null && !Number.isNaN(q.minRating)) {
      const ratingFilter = buildPrismaRatingRangeFilter({
        minRatingOrComment: q.minRating,
        maxRatingOrComment: undefined,
      });
      clauses.push({ ratingAvg: ratingFilter });
    }

    // 6. STOCK availability
    if (q.inStock?.includes('true')) {
      clauses.push({
        OR: [
          { warehouseStocks: { is: { quantity: { gt: 0 } } } },
          { franchiseStocks: { some: { quantity: { gt: 0 } } } },
        ],
      });
    } else if (q.inStock?.includes('false')) {
      clauses.push({
        AND: [
          { NOT: { warehouseStocks: { is: { quantity: { gt: 0 } } } } },
          { NOT: { franchiseStocks: { some: { quantity: { gt: 0 } } } } },
        ],
      });
    }

    // 7. FAST DELIVERY filter
    if (q.fastDelivery?.includes('true')) {
      clauses.push({ fastDelivery: true });
    }

    // 8. FEATURED filter
    if (q.featuredOnly?.includes('true')) {
      clauses.push({ isFeatured: true });
    }

    // 9. OCCASIONS filter
    if (q.occasions) {
      const occasionList = q.occasions.split(',').map((o) => o.trim());
      clauses.push({
        OR: occasionList.map((o) => ({
          occasions: { contains: o, mode: 'insensitive' },
        })),
      });
    }

    // Always filter for active and visible products on storefront
    clauses.push({ status: ProductStatus.ACTIVE, visibility: true });

    const where = clauses.length > 0 ? { AND: clauses } : {};

    // PAGINATION & SORTING
    const page = q.page ?? 1;
    const limit = q.limit ?? 7; // Default to 7 as requested
    const orderBy = this.buildProductSortOrder(q.sortBy, q.order);

    // Paginate and fetch products
    const paged = await paginatePrisma<any>({
      model: this.prisma.product as any,
      where,
      orderBy,
      page,
      limit,
      select: productWebListSelect,
    });

    paged.data = paged.data.map((p: any) => this.mapProductResponse(p));

    // Optionally include related brands & categories for filtering UI
    let relatedBrands: any[] = [];
    let relatedCategories: any[] = [];

    if (q.search) {
      // Get brands that have matching products
      const brandMatches = await this.prisma.brand.findMany({
        where: {
          products: {
            some: {
              OR: [
                { name: { contains: q.search, mode: 'insensitive' } },
                { slug: { contains: q.search, mode: 'insensitive' } },
              ],
              status: ProductStatus.ACTIVE,
              visibility: true,
            },
          },
        },
        take: 10,
      });
      relatedBrands = brandMatches;

      // Get categories that have matching products
      const categoryMatches = await this.prisma.category.findMany({
        where: {
          products: {
            some: {
              OR: [
                { name: { contains: q.search, mode: 'insensitive' } },
                { slug: { contains: q.search, mode: 'insensitive' } },
              ],
              status: ProductStatus.ACTIVE,
              visibility: true,
            },
          },
        },
        take: 10,
      });
      relatedCategories = categoryMatches;
    }

    return {
      ...paged,
      data: paged.data,
      meta: paged.meta,
      brands: relatedBrands.length > 0 ? relatedBrands : undefined,
      categories: relatedCategories.length > 0 ? relatedCategories : undefined,
    };
  }

  /**
   * Get single product by ID for storefront detail view
   */
  async findOne(productId: string): Promise<any> {
    const cacheKey = `${this.BASE_CACHE}:${productId}`;
    let cached: any = null;
    try {
      cached = await this.redisService.get<any>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }

    // Asynchronously update viewCount in DB
    this.prisma.product
      .update({
        where: { id: productId },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err) => {
        this.logger.error(
          `Failed to increment viewCount for product ${productId}: ${err.message}`,
        );
      });

    if (cached) {
      cached.viewCount = (cached.viewCount ?? 0) + 1;
      // Asynchronously update the cache
      fireAndForget(
        this.redisService.set(cacheKey, cached),
        'update web product view count cache',
      );
      return cached;
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId, status: ProductStatus.ACTIVE, visibility: true },
      include: {
        category: categoryIncludeBreadcrumb,
        brandRef: true,
        variants: {
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
            reviews: {
              // where: { approved: true },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    customer: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        reviews: {
          // where: { approved: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                customer: { select: { name: true } },
              },
            },
          },
        },
        seo: true,
        warehouseStocks: { select: { quantity: true, reserved: true } },
        franchiseStocks: { select: { quantity: true, reserved: true, franchiseId: true } },
        reservations: {
          where: { status: 'ACTIVE' },
          select: { quantity: true, note: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Since product is found, we sync the incremented viewCount to the DB object before mapping/caching
    product.viewCount = (product.viewCount ?? 0) + 1;

    const result = this.mapProductResponse(product as any);
    fireAndForget(
      this.redisService.set(cacheKey, result),
      'set web product cache',
    );

    return result;
  }

  /**
   * Search suggestions / autocomplete by product title, brand, or category
   */
  async suggest(q: string): Promise<any[]> {
    if (!q || q.trim().length < 2) return [];

    const searchTerm = q.trim().toLowerCase();

    // Search in product names & slugs
    const products = await this.prisma.product.findMany({
      where: {
        AND: [
          { status: ProductStatus.ACTIVE, visibility: true },
          {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { slug: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      take: 5,
    });

    // Search in brand names
    const brands = await this.prisma.brand.findMany({
      where: {
        name: { contains: searchTerm, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      take: 3,
    });

    // Search in category names
    const categories = await this.prisma.category.findMany({
      where: {
        name: { contains: searchTerm, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      take: 3,
    });

    return [
      ...products.map((p) => ({
        type: 'product',
        id: p.id,
        name: p.name,
        slug: p.slug,
      })),
      ...brands.map((b) => ({
        type: 'brand',
        id: b.id,
        name: b.name,
        slug: b.slug,
      })),
      ...categories.map((c) => ({
        type: 'category',
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
    ];
  }

  /**
   * Featured products for homepage
   */
  async findFeatured(limit: number = 12): Promise<any[]> {
    const cacheKey = `${this.BASE_CACHE}:featured:${limit}`;
    let cached: any[] | null = null;
    try {
      cached = await this.redisService.get<any[]>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const products = await this.prisma.product.findMany({
      where: {
        isFeatured: true,
        status: ProductStatus.ACTIVE,
        visibility: true,
      },
      orderBy: { createdAt: OrderType.DESC },
      take: Math.min(limit, 50),
      include: {
        category: categoryIncludeBreadcrumb,
        brandRef: true,
        variants: {
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
        seo: true,
        warehouseStocks: { select: { quantity: true, reserved: true } },
        franchiseStocks: { select: { quantity: true, reserved: true, franchiseId: true } },
        reservations: {
          where: { status: 'ACTIVE' },
          select: { quantity: true, note: true },
        },
      },
    });

    const result = products.map((p) => this.mapProductResponse(p as any));
    fireAndForget(
      this.redisService.set(cacheKey, result),
      'set featured web products cache',
    );

    return result;
  }

  /**
   * Products with discounts/deals
   */
  async findDeals(limit: number = 12): Promise<any[]> {
    const cacheKey = `${this.BASE_CACHE}:deals:${limit}`;
    let cached: any[] | null = null;
    try {
      cached = await this.redisService.get<any[]>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    // Fetch candidate products (active & visible) then filter for actual discounts
    const candidates = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, visibility: true },
      orderBy: { createdAt: OrderType.DESC },
      take: Math.min(Math.max(limit * 4, 50), 200),
      include: {
        category: categoryIncludeBreadcrumb,
        brandRef: true,
        variants: {
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
        seo: true,
        warehouseStocks: { select: { quantity: true, reserved: true } },
        franchiseStocks: { select: { quantity: true, reserved: true, franchiseId: true } },
        reservations: {
          where: { status: 'ACTIVE' },
          select: { quantity: true, note: true },
        },
      },
    });

    const discounted = candidates.filter((p: any) => {
      try {
        const baseMrp =
          p.mrpPrice != null ? parseFloat(String(p.mrpPrice)) : null;
        const basePrice = p.price != null ? parseFloat(String(p.price)) : null;
        if (baseMrp != null && basePrice != null && baseMrp > basePrice)
          return true;

        if (Array.isArray(p.variants)) {
          for (const v of p.variants) {
            const vmrp =
              v.mrpPrice != null ? parseFloat(String(v.mrpPrice)) : null;
            const vprice = v.price != null ? parseFloat(String(v.price)) : null;
            if (vmrp != null && vprice != null && vmrp > vprice) return true;
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Error checking discount for product ${p.id}: ${err?.message as string}`,
        );
      }
      return false;
    });

    const result = discounted
      .slice(0, limit)
      .map((p) => this.mapProductResponse(p as any));
    fireAndForget(
      this.redisService.set(cacheKey, result),
      'set deals web products cache',
    );

    return result;
  }

  /**
   * Recommended products based on popularity and ratings
   */
  async findRecommended(limit: number = 12): Promise<any[]> {
    const cacheKey = `${this.BASE_CACHE}:recommended:${limit}`;
    let cached: any[] | null = null;
    try {
      cached = await this.redisService.get<any[]>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const products = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        visibility: true,
        ratingAvg: { gte: new Prisma.Decimal(3.5) },
      },
      orderBy: [{ ratingAvg: OrderType.DESC }],
      take: 100, // Fetch more to allow in-memory filtering of out-of-stock items
      include: {
        category: categoryIncludeBreadcrumb,
        brandRef: true,
        variants: {
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
        seo: true,
        warehouseStocks: { select: { quantity: true, reserved: true } },
        franchiseStocks: { select: { quantity: true, reserved: true, franchiseId: true } },
        reservations: {
          where: { status: 'ACTIVE' },
          select: { quantity: true, note: true },
        },
      },
    });

    const mapped = products.map((p) => this.mapProductResponse(p as any));
    const filtered = mapped.filter((p) => {
      if (p.variants && p.variants.length > 0) {
        p.variants = p.variants.filter((v: any) => v.stock > 0);
        return p.variants.length > 0;
      } else {
        return p.stock > 0;
      }
    });

    const result = filtered.slice(0, limit);
    fireAndForget(
      this.redisService.set(cacheKey, result),
      'set recommended web products cache',
    );

    return result;
  }

  /**
   * Related products (same category as the given product)
   */
  async findRelated(productId: string, limit: number = 8): Promise<any[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });

    if (!product || !product.categoryId) return [];

    const cacheKey = `${this.BASE_CACHE}:related:${productId}:${limit}`;
    let cached: any[] | null = null;
    try {
      cached = await this.redisService.get<any[]>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const related = await this.prisma.product.findMany({
      where: {
        AND: [
          { categoryId: product.categoryId },
          { id: { not: productId } },
          { status: ProductStatus.ACTIVE, visibility: true },
        ],
      },
      orderBy: [{ createdAt: OrderType.DESC }],
      take: Math.min(limit, 50),
      include: {
        category: categoryIncludeBreadcrumb,
        brandRef: true,
        variants: {
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
        seo: true,
        warehouseStocks: { select: { quantity: true, reserved: true } },
        franchiseStocks: { select: { quantity: true, reserved: true, franchiseId: true } },
        reservations: {
          where: { status: 'ACTIVE' },
          select: { quantity: true, note: true },
        },
      },
    });

    const result = related.map((p) => this.mapProductResponse(p as any));
    fireAndForget(
      this.redisService.set(cacheKey, result),
      'set related web products cache',
    );

    return result;
  }

  async tredingProduct(limit: number = 20): Promise<any[]> {
    const cacheKey = `${this.BASE_CACHE}:trending:${limit}`;
    let cached: any[] | null = null;
    try {
      cached = await this.redisService.get<any[]>(cacheKey);
    } catch (err) {
      this.logger.error(
        `Redis get error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (cached) return cached;

    let products: any[] = [];
    try {
      products = await this.prisma.product.findMany({
        where: {
          status: ProductStatus.ACTIVE,
          visibility: true,
        },
        include: {
          category: categoryWebListSelect,
          brandRef: {
            select: {
              id: true,
              name: true,
              description: true,
              slug: true,
              imageUrl: true,
            },
          },
          variants: {
            where: {
              isActive: true,
            },
            include: {
              _count: {
                select: {
                  orderItems: true,
                },
              },
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
          _count: {
            select: {
              orderItems: true,
            },
          },
          warehouseStocks: { select: { quantity: true, reserved: true } },
          franchiseStocks: { select: { quantity: true, reserved: true, franchiseId: true } },
          reservations: {
            where: { status: 'ACTIVE' },
            select: { quantity: true, note: true },
          },
        },
      });
    } catch (err) {
      this.logger.error(
        `Prisma error fetching trending products: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new Error('Failed to fetch trending products');
    }

    const flatList: any[] = [];
    for (const p of products) {
      const reservedByVariant = new Map<string, number>();
      if (Array.isArray(p.reservations)) {
        for (const r of p.reservations) {
          if (r.note && r.note.includes('__variantId:')) {
            const match = r.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
            if (match && match[1]) {
              const vId = match[1];
              reservedByVariant.set(vId, (reservedByVariant.get(vId) ?? 0) + r.quantity);
            }
          }
        }
      }

      if (!p.variants || p.variants.length === 0) {
        const displayStock = this.getDisplayStock(p);
        if (displayStock > 0) {
          flatList.push({
            id: p.id,
            productId: p.id,
            variantId: null,
            name: p.name,
            slug: p.slug,
            description: p.description,
            price: p.price ? Number(p.price) : 0,
            mrpPrice: p.mrpPrice ? Number(p.mrpPrice) : null,
            stock: displayStock,
            imageUrl: p.imageUrl,
            imageUrls: p.imageUrls,
            ratingAvg: p.ratingAvg ? Number(p.ratingAvg) : 0,
            ratingCount: p.reviewCount ?? 0,
            viewCount: p.viewCount ?? 0,
            orderCount: p._count?.orderItems ?? 0,
            category: p.category,
            brandRef: p.brandRef,
            createdAt: p.createdAt,
            isVariant: false,
          });
        }
      } else {
        for (const v of p.variants) {
          const reservedQty = reservedByVariant.get(v.id) ?? 0;
          const displayStock = Math.max(0, (v.stock ?? 0) - reservedQty);
          if (displayStock > 0) {
            flatList.push({
              id: v.id,
              productId: p.id,
              variantId: v.id,
              name: `${p.name} - ${v.attributeSummary}`,
              slug: p.slug,
              description: p.description,
              sku: v.sku,
              price: v.price ? Number(v.price) : 0,
              mrpPrice: v.mrpPrice ? Number(v.mrpPrice) : null,
              stock: displayStock,
              imageUrl: v.imageUrl || p.imageUrl,
              imageUrls: v.imageUrls || p.imageUrls,
              ratingAvg: v.ratingAvg ? Number(v.ratingAvg) : 0,
              ratingCount: v.reviewCount ?? 0,
              viewCount: p.viewCount ?? 0,
              orderCount: v._count?.orderItems ?? 0,
              category: p.category,
              brandRef: p.brandRef,
              createdAt: v.createdAt,
              attributes: Array.isArray(v.attributes)
                ? v.attributes.map((attr: any) => ({
                    ...attr,
                    attributeName: attr.attributeValue?.attributeName?.title || null,
                    attributeValue: attr.attributeValue?.title || null,
                  }))
                : [],
              isVariant: true,
            });
          }
        }
      }
    }

    const getGroup = (item: any) => {
      const isHighOrder = item.orderCount >= 1;
      const isHighRating = item.ratingAvg >= 4.0;
      const isHighView = item.viewCount >= 5;

      if (isHighOrder && isHighRating && isHighView) return 1;
      if (isHighOrder) return 2;
      if (isHighRating) return 3;
      if (isHighView) return 4;
      return 5;
    };

    flatList.sort((a, b) => {
      const groupA = getGroup(a);
      const groupB = getGroup(b);

      if (groupA !== groupB) {
        return groupA - groupB;
      }

      if (groupA === 1) {
        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
        if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg;
        return b.viewCount - a.viewCount;
      }
      if (groupA === 2) {
        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
        if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg;
        return b.viewCount - a.viewCount;
      }
      if (groupA === 3) {
        if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg;
        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
        return b.viewCount - a.viewCount;
      }
      if (groupA === 4) {
        if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount;
        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
        return b.ratingAvg - a.ratingAvg;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const result = flatList.slice(0, limit);

    fireAndForget(
      this.redisService.set(cacheKey, result),
      'set trending web products cache',
    );

    return result;
  }
}
