import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  FranchiseStatus,
  OnlinePaymentStatus,
  OrderChannel,
  OrderStatus,
  PaymentModeEnum,
  Prisma,
  ProductStatus,
  Role,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { franchiseCanMutate } from '../../common/franchise-roles';
import { CreatePosSaleDto } from '../dto/create-pos-sale.dto';
import { SaleType } from '../enums/order.enum';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

function normalizeRetailPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function billingPartsFromPosDto(dto: CreatePosSaleDto): {
  street: string | null;
  city: string | null;
} {
  const a = dto.billingAddress;
  if (!a || typeof a !== 'object' || Array.isArray(a)) {
    return { street: null, city: null };
  }
  const o = a as Record<string, unknown>;
  const street =
    typeof o.street === 'string' && o.street.trim() ? o.street.trim() : null;
  const city =
    typeof o.city === 'string' && o.city.trim() ? o.city.trim() : null;
  return { street, city };
}

const ORDER_ITEM_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  stock: true,
  gstTax: true,
  features: true,
  status: true,
  visibility: true,
  categoryId: true,
  brandId: true,
  fastDelivery: true,
  isFeatured: true,
  occasions: true,
  ratingAvg: true,
  reviewCount: true,
  defaultGstRatePercent: true,
  imageUrl: true,
  imageUrls: true,
  explicitAttributes: true,
  basePrice: true,
  wholesalePrice: true,
  price: true,
  mrpPrice: true,
  returnWindow: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

@Injectable()
export class OrderPosService {
  private readonly logger = new Logger(OrderPosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,

    @InjectQueue('retention')
    private readonly retentionQueue: Queue,
  ) {}

