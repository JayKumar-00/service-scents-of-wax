import {
  BadRequestException,
  Injectable,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';

import {
  CartStatus,
  OrderChannel,
  OrderStatus,
  OnlinePaymentStatus,
  Prisma,
  FranchiseStatus,
  PaymentModeEnum,
  LoyaltyTransactionType,
} from '@prisma/client';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationService } from '../../geo/location.service';
import { buildAddressString } from '../../geo/utils/build-address';
import { FulfillmentPreviewService } from './fulfillment-preview.service';
import { OrderDiscountService } from './order-discount.service';
import { CreateOrderFromCartDto } from '../controllers/dto/allocate-cart-order.dto';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';
import {
  AllocationDto,
  CheckoutPreviewResponseDto,
  UnfulfilledItemDto,
} from '../controllers/dto/checkout-preview.dto';
import { OnlinePaymentMethod } from '../dto/create-order.dto';
import { OrderRequestStatus } from '../../order-allocation/constants/order-allocation.enums';
import { OrderAllocationService } from '../../order-allocation/services/order-allocation.service';
import { ORDER_ALLOCATION_EVENTS } from '../../order-allocation/constants/order-allocation.constants';
import { FulfillmentPreference, SaleType } from '../enums/order.enum';
import { formatVariantName } from 'src/common/utils/variant.util';

function orderNumber(): string {
  return `GF-${Date.now().toString(36).toUpperCase()}`;
}

@Injectable()
export class OrderCartService {
  private readonly logger = new Logger(OrderCartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locationService: LocationService,
    private readonly fulfillmentPreviewService: FulfillmentPreviewService,
    private readonly orderDiscountService: OrderDiscountService,
    @Inject(forwardRef(() => OrderAllocationService))
    private readonly orderAllocationService: OrderAllocationService,
  ) {}

