import { BadRequestException, Injectable } from '@nestjs/common';
import { DiscountScope, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogPromotionService } from '../../promotions/catalog-promotion.service';

export type DiscountQuoteItemInput = {
  productId: string;
  quantity: number;
  baseUnitPrice: Prisma.Decimal | number | string;
};

export type DiscountQuoteItem = {
  productId: string;
  quantity: number;
  baseUnitPrice: Prisma.Decimal;
  promoPercentOff: number;
  promoDiscountAmount: Prisma.Decimal;
  couponDiscountAmount: Prisma.Decimal;
  netUnitPrice: Prisma.Decimal;
  netLineSubtotal: Prisma.Decimal;
  totalDiscountAmount: Prisma.Decimal;
};

export type DiscountQuote = {
  discountCode: string | null;
  couponId: string | null;
  couponName: string | null;
  couponType: DiscountType | null;
  couponScope: DiscountScope | null;
  subtotal: Prisma.Decimal;
  promoDiscountAmount: Prisma.Decimal;
  couponDiscountAmount: Prisma.Decimal;
  shippingDiscountAmount: Prisma.Decimal;
  cashbackAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  shippingFee: Prisma.Decimal;
  items: DiscountQuoteItem[];
};

@Injectable()
export class OrderDiscountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogPromotionService: CatalogPromotionService,
  ) {}

  async bestPercentOffByProductId(
    productIds: string[],
  ): Promise<Map<string, number>> {
    return this.catalogPromotionService.bestPercentOffByProductId(productIds);
  }

  async quoteOrderDiscounts(input: {
    items: DiscountQuoteItemInput[];
    discountCode?: string | null;
    shippingFee?: Prisma.Decimal | number | string;
    isPickup?: boolean;
    tx?: Prisma.TransactionClient;
    customerId?: string | null;
  }): Promise<DiscountQuote> {
    const items = input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      baseUnitPrice: new Prisma.Decimal(item.baseUnitPrice),
    }));
    const productIds = items.map((item) => item.productId);
    const promoMap = await this.bestPercentOffByProductId(productIds);

    let subtotal = new Prisma.Decimal(0);
    let promoDiscountAmount = new Prisma.Decimal(0);

    const quotedItems: DiscountQuoteItem[] = items.map((item) => {
      const promoPercentOff = promoMap.get(item.productId) ?? 0;
      const promoDiscountAmountForLine =
        promoPercentOff > 0
          ? item.baseUnitPrice
              .mul(item.quantity)
              .mul(new Prisma.Decimal(promoPercentOff).div(100))
              .toDecimalPlaces(2)
          : new Prisma.Decimal(0);
      const netLineSubtotal = item.baseUnitPrice
        .mul(item.quantity)
        .sub(promoDiscountAmountForLine)
        .toDecimalPlaces(2);

      subtotal = subtotal.add(item.baseUnitPrice.mul(item.quantity));
      promoDiscountAmount = promoDiscountAmount.add(promoDiscountAmountForLine);

      return {
        productId: item.productId,
        quantity: item.quantity,
        baseUnitPrice: item.baseUnitPrice,
        promoPercentOff,
        promoDiscountAmount: promoDiscountAmountForLine,
        couponDiscountAmount: new Prisma.Decimal(0),
        netUnitPrice:
          item.quantity > 0
            ? netLineSubtotal.div(item.quantity).toDecimalPlaces(2)
            : item.baseUnitPrice,
        netLineSubtotal,
        totalDiscountAmount: promoDiscountAmountForLine,
      };
    });

    let shippingFee = new Prisma.Decimal(0);
    if (!input.isPickup) {
      if (subtotal.lt(1500)) {
        shippingFee = new Prisma.Decimal(99);
      }
    }

    const couponCode = input.discountCode?.trim() || null;
    let couponDiscountAmount = new Prisma.Decimal(0);
    let shippingDiscountAmount = new Prisma.Decimal(0);
    let cashbackAmount = new Prisma.Decimal(0);
    let couponId: string | null = null;
    let couponName: string | null = null;
    let couponType: DiscountType | null = null;
    let couponScope: DiscountScope | null = null;

    if (couponCode) {
      const prismaClient = input.tx ?? this.prisma;
      const discount = await prismaClient.discount.findUnique({
        where: { code: couponCode },
      });

      if (!discount) {
        throw new BadRequestException(`Discount code ${couponCode} is invalid`);
      }
      if (discount.createdBy && discount.createdBy !== input.customerId) {
        throw new BadRequestException(`Discount code ${couponCode} is invalid`);
      }
      if (input.customerId) {
        const pendingRequest = await prismaClient.orderRequest.findFirst({
          where: {
            customerId: input.customerId,
            status: { in: ['SEARCHING_FRANCHISE', 'PROPOSAL_SENT'] },
            discountCode: couponCode,
          },
        });
        if (pendingRequest) {
          throw new BadRequestException(
            `Discount code ${couponCode} is currently in use in a pending order request`,
          );
        }
      }
      if (!discount.active) {
        throw new BadRequestException(
          `Discount code ${couponCode} is inactive`,
        );
      }

      const now = new Date();
      if (discount.startsAt && now < discount.startsAt) {
        throw new BadRequestException(
          `Discount code ${couponCode} is not active yet`,
        );
      }
      if (discount.endsAt && now > discount.endsAt) {
        throw new BadRequestException(
          `Discount code ${couponCode} has expired`,
        );
      }
      if (
        discount.usageLimit != null &&
        discount.usedCount >= discount.usageLimit
      ) {
        throw new BadRequestException(
          `Discount code ${couponCode} is exhausted`,
        );
      }

      couponId = discount.id;
      couponName = discount.name;
      couponType = discount.type;
      couponScope = discount.scope;

      const eligibleBase = this.getEligibleBaseAmount(
        discount.scope,
        subtotal.sub(promoDiscountAmount),
        shippingFee,
      );

      if (discount.type === DiscountType.BUY_X_GET_Y) {
        throw new BadRequestException(
          'BUY_X_GET_Y discounts are not supported by the current order schema',
        );
      }

      if (discount.type === DiscountType.CASHBACK) {
        cashbackAmount = this.normalizeAmount(
          this.resolveCouponValue(discount, eligibleBase),
          eligibleBase,
        );
      } else if (discount.type === DiscountType.FREE_SHIPPING) {
        shippingDiscountAmount = this.normalizeAmount(shippingFee, shippingFee);
      } else {
        const rawCouponDiscount = this.resolveCouponValue(
          discount,
          eligibleBase,
        );
        const effectiveCouponDiscount = this.normalizeAmount(
          rawCouponDiscount,
          eligibleBase,
        );
        couponDiscountAmount = effectiveCouponDiscount;
      }
    }

    const netSubtotalAfterPromo = subtotal.sub(promoDiscountAmount);
    const grandTotal = netSubtotalAfterPromo
      .sub(couponDiscountAmount)
      .add(shippingFee)
      .sub(shippingDiscountAmount)
      .toDecimalPlaces(2);

    const lineCouponAllocation = this.allocateCouponAcrossLines(
      quotedItems,
      couponDiscountAmount,
    );

    quotedItems.forEach((item, index) => {
      item.couponDiscountAmount =
        lineCouponAllocation[index] ?? new Prisma.Decimal(0);
      item.totalDiscountAmount = item.promoDiscountAmount.add(
        item.couponDiscountAmount,
      );
      item.netLineSubtotal = item.baseUnitPrice
        .mul(item.quantity)
        .sub(item.totalDiscountAmount)
        .toDecimalPlaces(2);
      item.netUnitPrice =
        item.quantity > 0
          ? item.netLineSubtotal.div(item.quantity).toDecimalPlaces(2)
          : item.baseUnitPrice;
    });

    return {
      discountCode: couponCode,
      couponId,
      couponName,
      couponType,
      couponScope,
      subtotal: subtotal.toDecimalPlaces(2),
      promoDiscountAmount: promoDiscountAmount.toDecimalPlaces(2),
      couponDiscountAmount: couponDiscountAmount.toDecimalPlaces(2),
      shippingDiscountAmount: shippingDiscountAmount.toDecimalPlaces(2),
      cashbackAmount: cashbackAmount.toDecimalPlaces(2),
      grandTotal: (grandTotal.isNegative()
        ? new Prisma.Decimal(0)
        : grandTotal
      ).toDecimalPlaces(2),
      shippingFee: shippingFee.toDecimalPlaces(2),
      items: quotedItems,
    };
  }

  async consumeCouponUsage(
    tx: Prisma.TransactionClient,
    input: {
      discountCode?: string | null;
      customerId: string;
      orderId: string;
    },
  ) {
    const code = input.discountCode?.trim();
    if (!code) {
      return null;
    }

    const existing = await tx.discountUsage.findFirst({
      where: {
        orderId: input.orderId,
      },
    });
    if (existing) {
      return existing;
    }

    const discount = await tx.discount.findUnique({
      where: { code },
    });
    if (!discount) {
      throw new BadRequestException(`Discount code ${code} is invalid`);
    }
    if (discount.createdBy && discount.createdBy !== input.customerId) {
      throw new BadRequestException(`Discount code ${code} is invalid`);
    }
    if (!discount.active) {
      throw new BadRequestException(`Discount code ${code} is inactive`);
    }
    if (
      discount.usageLimit != null &&
      discount.usedCount >= discount.usageLimit
    ) {
      throw new BadRequestException(`Discount code ${code} is exhausted`);
    }

    const updated = await tx.discount.updateMany({
      where: {
        id: discount.id,
        OR: [
          { usageLimit: null },
          { usedCount: { lt: discount.usageLimit ?? Number.MAX_SAFE_INTEGER } },
        ],
      },
      data: {
        usedCount: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new BadRequestException(`Discount code ${code} is exhausted`);
    }

    return tx.discountUsage.create({
      data: {
        discountId: discount.id,
        customerId: input.customerId,
        orderId: input.orderId,
      },
    });
  }

  async releaseCouponUsage(
    tx: Prisma.TransactionClient,
    input: {
      discountCode?: string | null;
      orderId: string;
    },
  ) {
    const code = input.discountCode?.trim();
    if (!code) {
      return null;
    }

    const discount = await tx.discount.findUnique({
      where: { code },
    });
    if (!discount) {
      return null;
    }

    const usage = await tx.discountUsage.findFirst({
      where: {
        discountId: discount.id,
        orderId: input.orderId,
      },
    });
    if (!usage) {
      return null;
    }

    await tx.discountUsage.delete({
      where: { id: usage.id },
    });

    if (discount.usedCount > 0) {
      await tx.discount.update({
        where: { id: discount.id },
        data: {
          usedCount: { decrement: 1 },
        },
      });
    }

    return usage;
  }

  private resolveCouponValue(
    discount: {
      type: DiscountType;
      scope: DiscountScope;
      value: Prisma.Decimal;
      maxDiscountAmount: Prisma.Decimal | null;
    },
    eligibleBase: Prisma.Decimal,
  ): Prisma.Decimal {
    if (eligibleBase.lte(0)) {
      return new Prisma.Decimal(0);
    }

    let amount = new Prisma.Decimal(0);
    if (discount.type === DiscountType.PERCENTAGE) {
      amount = eligibleBase.mul(discount.value).div(100);
    } else if (discount.type === DiscountType.FIXED_AMOUNT) {
      amount = new Prisma.Decimal(discount.value);
    } else if (discount.type === DiscountType.CASHBACK) {
      amount = new Prisma.Decimal(discount.value);
    }

    if (discount.maxDiscountAmount != null) {
      const cap = new Prisma.Decimal(discount.maxDiscountAmount);
      if (amount.gt(cap)) {
        amount = cap;
      }
    }

    return amount;
  }

  private getEligibleBaseAmount(
    scope: DiscountScope,
    subtotalAfterPromo: Prisma.Decimal,
    shippingFee: Prisma.Decimal,
  ): Prisma.Decimal {
    if (scope === DiscountScope.SHIPPING) {
      return shippingFee;
    }
    return subtotalAfterPromo;
  }

  private normalizeAmount(
    value: Prisma.Decimal,
    ceiling: Prisma.Decimal,
  ): Prisma.Decimal {
    if (ceiling.lte(0)) {
      return new Prisma.Decimal(0);
    }
    return (value.gt(ceiling) ? ceiling : value).toDecimalPlaces(2);
  }

  private allocateCouponAcrossLines(
    items: DiscountQuoteItem[],
    couponDiscountAmount: Prisma.Decimal,
  ): Prisma.Decimal[] {
    if (couponDiscountAmount.lte(0) || items.length === 0) {
      return items.map(() => new Prisma.Decimal(0));
    }

    const subtotalAfterPromo = items.reduce(
      (sum, item) => sum.add(item.netLineSubtotal),
      new Prisma.Decimal(0),
    );
    if (subtotalAfterPromo.lte(0)) {
      return items.map(() => new Prisma.Decimal(0));
    }

    const allocations: Prisma.Decimal[] = [];
    let allocated = new Prisma.Decimal(0);

    items.forEach((item, index) => {
      if (index === items.length - 1) {
        allocations.push(
          couponDiscountAmount.sub(allocated).toDecimalPlaces(2),
        );
        return;
      }
      const share = item.netLineSubtotal
        .div(subtotalAfterPromo)
        .mul(couponDiscountAmount)
        .toDecimalPlaces(2);
      allocations.push(share);
      allocated = allocated.add(share);
    });

    return allocations;
  }
}