  async createPosSale(
    dto: CreatePosSaleDto,
    user: JwtUser,
    ip?: string | null,
  ) {
    if (!franchiseCanMutate(user.role)) {
      throw new ForbiddenException('Only franchise staff can record POS sales');
    }
    const franchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;
    if (!franchiseId) {
      throw new BadRequestException('Account is not linked to an outlet');
    }

    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
    });

    if (!franchise || franchise.status !== FranchiseStatus.ACTIVE) {
      throw new BadRequestException('Outlet is not active for sales');
    }

    const productIds = dto.items.map((i) => i.productId);
    const variantIds = Array.from(
      new Set(
        dto.items.map((i) => i.variantId?.trim()).filter(Boolean) as string[],
      ),
    );

    const [products, variants] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds }, status: ProductStatus.ACTIVE },
      }),
      variantIds.length
        ? this.prisma.productVariant.findMany({
            where: { id: { in: variantIds }, isActive: true },
            select: {
              id: true,
              productId: true,
              price: true,
              attributeSummary: true,
              sku: true,
            },
          })
        : Promise.resolve([]),
    ]);

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are invalid');
    }

    if (variants.length !== variantIds.length) {
      throw new BadRequestException('One or more variants are invalid');
    }

    const productById = new Map(products.map((p) => [p.id, p] as const));
    const variantById = new Map(variants.map((v) => [v.id, v] as const));

    const linePricing = dto.items.map((line) => {
      const product = productById.get(line.productId);
      if (!product) {
        throw new BadRequestException(
          `Product ${line.productId} is invalid or inactive`,
        );
      }

      const variantId = line.variantId?.trim() || undefined;
      if (variantId) {
        const variant = variantById.get(variantId);
        if (!variant) {
          throw new BadRequestException(`Variant ${variantId} is invalid`);
        }
        if (variant.productId !== product.id) {
          throw new BadRequestException(
            `Variant ${variantId} does not belong to product ${product.id}`,
          );
        }
        return {
          product,
          variantId,
          unitPrice: variant.price,
        };
      }

      return {
        product,
        variantId: undefined,
        unitPrice: product.price,
      };
    });

    const gstRate =
      dto.gstRatePercent != null && !Number.isNaN(Number(dto.gstRatePercent))
        ? Math.min(28, Math.max(0, Number(dto.gstRatePercent)))
        : 0;

    let subtotal = new Prisma.Decimal(0);
    const lineDetails: Array<{
      productId: string;
      variantId: string | null;
      name: string;
      slug: string;
      quantity: number;
      unitPrice: string;
      mrpPrice: string;
      sku: string | null;
      variantName: string | null;
      lineSubtotal: string;
      lineTax: string;
      lineFinal: string;
    }> = [];

    const lineSubtotals: Prisma.Decimal[] = [];

    for (const [index, line] of dto.items.entries()) {
      const pricing = linePricing[index]!;
      const unit = pricing.unitPrice;
      const lineTotal = unit.mul(line.quantity);
      subtotal = subtotal.add(lineTotal);
      lineSubtotals.push(lineTotal);
    }

    const isInterStateCalculated = dto.isInterState !== false;

    const rateFrac = new Prisma.Decimal(gstRate).div(100);
    const tax = subtotal.mul(rateFrac).toDecimalPlaces(2);

    let cgst = new Prisma.Decimal(0);
    let sgst = new Prisma.Decimal(0);
    let igst = new Prisma.Decimal(0);

    if (gstRate > 0) {
      if (isInterStateCalculated) {
        igst = tax;
      } else {
        const half = tax.div(2).toDecimalPlaces(2);
        cgst = half;
        sgst = tax.sub(half);
      }
    }

    const lineTaxes = lineSubtotals.map((lineSub) =>
      lineSub.mul(rateFrac).toDecimalPlaces(2),
    );

    const lineFinals = lineSubtotals.map((lineSub, index) =>
      lineSub.add(lineTaxes[index] ?? new Prisma.Decimal(0)),
    );

    const grandTotal = subtotal.add(tax);
    const giftWrapRequested = dto.giftWrap === BooleanEnum.TRUE;
    const giftWrapperFee = giftWrapRequested
      ? (subtotal.lt(1500) ? new Prisma.Decimal(49) : new Prisma.Decimal(0))
      : new Prisma.Decimal(0);
    const finalGrandTotal = grandTotal.add(giftWrapperFee);

    for (const [index, line] of dto.items.entries()) {
      const pricing = linePricing[index]!;
      const p = pricing.product;
      const variant = pricing.variantId
        ? variantById.get(pricing.variantId)
        : undefined;

      lineDetails.push({
        productId: p.id,
        variantId: pricing.variantId ?? null,
        name: p.name,
        slug: p.slug,
        quantity: line.quantity,
        unitPrice: pricing.unitPrice.toFixed(2),
        mrpPrice: (p.mrpPrice ?? pricing.unitPrice).toFixed(2),
        sku: variant?.sku ?? null,
        variantName: variant?.attributeSummary ?? null,
        lineSubtotal: (lineSubtotals[index] ?? new Prisma.Decimal(0)).toFixed(
          2,
        ),
        lineTax: (lineTaxes[index] ?? new Prisma.Decimal(0)).toFixed(2),
        lineFinal: (lineFinals[index] ?? new Prisma.Decimal(0)).toFixed(2),
      });
    }

    const created = await this.prisma.$transaction(
      async (tx) => {
        const stocks = await tx.franchiseStock.findMany({
          where: {
            franchiseId,
            productId: { in: productIds },
          },
        });

        const stockMap = new Map(stocks.map((s: any) => [s.productId, s]));

        for (const line of dto.items) {
          const stock: any = stockMap.get(line.productId);
          const available = (stock?.quantity ?? 0) - (stock?.reserved ?? 0);

          if (!stock || available < line.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product ${line.productId}`,
            );
          }
        }

        const phoneNorm = normalizeRetailPhone(dto.customerPhone);
        if (phoneNorm.length < 6) {
          throw new BadRequestException(
            'Customer phone must contain at least 6 digits',
          );
        }
        const { street: billingStreet, city: billingCity } =
          billingPartsFromPosDto(dto);

        const retail = await tx.retailCustomer.upsert({
          where: {
            franchiseId_phoneNorm: { franchiseId, phoneNorm },
          },
          create: {
            franchiseId,
            phoneNorm,
            name: dto.customerName.trim(),
            email: dto.customerEmail?.trim() || null,
            gstin: dto.customerGstin?.trim() || null,
            billingStreet,
            billingCity,
          },
          update: {
            name: dto.customerName.trim(),
            email: dto.customerEmail?.trim() || null,
            gstin: dto.customerGstin?.trim() || null,
            billingStreet,
            billingCity,
          },
        });

        const invoiceNumber = `POS-${franchise.code}-${Date.now().toString(36).toUpperCase()}`;

        const addressJson = JSON.stringify(
          dto.billingAddress ?? {
            type: 'POS_COUNTER',
            customerName: dto.customerName,
            customerPhone: dto.customerPhone,
          },
        );

        const orderStatus =
          dto.saleType === SaleType.WALK_IN
            ? OrderStatus.DELIVERED
            : dto.saleType === SaleType.DELIVERY
              ? OrderStatus.PENDING
              : dto.saleType === SaleType.PICKUP
                ? OrderStatus.CONFIRMED
                : OrderStatus.PENDING;

        const orderRow = await tx.order.create({
          data: {
            orderNumber: `GF-${Date.now().toString(36).toUpperCase()}`,
            saleType: dto.saleType,
            channel: OrderChannel.POS,
            status: orderStatus,
            deliveredAt:
              orderStatus === OrderStatus.DELIVERED ? new Date() : null,
            franchiseId,
            retailCustomerId: retail.id,
            total: finalGrandTotal,
            latitude: franchise.latitude,
            longitude: franchise.longitude,
            addressJson,
            giftMessage: dto.giftMessage ?? dto.notes ?? null,
            giftWrap: dto.giftWrap === BooleanEnum.TRUE,
            giftWrapperFee,
            invoiceNumber,
            paymentMode: dto.paymentMode as PaymentModeEnum,
            onlinePaymentStatus: OnlinePaymentStatus.UNPAID,
            soldByUserId: user.sub,
            referralCode: dto.referralCode ?? null,
            franchisePaybleAmount:
              dto.paymentMode === PaymentModeEnum.CASH
                ? new Prisma.Decimal(0)
                : finalGrandTotal,
            items: {
              create: dto.items.map((line, index) => ({
                productId: line.productId,
                variantId: linePricing[index]!.variantId ?? null,
                quantity: line.quantity,
                unitPrice: linePricing[index]!.unitPrice,
                productName: lineDetails[index]?.name,
                sku: lineDetails[index]?.sku ?? null,
                variantName: lineDetails[index]?.variantName ?? null,
                mrpPrice: linePricing[index]!.product.mrpPrice,
                gstPercent: new Prisma.Decimal(gstRate),
                discountAmount: new Prisma.Decimal(0),
                taxAmount: new Prisma.Decimal(
                  lineDetails[index]?.lineTax ?? '0',
                ),
                finalAmount: new Prisma.Decimal(
                  lineDetails[index]?.lineFinal ?? '0',
                ),
                imageUrl: linePricing[index]!.product.imageUrl,
              })),
            },
            billingSnapshot: {
              kind: 'pos_retail_v1',
              issuedAt: new Date().toISOString(),
              customer: {
                name: dto.customerName,
                phone: dto.customerPhone,
                email: dto.customerEmail ?? null,
                gstin: dto.customerGstin ?? null,
                billingAddress: dto.billingAddress ?? null,
              },
              seller: {
                name: franchise.name,
                code: franchise.code,
                gstin: dto.franchiseGstin ?? null,
                addressLine1: franchise.addressLine1,
                city: franchise.city,
                postalCode: franchise.postalCode,
                country: franchise.country,
              },
              lines: lineDetails,
              totals: {
                subtotal: subtotal.toFixed(2),
                gstRatePercent: gstRate,
                cgst: cgst.toFixed(2),
                sgst: sgst.toFixed(2),
                igst: igst.toFixed(2),
                totalTax: tax.toFixed(2),
                grandTotal: finalGrandTotal.toFixed(2),
                giftWrapperFee: giftWrapperFee.toFixed(2),
              },
              paymentMode: dto.paymentMode,
              notes: dto.giftMessage ?? dto.notes ?? null,
              isInterState: isInterStateCalculated,
              giftWrap: giftWrapRequested,
            } as unknown as Prisma.InputJsonValue,
          },
          include: {
            items: {
              include: {
                product: { select: ORDER_ITEM_PRODUCT_SELECT },
                variant: true,
              },
            },
            franchise: true,
            soldBy: { select: { id: true, email: true } },
            retailCustomer: true,
          },
        });

        return orderRow;
      },
      {
        timeout: 15000,
      },
    );

    try {
      await this.audit.log({
        userId: user.sub,
        action: 'order.pos_sale',
        resource: 'Order',
        resourceId: created.id,
        metadata: {
          orderNumber: created.orderNumber,
        },
        ip: ip ?? null,
      });

      if (created.retailCustomerId && created.retailCustomer) {
        await this.audit.log({
          userId: user.sub,
          action: 'retail_customer.upsert',
          resource: 'RetailCustomer',
          resourceId: created.retailCustomerId,
          metadata: {
            name: created.retailCustomer.name,
            phone: created.retailCustomer.phoneNorm,
            email: created.retailCustomer.email,
          },
          ip: ip ?? null,
        });
      }
    } catch (err) {
      this.logger.error('Audit failed', err);
    }

    if (created.status === OrderStatus.DELIVERED) {
      void this.retentionQueue.add('order.delivered', { orderId: created.id });
    }

    return created;
  }
}