  async createFromCart(
    cartId: string,
    user: JwtUser,
    dto: CreateOrderFromCartDto,
  ) {
    const resolvedCoords = await this.resolveDeliveryCoordinates(
      dto.latitude,
      dto.longitude,
      dto.address,
    );
    dto.latitude = resolvedCoords.latitude;
    dto.longitude = resolvedCoords.longitude;

    const isPickup =
      dto.saleType === SaleType.PICKUP ||
      (dto.saleType && String(dto.saleType).toUpperCase() === 'PICKUP');
    let targetFranchise: any = null;

    if (isPickup) {
      const activeFranchises = await this.prisma.franchise.findMany({
        where: {
          status: FranchiseStatus.ACTIVE,
          code: { notIn: ['CENTRAL_WAREHOUSE', 'ADMIN-HQ'] },
        },
      });

      if (dto.franchiseId) {
        targetFranchise = activeFranchises.find(
          (f) => f.id === dto.franchiseId,
        );
        if (!targetFranchise) {
          throw new BadRequestException(
            'Selected franchise is not active or does not exist',
          );
        }
        const dist = this.haversineDistanceKm(
          resolvedCoords.latitude,
          resolvedCoords.longitude,
          targetFranchise.latitude,
          targetFranchise.longitude,
        );
        const maxRange = Number(process.env.MAX_PICKUP_RADIUS_KM) || 25;
        if (dist > maxRange) {
          throw new BadRequestException(
            'Pickup service is not available as the selected franchise is not within the pickup range.',
          );
        }
        targetFranchise = { ...targetFranchise, distanceKm: dist };
      } else {
        let minDistance = Infinity;
        for (const f of activeFranchises) {
          const d = this.haversineDistanceKm(
            resolvedCoords.latitude,
            resolvedCoords.longitude,
            f.latitude,
            f.longitude,
          );
          if (d < minDistance) {
            minDistance = d;
            targetFranchise = f;
          }
        }
        const maxRange = Number(process.env.MAX_PICKUP_RADIUS_KM) || 25;
        if (!targetFranchise || minDistance > maxRange) {
          throw new BadRequestException(
            'Pickup service is not available as no franchise was found within the pickup range.',
          );
        }
        targetFranchise = { ...targetFranchise, distanceKm: minDistance };
      }

      dto.fulfillmentPreference = FulfillmentPreference.SINGLE_ONLY;
      (dto as any).targetFranchiseId = targetFranchise.id;
    }

    const fulfillment =
      await this.fulfillmentPreviewService.resolveFulfillmentPlan(
        cartId,
        user,
        dto,
      );

    if (isPickup && fulfillment.mode !== 'SINGLE_FRANCHISE') {
      throw new BadRequestException(
        'The selected franchise does not have sufficient stock to fulfill your cart items.',
      );
    }

    const allocations = this.normalizeAllocations(fulfillment);

    if (allocations.length === 0 || !fulfillment.success) {
      throw new BadRequestException({
        ...fulfillment,
        message: 'Order creation failed due to insufficient stock.',
      });
    }

    const flatLines = allocations.flatMap((allocation, allocationIndex) =>
      allocation.items.map((item, itemIndex) => ({
        allocationIndex,
        itemIndex,
        productId: item.productId,
        quantity: item.allocatedQuantity,
        baseUnitPrice: new Prisma.Decimal(item.unitPrice),
      })),
    );

    const paymentMethod = dto.onlinePaymentMethod || OnlinePaymentMethod.COD;
    const isOnline = paymentMethod === OnlinePaymentMethod.ONLINE;
    const isCod = paymentMethod === OnlinePaymentMethod.COD;

    const createdRequests = await this.prisma.$transaction(
      async (tx) => {
        const warehouseFranchise = await tx.franchise.upsert({
          where: { code: 'CENTRAL_WAREHOUSE' },
          update: {},
          create: {
            name: 'Central Warehouse',
            code: 'CENTRAL_WAREHOUSE',
            status: FranchiseStatus.ACTIVE,
            latitude: resolvedCoords.latitude,
            longitude: resolvedCoords.longitude,
            addressLine1: 'Central Fulfillment Center',
            city: 'HQ',
            postalCode: '000000',
            country: 'INDIA',
          },
        });

        let appliedDiscountCode = dto.discountCode ?? null;

        if (dto.useLoyaltyPoints) {
          if (dto.discountCode) {
            throw new BadRequestException(
              'Cannot use both loyalty points and another discount code simultaneously',
            );
          }

          const snapshot = await tx.retentionSnapshot.findUnique({
            where: { customerId: user.customerId },
          });

          if (snapshot && snapshot.loyaltyPoints >= 10) {
            const pointsToRedeem = Math.floor(snapshot.loyaltyPoints / 10) * 10;
            const discountValue = pointsToRedeem / 10;

            const randHex = Math.random()
              .toString(36)
              .substring(2, 8)
              .toUpperCase();
            appliedDiscountCode = `LOY-AUTO-${randHex}`;

            const coupon = await tx.discount.create({
              data: {
                name: `Loyalty Points Auto-Redeem (₹${discountValue})`,
                code: appliedDiscountCode,
                type: 'FIXED_AMOUNT',
                scope: 'CART',
                value: new Prisma.Decimal(discountValue),
                usageLimit: 1,
                usedCount: 0,
                active: true,
                startsAt: new Date(),
                endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                createdBy: user.customerId,
              },
            });

            await tx.retentionSnapshot.update({
              where: { customerId: user.customerId },
              data: {
                loyaltyPoints: { decrement: pointsToRedeem },
                engagementCount: { increment: 1 },
              },
            });

            await tx.loyaltyTransaction.create({
              data: {
                customerId: user.customerId,
                points: -pointsToRedeem,
                type: LoyaltyTransactionType.REDEMPTION,
                description: `Auto-redeemed ${pointsToRedeem} points at checkout for ₹${discountValue} discount`,
                referenceId: coupon.id,
              },
            });
          }
        }

        const discountQuote =
          await this.orderDiscountService.quoteOrderDiscounts({
            items: flatLines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              baseUnitPrice: line.baseUnitPrice,
            })),
            discountCode: appliedDiscountCode,
            isPickup,
            tx,
            customerId: user.customerId,
          });
        const requestRows: Array<{
          requestId: string;
          status: string;
          onlinePaymentMethod: string;
          orderId?: string | null;
          orderNumber?: string | null;
          payableAmount?: string | null;
          franchiseId?: string;
          products?: any[];
        }> = [];

