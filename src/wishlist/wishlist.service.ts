import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';
import { WishlistQueryDto } from './dto/wishlist-query.dto';
import { RetentionService } from 'src/retention/retention.service';
import { CustomerActivityType } from '@prisma/client';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retentionService: RetentionService,
  ) {}

  async findAll(query: WishlistQueryDto) {
    const { page = 1, limit = 10, productId, variantId, customerId } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (customerId) {
      where.userId = customerId;
    }

    if (productId) where.productId = productId;
    if (variantId) where.variantId = variantId;

    const [data, total] = await Promise.all([
      this.prisma.wishlist.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          variant: true,
        },
      }),
      this.prisma.wishlist.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getWishlistIds(customerId: string) {
    return this.prisma.wishlist.findMany({
      where: { userId: customerId },
      select: {
        id: true,
        productId: true,
        variantId: true,
      },
    });
  }

  async toggle(customerId: string, dto: ToggleWishlistDto) {
    const { productId, variantId } = dto;

    if (!productId && !variantId) {
      throw new BadRequestException(
        'At least one of productId or variantId must be provided.',
      );
    }

    const existingItem = await this.prisma.wishlist.findFirst({
      where: {
        userId: customerId,
        productId: productId || null,
        variantId: variantId || null,
      },
    });

    if (existingItem) {
      await this.prisma.wishlist.delete({
        where: { id: existingItem.id },
      });
      return { action: 'removed', message: 'Item removed from wishlist' };
    }

    const newItem = await this.prisma.wishlist.create({
      data: {
        userId: customerId,
        productId: productId || null,
        variantId: variantId || null,
      },
    });
    if (newItem && newItem.productId) {
      this.retentionService
        .trackActivity(customerId, CustomerActivityType.PRODUCT_WISHLIST, {
          productId: newItem.productId,
          variantId: newItem.variantId || undefined,
        })
        .catch(() => {});
    }

    return {
      action: 'added',
      message: 'Item added to wishlist',
      data: newItem,
    };
  }
}
