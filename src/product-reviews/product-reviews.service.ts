import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Order, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetProductReviewQueryDto } from './dto/get-product-review-query.dto';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { UpdateProductReviewDto } from './dto/update-product-review.dto';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';
import { ConfigService } from '@nestjs/config';

// Reusable Prisma include object strictly typed
const reviewInclude = {
  user: {
    select: { id: true, email: true, customer: { select: { name: true } } },
  },
  product: { select: { id: true, name: true, imageUrl: true } },
  variant: { select: { id: true, sku: true } },
  order: { select: { id: true, orderNumber: true } },
} satisfies Prisma.ProductReviewInclude;

@Injectable()
export class ProductReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('retention') private readonly retentionQueue: Queue,
    private readonly redisService: RedisService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Helper to recalculate average rating and total count inside a transaction
   */
  private async recalculateProductRating(
    tx: Prisma.TransactionClient,
    productId: string,
    variantId?: string | null,
  ): Promise<void> {
    const stats = await tx.productReview.aggregate({
      where: {
        productId,
        // approved: true,
      },
      _count: { id: true },
      _avg: { rating: true },
    });

    const reviewCount = stats._count.id;
    const ratingAvg = stats._avg.rating
      ? Number(stats._avg.rating.toFixed(2))
      : 0;

    await tx.product.update({
      where: { id: productId },
      data: { reviewCount, ratingAvg },
    });

    if (variantId) {
      const variantStats = await tx.productReview.aggregate({
        where: {
          variantId,
          // approved: true,
        },
        _count: { id: true },
        _avg: { rating: true },
      });

      const varReviewCount = variantStats._count.id;
      const varRatingAvg = variantStats._avg.rating
        ? Number(variantStats._avg.rating.toFixed(2))
        : 0;

      await tx.productVariant.update({
        where: { id: variantId },
        data: { reviewCount: varReviewCount, ratingAvg: varRatingAvg },
      });
    }
  }

  private resolvePublicUrl(urlOrKey: string): string {
    const awsPrefix =
      this.config.get<string>('AWS_PREFIX_URL') ?? process.env.AWS_PREFIX_URL;
    const normalizedPrefix = awsPrefix?.replace(/\/$/, '');

    if (!urlOrKey) return urlOrKey;

    if (normalizedPrefix && urlOrKey.startsWith(normalizedPrefix)) {
      return urlOrKey;
    }

    let key = urlOrKey;
    if (/^https?:\/\//i.test(urlOrKey)) {
      try {
        const parsed = new URL(urlOrKey);
        key = parsed.pathname.startsWith('/')
          ? parsed.pathname.slice(1)
          : parsed.pathname;
      } catch (e) {
        // fallback
      }
    }

    if (normalizedPrefix) {
      return `${normalizedPrefix}/${key}`;
    }

    return urlOrKey;
  }

  private applyAwsPrefixToReview<T extends Record<string, any>>(r: T): T {
    if (!r) return r;
    const copy = { ...r } as any;
    if (copy.images && Array.isArray(copy.images)) {
      copy.images = copy.images.map((img: string) =>
        this.resolvePublicUrl(img),
      );
    }
    if (copy.videos && Array.isArray(copy.videos)) {
      copy.videos = copy.videos.map((vid: string) =>
        this.resolvePublicUrl(vid),
      );
    }
    return copy;
  }

  private cleanAwsPrefix(urlOrKey: string): string {
    if (!urlOrKey) return urlOrKey;

    const awsPrefix =
      this.config.get<string>('AWS_PREFIX_URL') ?? process.env.AWS_PREFIX_URL;
    const normalizedPrefix = awsPrefix?.replace(/\/$/, '');

    let key = urlOrKey.trim();

    if (normalizedPrefix && key.startsWith(normalizedPrefix)) {
      key = key.slice(normalizedPrefix.length);
    } else if (/^https?:\/\//i.test(key)) {
      try {
        const parsed = new URL(key);
        key = parsed.pathname;
      } catch (e) {
        // fallback
      }
    }

    if (key.startsWith('/')) {
      key = key.slice(1);
    }

    return key;
  }

  /**
   * Helper to build dynamic Prisma WHERE clauses for reviews
   */
  private buildWhereClause(
    query: GetProductReviewQueryDto,
  ): Prisma.ProductReviewWhereInput {
    const where: Prisma.ProductReviewWhereInput = {};

    if (query.productId) where.productId = query.productId;
    if (query.userId) where.userId = query.userId;
    if (query.approved)
      where.approved = query.approved === BooleanEnum.TRUE ? true : false;
    if (query.rating) where.rating = query.rating;
    if (query.search) {
      where.comment = { contains: query.search, mode: 'insensitive' };
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = query.fromDate;
      if (query.toDate) where.createdAt.lte = query.toDate;
    }

    return where;
  }

  async create(user: JwtUser, dto: CreateProductReviewDto, ip: string) {
    const { sub: userId, customerId } = user;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verify Order exists and belongs to user
      // Note: Assuming 'items' is the relation name for OrderItem. Adjust if your schema uses a different name.
      const order: Order = await tx.order.findUnique({
        where: { id: dto.orderId, customer: { userId: user.sub } },
        include: { items: true },
      });

      if (!order) throw new NotFoundException('Order not found');
      if (order.customerId !== userId && order.customerId !== customerId)
        throw new ForbiddenException(
          'Order does not belong to the logged-in user',
        );

      // 2. Verify Order status is complete or delivered
      // Note: Typecasting status to any to bypass strict enum checks if not explicitly typed in this snippet
      const status = (order as any).status;
      if (status !== 'COMPLETED' && status !== 'DELIVERED') {
        throw new BadRequestException(
          'Order must be completed or delivered to submit a review',
        );
      }

      // 3. Verify Product exists
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
      });
      if (!product) throw new NotFoundException('Product not found');

      // 4. Verify product exists in OrderItem
      const purchasedItem = (order as any).items.find(
        (item: any) =>
          item.productId === dto.productId &&
          (!dto.variantId || item.variantId === dto.variantId),
      );

      if (!purchasedItem) {
        throw new BadRequestException(
          'Product or specific variant was not found in this order',
        );
      }

      // 5. Prevent duplicate reviews
      const existingReview = await tx.productReview.findUnique({
        where: {
          userId_productId_orderId: {
            userId,
            productId: dto.productId,
            orderId: dto.orderId,
          },
        },
      });

      if (existingReview) {
        throw new ConflictException(
          'You have already reviewed this product from this order',
        );
      }

      // 6. Create Review
      const review = await tx.productReview.create({
        data: {
          userId,
          productId: dto.productId,
          orderId: dto.orderId,
          variantId: dto.variantId,
          rating: dto.rating,
          comment: dto.comment,
          images: dto.images ? dto.images.map((img: string) => this.cleanAwsPrefix(img)) : [],
          videos: dto.videos ? dto.videos.map((vid: string) => this.cleanAwsPrefix(vid)) : [],
          approved: false, // Always false initially
        },
        include: reviewInclude,
      });

      // Recalculate (even though it's unapproved, doing so handles consistency)
      await this.recalculateProductRating(tx, dto.productId, dto.variantId);

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'CREATE_PRODUCT_REVIEW_CREATE',
          resource: 'ProductReview',
          resourceId: review.id,
          metadata: {
            productId: review.productId,
            variantId: review.variantId,
            rating: review.rating,
            comment: review.comment,
          },
          ip,
        }),
        'CREATE_PRODUCT_REVIEW',
      );

      return review;
    });

    // Invalidate storefront cache post-commit
    fireAndForget(
      this.redisService.del([`web_product:${dto.productId}`]),
      'invalidate web product reviews cache',
    );

    return this.applyAwsPrefixToReview(result);
  }

  async findAllPaginated(query: GetProductReviewQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(query);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.productReview.count({ where }),
      this.prisma.productReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: reviewInclude,
      }),
    ]);

    return {
      data: data.map((r) => this.applyAwsPrefixToReview(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAll(query: GetProductReviewQueryDto) {
    const where = this.buildWhereClause(query);

    const reviews = await this.prisma.productReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: reviewInclude,
    });
    return reviews.map((r) => this.applyAwsPrefixToReview(r));
  }

  async findOne(id: string) {
    const review = await this.prisma.productReview.findUnique({
      where: { id },
      include: reviewInclude,
    });

    if (!review) throw new NotFoundException('Review not found');
    return this.applyAwsPrefixToReview(review);
  }

  async update(
    id: string,
    user: JwtUser,
    dto: UpdateProductReviewDto,
    ip: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existingReview = await tx.productReview.findUnique({
        where: { id },
      });
      if (!existingReview) throw new NotFoundException('Review not found');

      const isAdmin =
        user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;
      const isOwner = existingReview.userId === user.sub;

      if (!isAdmin && !isOwner) {
        throw new ForbiddenException(
          'You do not have permission to update this review',
        );
      }

      const updateData: Prisma.ProductReviewUpdateInput = {};

      if (isOwner && !isAdmin) {
        if (dto.approved !== undefined) {
          throw new ForbiddenException(
            'Customers cannot approve or unapprove reviews',
          );
        }
        if (dto.rating !== undefined) updateData.rating = dto.rating;
        if (dto.comment !== undefined) updateData.comment = dto.comment;
        if (dto.images !== undefined) {
          const cleanedIncoming = dto.images.map((img: string) => this.cleanAwsPrefix(img));
          const cleanedExisting = existingReview.images.map((img: string) => this.cleanAwsPrefix(img));
          
          if (dto.images.length === 0) {
            updateData.images = [];
          } else {
            const hasIntersection = cleanedIncoming.some((img: string) => cleanedExisting.includes(img));
            if (hasIntersection) {
              updateData.images = cleanedIncoming;
            } else {
              updateData.images = Array.from(new Set([...cleanedExisting, ...cleanedIncoming]));
            }
          }
        }
        if (dto.videos !== undefined) {
          const cleanedIncoming = dto.videos.map((vid: string) => this.cleanAwsPrefix(vid));
          const cleanedExisting = existingReview.videos.map((vid: string) => this.cleanAwsPrefix(vid));
          
          if (dto.videos.length === 0) {
            updateData.videos = [];
          } else {
            const hasIntersection = cleanedIncoming.some((vid: string) => cleanedExisting.includes(vid));
            if (hasIntersection) {
              updateData.videos = cleanedIncoming;
            } else {
              updateData.videos = Array.from(new Set([...cleanedExisting, ...cleanedIncoming]));
            }
          }
        }
      }

      // Admin logic
      if (isAdmin) {
        if (dto.approved !== undefined) updateData.approved = dto.approved;
        if (dto.rating !== undefined) updateData.rating = dto.rating;
        if (dto.comment !== undefined) updateData.comment = dto.comment;
        if (dto.images !== undefined) {
          const cleanedIncoming = dto.images.map((img: string) => this.cleanAwsPrefix(img));
          const cleanedExisting = existingReview.images.map((img: string) => this.cleanAwsPrefix(img));
          
          if (dto.images.length === 0) {
            updateData.images = [];
          } else {
            const hasIntersection = cleanedIncoming.some((img: string) => cleanedExisting.includes(img));
            if (hasIntersection) {
              updateData.images = cleanedIncoming;
            } else {
              updateData.images = Array.from(new Set([...cleanedExisting, ...cleanedIncoming]));
            }
          }
        }
        if (dto.videos !== undefined) {
          const cleanedIncoming = dto.videos.map((vid: string) => this.cleanAwsPrefix(vid));
          const cleanedExisting = existingReview.videos.map((vid: string) => this.cleanAwsPrefix(vid));
          
          if (dto.videos.length === 0) {
            updateData.videos = [];
          } else {
            const hasIntersection = cleanedIncoming.some((vid: string) => cleanedExisting.includes(vid));
            if (hasIntersection) {
              updateData.videos = cleanedIncoming;
            } else {
              updateData.videos = Array.from(new Set([...cleanedExisting, ...cleanedIncoming]));
            }
          }
        }
      }

      if (Object.keys(updateData).length === 0) {
        return tx.productReview.findUnique({
          where: { id },
          include: reviewInclude,
        });
      }

      const wasApprovedBefore = existingReview.approved;

      const updatedReview = await tx.productReview.update({
        where: { id },
        data: updateData,
        include: reviewInclude,
      });

      // Recalculate if approval status or rating changed
      if (dto.approved !== undefined || dto.rating !== undefined) {
        await this.recalculateProductRating(
          tx,
          updatedReview.productId,
          updatedReview.variantId,
        );
      }

      if (!wasApprovedBefore && updatedReview.approved) {
        void this.retentionQueue.add('review.approved', {
          reviewId: updatedReview.id,
        });
      }

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'PRODUCT_REVIEW_UPDATE',
          resource: 'ProductReview',
          resourceId: id,
          metadata: {
            productId: existingReview.productId,
            variantId: existingReview.variantId,
            rating: existingReview.rating,
            comment: existingReview.comment,
          },
          ip,
        }),
        'PRODUCT_REVIEW_UPDATE ',
      );

      return updatedReview;
    });

    // Invalidate storefront cache post-commit
    fireAndForget(
      this.redisService.del([`web_product:${result.productId}`]),
      'invalidate web product reviews cache',
    );

    return this.applyAwsPrefixToReview(result);
  }

  async remove(id: string, user: JwtUser, ip: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existingReview = await tx.productReview.findUnique({
        where: { id },
      });
      if (!existingReview) throw new NotFoundException('Review not found');

      const isAdmin =
        user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;
      const isOwner = existingReview.userId === user.sub;

      if (!isAdmin && !isOwner) {
        throw new ForbiddenException(
          'You do not have permission to delete this review',
        );
      }

      await tx.productReview.delete({ where: { id } });

      // Recalculate to adjust totals
      await this.recalculateProductRating(
        tx,
        existingReview.productId,
        existingReview.variantId,
      );

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'PRODUCT_REVIEW_DELETED',
          resource: 'ProductReview',
          resourceId: id,
          metadata: {
            productId: existingReview.productId,
            variantId: existingReview.variantId,
            rating: existingReview.rating,
            comment: existingReview.comment,
          },
          ip,
        }),
        'PRODUCT_REVIEW_DELETED ',
      );

      return {
        success: true,
        message: 'Review successfully deleted',
        productId: existingReview.productId,
      };
    });

    // Invalidate storefront cache post-commit
    fireAndForget(
      this.redisService.del([`web_product:${result.productId}`]),
      'invalidate web product reviews cache',
    );

    return { success: true, message: 'Review successfully deleted' };
  }
}