        let flatCursor = 0;
        for (const allocation of allocations) {
          if (!allocation.items || allocation.items.length === 0) {
            continue;
          }

          const allocationFlatLines = flatLines.slice(
            flatCursor,
            flatCursor + allocation.items.length,
          );
          const allocationQuoteLines = allocationFlatLines.map(
            (_line, index) => discountQuote.items[flatCursor + index]!,
          );
          flatCursor += allocation.items.length;

          const subtotal = allocationQuoteLines.reduce(
            (sum, line) => sum.add(line.netLineSubtotal),
            new Prisma.Decimal(0),
          );

          const totalNetSubtotal = discountQuote.items.reduce(
            (sum, line) => sum.add(line.netLineSubtotal),
            new Prisma.Decimal(0),
          );
          const allocationShare = totalNetSubtotal.gt(0)
            ? subtotal.div(totalNetSubtotal)
            : new Prisma.Decimal(0);
          const shippingFeeShare = discountQuote.shippingFee
            .mul(allocationShare)
            .toDecimalPlaces(2);
          const shippingDiscountShare = discountQuote.shippingDiscountAmount
            .mul(allocationShare)
            .toDecimalPlaces(2);
          const giftWrapRequested = dto.giftWrap === BooleanEnum.TRUE;
          const giftWrapperFee = giftWrapRequested
            ? (subtotal.lt(1500) ? new Prisma.Decimal(49) : new Prisma.Decimal(0))
            : new Prisma.Decimal(0);
          const allocationTotal = subtotal
            .add(shippingFeeShare)
            .sub(shippingDiscountShare)
            .add(giftWrapperFee)
            .toDecimalPlaces(2);
          const allocationDiscount = allocationQuoteLines
            .reduce(
              (sum, line) => sum.add(line.totalDiscountAmount),
              new Prisma.Decimal(0),
            )
            .add(shippingDiscountShare);

          const billingSnapshot = {
            kind: 'cart_checkout_v1',
            issuedAt: new Date().toISOString(),
            customer: { userId: user.sub },
            delivery: {
              address: dto.address,
              latitude: dto.latitude,
              longitude: dto.longitude,
            },
            seller: {
              id: allocation.franchiseId,
              name: allocation.franchiseName,
            },
            lines: allocation.items.map((item) => ({
              productId: item.productId,
              name: item.productName,
              variantName: item.variantName ?? null,
              quantity: item.allocatedQuantity,
              unitPrice: item.unitPrice.toFixed(2),
              requestedQuantity: item.requestedQuantity,
              shortfallQuantity: item.shortfallQuantity ?? 0,
            })),
            totals: {
              subtotal: subtotal.toFixed(2),
              shippingFee: shippingFeeShare.toFixed(2),
              shippingDiscount: shippingDiscountShare.toFixed(2),
              discountAmount: allocationDiscount.toFixed(2),
              grandTotal: allocationTotal.toFixed(2),
            },
            isInterState: Boolean(dto.isInterState),
            payment: { status: 'UNPAID' },
            discount: {
              discountCode: discountQuote.discountCode,
              couponId: discountQuote.couponId,
              couponName: discountQuote.couponName,
              couponType: discountQuote.couponType,
              couponScope: discountQuote.couponScope,
              subtotal: subtotal.toFixed(2),
              couponDiscountAmount: allocationQuoteLines
                .reduce(
                  (sum, line) => sum.add(line.couponDiscountAmount),
                  new Prisma.Decimal(0),
                )
                .toFixed(2),
              promoDiscountAmount: allocationQuoteLines
                .reduce(
                  (sum, line) => sum.add(line.promoDiscountAmount),
                  new Prisma.Decimal(0),
                )
                .toFixed(2),
              shippingDiscountAmount: shippingDiscountShare.toFixed(2),
              grandTotal: allocationTotal.toFixed(2),
            },
          } as unknown as Prisma.InputJsonValue;

          // Create OrderRequest
          const orderRequest = await tx.orderRequest.create({
            data: {
              customerId: user.customerId,
              status: isPickup
                ? OrderRequestStatus.ACCEPTED
                : OrderRequestStatus.SEARCHING_FRANCHISE,
              selectedFranchiseId: isPickup ? targetFranchise.id : null,
              latitude: dto.latitude,
              longitude: dto.longitude,
              addressJson: (isPickup
                ? {
                    ...dto.address,
                    fromPickupScheduleTime: dto.fromPickupScheduleTime ?? null,
                    toPickupScheduleTime: dto.toPickupScheduleTime ?? null,
                    reminderSent: false,
                    missedNotificationSent: false,
                  }
                : dto.address) as unknown as Prisma.InputJsonValue,
              giftMessage: dto.giftMessage ?? undefined,
              giftWrap: dto.giftWrap === BooleanEnum.TRUE,
              giftWrapperFee: giftWrapperFee,
              isInterState: Boolean(dto.isInterState),
              cartId: cartId,
              requestSnapshot: {
                input: dto,
                resolvedCoordinates: resolvedCoords,
                createdBy: user.sub,
                targetFranchiseId: isPickup
                  ? targetFranchise.id
                  : allocation.franchiseId,
                payment: {
                  onlinePaymentMethod: paymentMethod,
                  onlinePaymentTime: isOnline ? new Date() : null,
                },
                discount: {
                  discountCode: discountQuote.discountCode,
                  couponId: discountQuote.couponId,
                  couponName: discountQuote.couponName,
                  couponType: discountQuote.couponType,
                  couponScope: discountQuote.couponScope,
                  promotionDiscountAmount:
                    discountQuote.promoDiscountAmount.toFixed(2),
                  couponDiscountAmount:
                    discountQuote.couponDiscountAmount.toFixed(2),
                  shippingDiscountAmount:
                    discountQuote.shippingDiscountAmount.toFixed(2),
                  subtotal: subtotal.toFixed(2),
                  grandTotal: allocationTotal.toFixed(2),
                },
              } as unknown as Prisma.InputJsonValue,
              maxFranchiseAttempts: 1, // Crucial: only try the targeted franchise
              attemptCount: 0,
              proposalTimeoutMinutes: Math.max(
                1,
                Number(process.env.ORDER_PROPOSAL_TIMEOUT_MINUTES || 3),
              ),
              reservationTimeoutMinutes: Math.max(
                1,
                Number(process.env.ORDER_RESERVATION_TIMEOUT_MINUTES || 15),
              ),
              totalAmount: allocationTotal,
              discountCode: appliedDiscountCode,
            },
          });

          // Create OrderRequestItems
          await tx.orderRequestItem.createMany({
            data: allocation.items.map((item, itemIndex) => {
              const quoteLine = allocationQuoteLines[itemIndex]!;
              return {
                requestId: orderRequest.id,
                productId: item.productId,
                variantId: item.variantId ?? undefined,
                quantity: item.allocatedQuantity,
                productName: item.productName,
                variantName: item.variantName ?? undefined,
                sku: undefined,
                unitPrice: quoteLine.netUnitPrice,
                gstRatePercent: new Prisma.Decimal(18), // fallback gst rate
              };
            }),
          });

          let allocatedOrderNumber: string | null = null;
          let orderId: string | null = null;

          if (isOnline || isCod) {
            allocatedOrderNumber = `GF-${Date.now().toString(36).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`;

            const createdOrder = await tx.order.create({
              data: {
                orderNumber: allocatedOrderNumber,
                orderRequestId: orderRequest.id,
                cartId: cartId,
                channel: OrderChannel.ONLINE,
                paymentMode: isOnline
                  ? PaymentModeEnum.ONLINE
                  : PaymentModeEnum.COD,
                saleType: isPickup ? SaleType.PICKUP : SaleType.DELIVERY,
                status: isPickup
                  ? isOnline
                    ? OrderStatus.CREATED
                    : OrderStatus.CONFIRMED
                  : isOnline
                    ? OrderStatus.CREATED
                    : OrderStatus.PENDING,
                franchiseId: isPickup
                  ? targetFranchise.id
                  : warehouseFranchise.id,
                customerId: user.customerId,
                total: allocationTotal,
                latitude: dto.latitude,
                longitude: dto.longitude,
                referralCode: dto.referralCode ?? null,
                addressJson: isPickup
                  ? JSON.stringify({
                      ...dto.address,
                      fromPickupScheduleTime:
                        dto.fromPickupScheduleTime ?? null,
                      toPickupScheduleTime: dto.toPickupScheduleTime ?? null,
                      reminderSent: false,
                      missedNotificationSent: false,
                    })
                  : JSON.stringify(dto.address),
                giftMessage: dto.giftMessage ?? undefined,
                giftWrap: dto.giftWrap === BooleanEnum.TRUE,
                giftWrapperFee: giftWrapperFee,
                onlinePaymentStatus: OnlinePaymentStatus.UNPAID,
                discountAmount: allocationDiscount,
                couponCode: discountQuote.discountCode ?? null,
                isApproved: isPickup ? true : false,
                approvedByUserId: null,
                billingSnapshot,
                items: {
                  create: allocation.items.map((item, itemIndex) => {
                    const quoteLine = allocationQuoteLines[itemIndex]!;
                    return {
                      productId: item.productId,
                      variantId: item.variantId ?? undefined,
                      quantity: item.allocatedQuantity,
                      unitPrice: quoteLine.netUnitPrice,
                      productName: item.productName,
                      sku: undefined,
                      variantName: item.variantName ?? undefined,
                      mrpPrice: quoteLine.baseUnitPrice,
                      gstPercent: new Prisma.Decimal(18),
                      discountAmount: quoteLine.totalDiscountAmount,
                      taxAmount: 0,
                      finalAmount: quoteLine.netLineSubtotal,
                    };
                  }),
                },
              },
            });
            orderId = createdOrder.id;

            if (appliedDiscountCode) {
              await this.orderDiscountService.consumeCouponUsage(tx, {
                discountCode: appliedDiscountCode,
                customerId: createdOrder.customerId,
                orderId: createdOrder.id,
              });
            }

            if (isPickup) {
              await tx.orderRequest.update({
                where: { id: orderRequest.id },
                data: {
                  actualOrderId: createdOrder.id,
                  acceptedAt: new Date(),
                },
              });
            }
          }

          // Lock stock reservations
          for (const item of allocation.items) {
            if (allocation.franchiseId === warehouseFranchise.id) {
              await tx.warehouseStock.update({
                where: { productId: item.productId },
                data: { reserved: { increment: item.allocatedQuantity } },
              });
            } else {
              const vId = item.variantId || '';
              const fs = await tx.franchiseStock.findFirst({
                where: {
                  franchiseId: allocation.franchiseId,
                  productId: item.productId,
                  variantId: vId,
                },
              });
              const targetVId = fs ? vId : '';
              await tx.franchiseStock.update({
                where: {
                  franchiseId_productId_variantId: {
                    franchiseId: allocation.franchiseId,
                    productId: item.productId,
                    variantId: targetVId,
                  },
                },
                data: { reserved: { increment: item.allocatedQuantity } },
              });
            }
          }

          await tx.inventoryReservation.createMany({
            data: allocation.items.map((item) => ({
              kind: 'OUTLET_ONLINE_ORDER',
              status: 'ACTIVE',
              productId: item.productId,
              quantity: item.allocatedQuantity,
              franchiseId: allocation.franchiseId,
              orderRequestId: orderRequest.id,
              orderId: orderId ?? undefined,
              note: item.shortfallQuantity
                ? `Emergency partial allocation (${item.allocatedQuantity}/${item.requestedQuantity})`
                : 'Reserved at online checkout',
            })),
          });

          requestRows.push({
            requestId: orderRequest.id,
            status: orderRequest.status,
            onlinePaymentMethod: paymentMethod,
            orderId,
            orderNumber: allocatedOrderNumber,
            payableAmount: allocationTotal.toFixed(2),
            franchiseId: allocation.franchiseId,
            products: allocation.items.map((item) => {
              if (item.variantId) {
                return {
                  productId: item.productId,
                  variantId: item.variantId,
                  productName: item.productName,
                  variantName: formatVariantName(item.variantName) ?? undefined,
                  Qty: item.allocatedQuantity,
                };
              } else {
                return {
                  productId: item.productId,
                  productName: item.productName,
                  Qty: item.allocatedQuantity,
                };
              }
            }),
          });
        }

        await tx.cart.update({
          where: { id: cartId },
          data: {
            status: CartStatus.ORDERED,
            stockLockedAt: new Date(),
          },
        });

        if (user.customerId) {
          await tx.abandonedCart.updateMany({
            where: { customerId: user.customerId, recoveredAt: null },
            data: { recoveredAt: new Date() },
          });
        }

        return requestRows;
      },
      {
        maxWait: 15000,
        timeout: 30000,
      },
    );

    // Outside transaction - enqueue allocation requests and payment timeouts
    for (const row of createdRequests) {
      const isOnline = paymentMethod === OnlinePaymentMethod.ONLINE;
      if (isOnline) {
        if (row.orderId) {
          void this.orderAllocationService['orderAllocationQueue']
            .enqueueOnlinePaymentExpiration(row.orderId, 15 * 60 * 1000)
            .catch((err) => {
              this.logger.error(
                `Failed to enqueue payment expiration: ${err.message}`,
              );
            });
        }
      } else {
        if (dto.saleType !== SaleType.PICKUP) {
          void this.orderAllocationService
            .startAllocationForRequest(row.requestId, row.orderId)
            .catch((err) => {
              this.logger.error(
                `Failed to start allocation for request ${row.requestId}: ${err.message}`,
              );
            });
        } else {
          // For pickup orders, emit ORDER_REQUEST_CREATED immediately as they don't start the allocation queue
          this.orderAllocationService['events'].emit(ORDER_ALLOCATION_EVENTS.ORDER_REQUEST_CREATED, {
            requestId: row.requestId,
            customerId: user.customerId || '',
            customerUId: user.sub,
            status: row.status as OrderRequestStatus,
          });
        }
      }
    }

    return {
      success: true,
      mode: fulfillment.mode,
      orderRequests: createdRequests.map((r) => ({
        requestId: r.requestId,
        status: r.status,
        onlinePaymentMethod: r.onlinePaymentMethod,
        products: r.products,
        ...(r.orderNumber
          ? {
              orderNumber: r.orderNumber,
              payableAmount: r.payableAmount,
            }
          : {}),
      })),
      orders: createdRequests
        .filter((r) => r.orderId)
        .map((r) => ({
          id: r.orderId!,
          orderNumber: r.orderNumber!,
          franchiseId: '',
          total: r.payableAmount!,
          mode: fulfillment.mode,
        })),
      unfulfilledItems: this.getUnfulfilledItems(fulfillment),
    };
  }

  private async resolveDeliveryCoordinates(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
    address?: {
      city?: string | null;
      state?: string | null;
      country?: string | null;
    } | null,
  ): Promise<{ latitude: number; longitude: number }> {
    if (latitude != null && longitude != null) {
      return { latitude, longitude };
    }

    const city = typeof address?.city === 'string' ? address.city : undefined;
    const state =
      typeof address?.state === 'string' ? address.state : undefined;
    const country =
      typeof address?.country === 'string' ? address.country : undefined;

    const addressString = buildAddressString({
      city,
      state,
      country,
    });

    if (!addressString) {
      throw new BadRequestException(
        'Latitude/Longitude or a valid city/state/country is required',
      );
    }

    const geo = await this.locationService.geocode(addressString);
    if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) {
      throw new BadRequestException(
        'Unable to resolve coordinates from the provided address',
      );
    }

    return { latitude: geo.lat, longitude: geo.lng };
  }

  private normalizeAllocations(
    fulfillment: CheckoutPreviewResponseDto,
  ): AllocationDto[] {
    if (fulfillment.mode === 'SINGLE_FRANCHISE') {
      return [
        {
          franchiseId: fulfillment.franchiseId,
          franchiseName: fulfillment.franchiseName,
          distanceKm: fulfillment.distanceKm,
          items: fulfillment.items,
        },
      ];
    }

    if (
      fulfillment.mode === 'MULTI_FRANCHISE_REQUIRED' ||
      fulfillment.mode === 'EMERGENCY_PARTIAL'
    ) {
      return fulfillment.allocations;
    }

    return [];
  }

  private getUnfulfilledItems(
    fulfillment: CheckoutPreviewResponseDto,
  ): UnfulfilledItemDto[] | undefined {
    if (
      fulfillment.mode === 'OUT_OF_STOCK' ||
      fulfillment.mode === 'SINGLE_ONLY_UNAVAILABLE'
    ) {
      return fulfillment.unfulfilledItems;
    }

    if (fulfillment.mode === 'EMERGENCY_PARTIAL') {
      return fulfillment.unfulfilledItems;
    }

    return undefined;
  }

  private haversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }
}
