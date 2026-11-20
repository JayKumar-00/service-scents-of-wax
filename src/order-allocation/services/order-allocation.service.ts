import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FranchiseStatus,
  OnlinePaymentStatus,
  OrderChannel,
  OrderStatus,
  PaymentModeEnum,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { LocationService } from 'src/geo/location.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import {
  CreateOrderDto,
  OnlinePaymentMethod,
} from 'src/orders/dto/create-order.dto';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';
import { OrderAllocationQueue } from '../queues/order-allocation.queue';
import { OrderAllocationEmitterService } from '../events/order-allocation-emitter.service';
import { ORDER_ALLOCATION_EVENTS } from '../constants/order-allocation.constants';
import { FranchiseCandidate } from '../interfaces/order-allocation.interface';
import { InventoryReservationService } from './inventory-reservation.service';
import { OrderDiscountService } from 'src/orders/services/order-discount.service';
import {
  OrderRequestStatus,
  ProposalStatus,
} from '../constants/order-allocation.enums';
import { InvoiceService } from 'src/invoice/invoice.service';
import { SaleType } from 'src/orders/enums/order.enum';
import { AuditService } from 'src/audit/audit.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { formatVariantName } from 'src/common/utils/variant.util';

function haversineDistanceKm(
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

@Injectable()
export class OrderAllocationService {
  private readonly logger = new Logger(OrderAllocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly locationService: LocationService,
    private readonly orderDiscountService: OrderDiscountService,
    private readonly orderAllocationQueue: OrderAllocationQueue,
    private readonly events: OrderAllocationEmitterService,
    private readonly reservationService: InventoryReservationService,
    private readonly invoiceService: InvoiceService,
    private readonly audit: AuditService,
  ) {}

  private proposalTimeoutMinutes(): number {
    return Math.max(
      1,
      Number(this.configService.get('ORDER_PROPOSAL_TIMEOUT_MINUTES') ?? 3),
    );
  }

  private reservationTimeoutMinutes(): number {
    return Math.max(
      1,
      Number(this.configService.get('ORDER_RESERVATION_TIMEOUT_MINUTES') ?? 15),
    );
  }

  private paymentExpiryMinutes(): number {
    return Math.max(
      1,
      Number(this.configService.get('PAYMENT_EXPIRY_MINUTES') ?? 3),
    );
  }

  private maxFranchiseAttempts(): number {
    const maxAttempts = this.configService.get('MAX_FRANCHISE_ATTEMPTS');
    if (
      typeof maxAttempts === 'string' &&
      maxAttempts.trim().toUpperCase() === 'ALL'
    ) {
      return 999999; // Safely acts as "infinity" for PostgreSQL INT columns
    }
    return Math.max(1, Number(maxAttempts ?? 10));
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

    const addressString = [address?.city, address?.state, address?.country]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(', ');

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

  async createOrderRequest(dto: CreateOrderDto, user: JwtUser) {
    if (
      user.role !== Role.CUSTOMER &&
      user.role !== Role.SUPERADMIN &&
      user.role !== Role.ADMIN_STAFF
    ) {
      throw new ForbiddenException('Only customers and admin can place orders');
    }

    const customerId =
      user.role === Role.CUSTOMER ? user.customerId : (dto as any).customerId;
    if (!customerId) {
      throw new BadRequestException(
        'Customer ID is required to place an order',
      );
    }

    const resolvedCoords = await this.resolveDeliveryCoordinates(
      dto.latitude,
      dto.longitude,
      dto.address,
    );

    const isPickup =
      dto.saleType === SaleType.PICKUP ||
      (dto.saleType && String(dto.saleType).toUpperCase() === 'PICKUP');
    let targetFranchise: any = null;

    if (isPickup) {
      const activeFranchises = await this.prisma.franchise.findMany({
        where: {
          status: 'ACTIVE',
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
        const dist = haversineDistanceKm(
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
          const d = haversineDistanceKm(
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
    }

    const productIds = dto.items.map((line) => line.productId);
    const variantIds = Array.from(
      new Set(
        dto.items
          .map((line) => line.variantId?.trim())
          .filter((variantId): variantId is string => Boolean(variantId)),
      ),
    );

    const [products, variants] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          mrpPrice: true,
          defaultGstRatePercent: true,
          status: true,
          deletedAt: true,
        },
      }),
      variantIds.length
        ? this.prisma.productVariant.findMany({
            where: { id: { in: variantIds }, isActive: true },
            select: {
              id: true,
              productId: true,
              price: true,
              sku: true,
              attributeSummary: true,
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

    const productById = new Map(
      products.map((product) => [product.id, product] as const),
    );
    const variantById = new Map(
      variants.map((variant) => [variant.id, variant] as const),
    );

    const quote = await this.orderDiscountService.quoteOrderDiscounts({
      items: dto.items.map((line) => {
        const product = productById.get(line.productId);
        if (!product || product.status !== 'ACTIVE' || product.deletedAt) {
          throw new BadRequestException(
            `Product ${line.productId} is invalid or inactive`,
          );
        }

        const variantId = line.variantId?.trim() || null;
        let baseUnitPrice = new Prisma.Decimal(product.price);

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
          baseUnitPrice = new Prisma.Decimal(variant.price);
        }

        return {
          productId: product.id,
          quantity: line.quantity,
          baseUnitPrice,
        };
      }),
      discountCode: dto.discountCode ?? null,
      isPickup,
      customerId,
    });

    const items: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      productName: string;
      variantName: string | null;
      sku: string | null;
      unitPrice: Prisma.Decimal;
      gstRatePercent: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      originalUnitPrice: Prisma.Decimal;
    }> = [];

    for (let index = 0; index < dto.items.length; index += 1) {
      const line = dto.items[index]!;
      const product = productById.get(line.productId)!;
      const variantId = line.variantId?.trim() || null;
      const variant = variantId ? variantById.get(variantId) : undefined;
      const quoted = quote.items[index]!;
      const gstRate = Math.min(
        28,
        Math.max(0, Number(product.defaultGstRatePercent ?? 0)),
      );

      items.push({
        productId: product.id,
        variantId,
        quantity: line.quantity,
        productName: product.name,
        variantName: variant?.attributeSummary ?? null,
        sku: variant?.sku ?? null,
        unitPrice: quoted.netUnitPrice,
        gstRatePercent: new Prisma.Decimal(gstRate),
        discountAmount: quoted.totalDiscountAmount,
        originalUnitPrice: quoted.baseUnitPrice,
      });
    }

    const giftWrapRequested = dto.giftWrap === BooleanEnum.TRUE;
    const giftWrapperFee = giftWrapRequested
      ? (quote.subtotal.lt(1500) ? new Prisma.Decimal(49) : new Prisma.Decimal(0))
      : new Prisma.Decimal(0);
    const finalGrandTotal = quote.grandTotal.add(giftWrapperFee).toDecimalPlaces(2);

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.orderRequest.create({
        data: {
          customerId,
          status: isPickup
            ? OrderRequestStatus.ACCEPTED
            : OrderRequestStatus.SEARCHING_FRANCHISE,
          selectedFranchiseId: isPickup ? targetFranchise.id : null,
          latitude: resolvedCoords.latitude,
          longitude: resolvedCoords.longitude,
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
          giftWrap: giftWrapRequested,
          giftWrapperFee,
          isInterState: Boolean(dto.isInterState),
          requestSnapshot: {
            input: dto,
            resolvedCoordinates: resolvedCoords,
            createdBy: user.sub,
            payment: {
              onlinePaymentMethod: dto.onlinePaymentMethod,
              onlinePaymentTime: dto.onlinePaymentMethod ? new Date() : null,
            },
            discount: {
              discountCode: quote.discountCode,
              couponId: quote.couponId,
              couponName: quote.couponName,
              couponType: quote.couponType,
              couponScope: quote.couponScope,
              promotionDiscountAmount: quote.promoDiscountAmount.toFixed(2),
              promotion: {
                rule: 'catalog_promotion',
                items: quote.items.map((item) => ({
                  productId: item.productId,
                  promotionPercentOff: item.promoPercentOff,
                  promotionDiscountAmount: item.promoDiscountAmount.toFixed(2),
                })),
              },
              subtotal: quote.subtotal.toFixed(2),
              promoDiscountAmount: quote.promoDiscountAmount.toFixed(2),
              couponDiscountAmount: quote.couponDiscountAmount.toFixed(2),
              shippingDiscountAmount: quote.shippingDiscountAmount.toFixed(2),
              cashbackAmount: quote.cashbackAmount.toFixed(2),
              grandTotal: quote.grandTotal.toFixed(2),
              shippingFee: quote.shippingFee.toFixed(2),
              items: quote.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                baseUnitPrice: item.baseUnitPrice.toFixed(2),
                promoDiscountAmount: item.promoDiscountAmount.toFixed(2),
                couponDiscountAmount: item.couponDiscountAmount.toFixed(2),
                totalDiscountAmount: item.totalDiscountAmount.toFixed(2),
                netUnitPrice: item.netUnitPrice.toFixed(2),
              })),
            },
          } as unknown as Prisma.InputJsonValue,
          maxFranchiseAttempts: this.maxFranchiseAttempts(),
          attemptCount: 0,
          proposalTimeoutMinutes: this.proposalTimeoutMinutes(),
          reservationTimeoutMinutes: this.reservationTimeoutMinutes(),
          totalAmount: finalGrandTotal,
          discountCode: dto.discountCode ?? null,
        },
      });

      await tx.orderRequestItem.createMany({
        data: items.map((item) => ({
          requestId: created.id,
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          quantity: item.quantity,
          productName: item.productName,
          variantName: item.variantName ?? undefined,
          sku: item.sku ?? undefined,
          unitPrice: item.unitPrice,
          gstRatePercent: item.gstRatePercent,
        })),
      });

      let orderNumber: string | null = null;
      let orderId: string | null = null;

      const isOnline = dto.onlinePaymentMethod === OnlinePaymentMethod.ONLINE;
      const isCod = dto.onlinePaymentMethod === OnlinePaymentMethod.COD;

      if (isOnline || isCod) {
        orderNumber = `GF-${Date.now().toString(36).toUpperCase()}`;
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

        const calculatedDiscount = new Prisma.Decimal(quote.promoDiscountAmount)
          .add(new Prisma.Decimal(quote.couponDiscountAmount))
          .add(new Prisma.Decimal(quote.shippingDiscountAmount));

        const order = await tx.order.create({
          data: {
            orderNumber,
            status: isPickup
              ? isOnline
                ? OrderStatus.CREATED
                : OrderStatus.CONFIRMED
              : isOnline
                ? OrderStatus.CREATED
                : OrderStatus.PENDING,
            orderRequestId: created.id,
            channel: OrderChannel.ONLINE,
            saleType: isPickup ? SaleType.PICKUP : SaleType.DELIVERY,
            paymentMode: isOnline
              ? PaymentModeEnum.ONLINE
              : PaymentModeEnum.COD,
            franchiseId: isPickup ? targetFranchise.id : warehouseFranchise.id,
            customerId,
            total: finalGrandTotal,
            latitude: resolvedCoords.latitude,
            longitude: resolvedCoords.longitude,
            referralCode: dto.referralCode ?? null,
            addressJson: isPickup
              ? JSON.stringify({
                  ...dto.address,
                  fromPickupScheduleTime: dto.fromPickupScheduleTime ?? null,
                  toPickupScheduleTime: dto.toPickupScheduleTime ?? null,
                  reminderSent: false,
                  missedNotificationSent: false,
                })
              : JSON.stringify(dto.address),
            giftMessage: dto.giftMessage ?? undefined,
            giftWrap: dto.giftWrap === BooleanEnum.TRUE,
            giftWrapperFee,
            onlinePaymentStatus: OnlinePaymentStatus.UNPAID,
            discountAmount: calculatedDiscount,
            couponCode: quote.discountCode ?? null,
            isApproved: isPickup ? true : false,
            approvedByUserId: null,
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId ?? undefined,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                productName: item.productName,
                sku: item.sku ?? undefined,
                variantName: item.variantName ?? undefined,
                mrpPrice: item.originalUnitPrice,
                gstPercent: item.gstRatePercent,
                discountAmount: item.discountAmount,
                taxAmount: 0,
                finalAmount: item.unitPrice.mul(item.quantity),
              })),
            },
          },
        });
        orderId = order.id;

        if (quote.discountCode) {
          await this.orderDiscountService.consumeCouponUsage(tx, {
            discountCode: quote.discountCode,
            customerId: order.customerId,
            orderId: order.id,
          });
        }

        // Reserve stock immediately at order creation
        const reservations = await this.reservationService.reserveForOrder(tx, {
          orderId: order.id,
          requestId: created.id,
          franchiseId: isPickup ? targetFranchise.id : warehouseFranchise.id,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          expiresAt: new Date(
            Date.now() + this.reservationTimeoutMinutes() * 60_000,
          ),
          note: 'Temporary checkout reservation at order creation',
        });

        for (const reservation of reservations) {
          if (reservation.expiresAt) {
            void this.orderAllocationQueue.enqueueReservationExpiration(
              reservation.id,
              Math.max(1000, reservation.expiresAt.getTime() - Date.now()),
            );
          }
        }

        if (isPickup) {
          await tx.orderRequest.update({
            where: { id: created.id },
            data: {
              actualOrderId: order.id,
              acceptedAt: new Date(),
            },
          });
        }
      }

      return {
        request: { ...created, userId: user.sub },
        orderNumber,
        orderId,
      };
    });

    this.events.emit(ORDER_ALLOCATION_EVENTS.ORDER_REQUEST_CREATED, {
      requestId: request.request.id,
      customerId: request.request.customerId,
      customerUId: request.request.userId,
      status: request.request.status,
    });

    if (!isPickup) {
      void this.orderAllocationQueue
        .enqueueAllocationRequest(request.request.id)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to enqueue allocation for request ${request.request.id}: ${error.message}`,
          );
        });
    }

    if (request.orderId) {
      void this.orderAllocationQueue
        .enqueueOnlinePaymentExpiration(
          request.orderId,
          this.paymentExpiryMinutes() * 60 * 1000,
        )
        .catch((err) => {
          this.logger.error(
            `Failed to enqueue payment expiration: ${err.message}`,
          );
        });
    }

    const productsDetails = items.map((item) => {
      if (item.variantId) {
        return {
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: formatVariantName(item.variantName) ?? undefined,
          Qty: item.quantity,
        };
      } else {
        return {
          productId: item.productId,
          productName: item.productName,
          Qty: item.quantity,
        };
      }
    });

    return {
      requestId: request.request.id,
      status: OrderRequestStatus.SEARCHING_FRANCHISE,
      onlinePaymentMethod: dto.onlinePaymentMethod ?? null,
      discountCode: quote.discountCode,
      promotionDiscountAmount: quote.promoDiscountAmount.toFixed(2),
      products: productsDetails,
      ...(request.orderNumber
        ? {
            orderNumber: request.orderNumber,
            payableAmount: quote.grandTotal.toFixed(2),
          }
        : {}),
    };
  }

  async startAllocationForRequest(requestId: string, orderId?: string | null) {
    const request = await this.prisma.orderRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        customerId: true,
        customer: { select: { userId: true } },
        status: true,
      },
    });
    if (!request) {
      throw new NotFoundException(`Order request ${requestId} not found`);
    }

    this.events.emit(ORDER_ALLOCATION_EVENTS.ORDER_REQUEST_CREATED, {
      requestId: request.id,
      customerId: request.customerId,
      customerUId: request.customer?.userId || '', // User ID is not available at this point, consider adding it to the order request if needed
      status: request.status as OrderRequestStatus,
    });

    void this.orderAllocationQueue
      .enqueueAllocationRequest(request.id)
      .catch((error: Error) => {
        this.logger.error(
          `Failed to enqueue allocation for request ${request.id}: ${error.message}`,
        );
      });

    if (orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { paymentMode: true },
      });
      if (order && order.paymentMode === PaymentModeEnum.ONLINE) {
        void this.orderAllocationQueue
          .enqueueOnlinePaymentExpiration(
            orderId,
            this.paymentExpiryMinutes() * 60 * 1000,
          )
          .catch((err) => {
            this.logger.error(
              `Failed to enqueue payment expiration: ${err.message}`,
            );
          });
      }
    }
  }

  async listProposals(query?: {
    franchiseId?: string;
    status?: ProposalStatus;
    requestId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.requestId) {
      where.requestId = query.requestId;
    }

    if (query?.franchiseId) {
      where.franchiseId = query.franchiseId;
    }

    const [total, data] = await Promise.all([
      this.prisma.franchiseProposal.count({ where }),
      this.prisma.franchiseProposal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          franchise: { select: { id: true, name: true, code: true } },
          request: {
            select: {
              id: true,
              status: true,
              customerId: true,
              latitude: true,
              longitude: true,
              createdAt: true,
              customer: {
                select: {
                  name: true,
                  phone: true,
                  user: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
              items: {
                select: {
                  productId: true,
                  variantId: true,
                  productName: true,
                  variantName: true,
                  quantity: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const mappedData = data.map((proposal) => {
      const requestItems = proposal.request?.items || [];
      const products = requestItems.map((item) => {
        if (item.variantId) {
          return {
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantName: formatVariantName(item.variantName) ?? undefined,
            Qty: item.quantity,
          };
        } else {
          return {
            productId: item.productId,
            productName: item.productName,
            Qty: item.quantity,
          };
        }
      });
      return {
        ...proposal,
        products,
        request: proposal.request
          ? {
              ...proposal.request,
              products,
            }
          : null,
      };
    });

    return {
      data: mappedData,
      meta: {
        count: total,
        page,
        limit,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async acceptProposal(proposalId: string, user: JwtUser) {
    const userFranchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (!userFranchiseId && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }

    const proposal = await this.prisma.franchiseProposal.findUnique({
      where: { id: proposalId },
      include: {
        request: {
          include: {
            items: true,
          },
        },
        franchise: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }
    if (
      user.role !== Role.SUPERADMIN &&
      proposal.franchiseId !== userFranchiseId
    ) {
      throw new ForbiddenException();
    }

    if (this.isRequestCod(proposal.request)) {
      const bestFranchiseIds = await this.findFranchisesWithMaxProducts(
        this.prisma,
        proposal.request.items,
        proposal.request.id,
      );
      if (!bestFranchiseIds.has(proposal.franchiseId)) {
        throw new BadRequestException(
          'This franchise does not have the maximum products for this COD order, and is restricted from accepting it.',
        );
      }
    }

    const acceptedAt = new Date();
    let isOnlinePayment = false;
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.franchiseProposal.updateMany({
        where: {
          id: proposal.id,
          status: ProposalStatus.SENT,
        },
        data: {
          status: ProposalStatus.ACCEPTED,
          acceptedAt,
          respondedAt: acceptedAt,
          responseTime: Math.round(
            (acceptedAt.getTime() - proposal.proposedAt.getTime()) / 1000,
          ),
        },
      });

      if (locked.count === 0) {
        throw new BadRequestException('Proposal is no longer available');
      }

      const request = await tx.orderRequest.findUnique({
        where: { id: proposal.requestId },
        include: {
          items: true,
          order: true,
          customer: { select: { userId: true } },
        },
      });
      const requestItems: any[] = (request?.items as any[]) ?? [];
      const requestSnapshot = (request?.requestSnapshot ?? {}) as Record<
        string,
        any
      >;
      const discountSnapshot = (requestSnapshot.discount ?? {}) as Record<
        string,
        any
      >;
      const lineDiscounts: Array<Record<string, any>> = Array.isArray(
        discountSnapshot.items,
      )
        ? discountSnapshot.items
        : [];

      if (!request || request.status === OrderRequestStatus.ACCEPTED) {
        throw new BadRequestException('Request has already been accepted');
      }

      const requestReservations = await tx.inventoryReservation.findMany({
        where: {
          orderRequestId: request.id,
          status: 'ACTIVE',
          franchiseId: proposal.franchiseId,
        },
        select: {
          productId: true,
          quantity: true,
        },
      });

      const reservedByProduct = new Map<string, number>(
        requestReservations.map((res: any) => [res.productId, res.quantity]),
      );

      const stockRows = await tx.franchiseStock.findMany({
        where: {
          franchiseId: proposal.franchiseId,
          productId: { in: requestItems.map((item: any) => item.productId) },
        },
        select: {
          productId: true,
          quantity: true,
          reserved: true,
        },
      });

      const stockMap: Map<string, any> = new Map(
        stockRows.map((row: any) => [row.productId, row] as const),
      );

      for (const item of requestItems) {
        const stock: any = stockMap.get(item.productId);
        const selfReserved = reservedByProduct.get(item.productId) ?? 0;
        const available = (stock?.quantity ?? 0) - (stock?.reserved ?? 0) + selfReserved;
        if (!stock || available < item.quantity) {
          await tx.franchiseProposal.update({
            where: { id: proposal.id },
            data: {
              status: ProposalStatus.REJECTED,
              rejectedAt: acceptedAt,
              respondedAt: acceptedAt,
              cancellationNote: 'Stock changed before acceptance completed',
            },
          });
          await tx.orderRequest.update({
            where: { id: request.id },
            data: {
              status: OrderRequestStatus.SEARCHING_FRANCHISE,
              failureReason: 'Stock changed before acceptance completed',
            },
          });
          return { order: null, request, stockRejected: true } as const;
        }
      }

      const orderLines = requestItems.map((item: any, index: number) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        productName: item.productName,
        sku: item.sku ?? null,
        variantName: item.variantName ?? null,
        unitPrice: item.unitPrice,
        mrpPrice: item.unitPrice,
        gstPercent: item.gstRatePercent,
        discountAmount: new Prisma.Decimal(
          lineDiscounts[index]?.totalDiscountAmount ?? '0',
        ),
        taxAmount: new Prisma.Decimal(0),
        finalAmount: item.unitPrice.mul(item.quantity),
        imageUrl: null,
      }));

      const totalAmount =
        request.totalAmount ??
        orderLines.reduce(
          (sum: Prisma.Decimal, line: any) =>
            sum.add(line.unitPrice.mul(line.quantity)),
          new Prisma.Decimal(0),
        );

      const calculatedDiscount = new Prisma.Decimal(
        discountSnapshot.promoDiscountAmount ?? '0',
      )
        .add(new Prisma.Decimal(discountSnapshot.couponDiscountAmount ?? '0'))
        .add(
          new Prisma.Decimal(discountSnapshot.shippingDiscountAmount ?? '0'),
        );

      const isFranchiseRole =
        user.role === Role.FRANCHISE_OWNER ||
        user.role === Role.FRANCHISE_STAFF;
      const franchisePaybleAmount = isFranchiseRole
        ? new Prisma.Decimal(totalAmount).sub(calculatedDiscount)
        : new Prisma.Decimal(0);

      isOnlinePayment =
        discountSnapshot.payment?.onlinePaymentMethod === 'ONLINE' ||
        (requestSnapshot.payment &&
          requestSnapshot.payment.onlinePaymentMethod === 'ONLINE');
      const isPaid = request?.order?.onlinePaymentStatus === OnlinePaymentStatus.PAID;
      const orderStatus = (isOnlinePayment && !isPaid)
        ? OrderStatus.CREATED
        : OrderStatus.CONFIRMED;

      let order;
      const existingOrder = await tx.order.findUnique({
        where: { orderRequestId: request.id },
      });

      if (existingOrder) {
        order = await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            franchiseId: proposal.franchiseId,
            status: orderStatus,
            isApproved: true,
            approvedByUserId: user.sub,
            franchisePaybleAmount,
            billingSnapshot: {
              kind: 'order_request_v1',
              requestId: request.id,
              proposalId: proposal.id,
              discount: discountSnapshot,
              seller: {
                id: proposal.franchiseId,
                name: proposal.franchise.name,
                code: proposal.franchise.code,
              },
              lines: orderLines.map((line: any) => ({
                productId: line.productId,
                variantId: line.variantId,
                name: line.productName,
                quantity: line.quantity,
                unitPrice: line.unitPrice.toFixed(2),
                sku: line.sku,
                variantName: line.variantName,
              })),
              totals: {
                grandTotal: totalAmount.toFixed(2),
              },
            } as unknown as Prisma.InputJsonValue,
          },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, slug: true } },
              },
            },
            franchise: true,
          },
        });
      } else {
        order = await tx.order.create({
          data: {
            orderNumber: `GF-${Date.now().toString(36).toUpperCase()}`,
            orderRequestId: request.id,
            cartId: request.cartId,
            channel: OrderChannel.ONLINE,
            saleType: SaleType.DELIVERY,
            status: orderStatus,
            franchiseId: proposal.franchiseId,
            customerId: request.customerId,
            total: totalAmount,
            latitude: request.latitude,
            longitude: request.longitude,
            addressJson: JSON.stringify(request.addressJson),
            giftMessage: request.giftMessage,
            giftWrap: request.giftWrap,
            giftWrapperFee: request.giftWrapperFee,
            onlinePaymentStatus: OnlinePaymentStatus.UNPAID,
            discountAmount: calculatedDiscount,
            couponCode: discountSnapshot.discountCode ?? null,
            isApproved: true,
            approvedByUserId: user.sub,
            franchisePaybleAmount,
            referralCode:
              (request.requestSnapshot as any)?.input?.referralCode ?? null,
            paymentMode: isOnlinePayment
              ? PaymentModeEnum.ONLINE
              : PaymentModeEnum.COD,
            billingSnapshot: {
              kind: 'order_request_v1',
              requestId: request.id,
              proposalId: proposal.id,
              discount: discountSnapshot,
              seller: {
                id: proposal.franchiseId,
                name: proposal.franchise.name,
                code: proposal.franchise.code,
              },
              lines: orderLines.map((line: any) => ({
                productId: line.productId,
                variantId: line.variantId,
                name: line.productName,
                quantity: line.quantity,
                unitPrice: line.unitPrice.toFixed(2),
                sku: line.sku,
                variantName: line.variantName,
              })),
              totals: {
                grandTotal: totalAmount.toFixed(2),
              },
            } as unknown as Prisma.InputJsonValue,
            items: {
              create: orderLines.map((line: any) => ({
                productId: line.productId,
                variantId: line.variantId ?? undefined,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                productName: line.productName,
                sku: line.sku ?? undefined,
                variantName: line.variantName ?? undefined,
                mrpPrice: line.mrpPrice,
                gstPercent: line.gstPercent,
                discountAmount: line.discountAmount,
                taxAmount: line.taxAmount,
                finalAmount: line.finalAmount,
                imageUrl: line.imageUrl ?? undefined,
              })),
            },
          },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, slug: true } },
              },
            },
            franchise: true,
          },
        });
      }

      // Release initial temporary reservation before reserving for the accepting franchise
      await this.reservationService.releaseOrderReservations(tx, order.id, 'Released warehouse reservation because franchise accepted');

      const reservations = await this.reservationService.reserveForOrder(tx, {
        orderId: order.id,
        requestId: request.id,
        proposalId: proposal.id,
        franchiseId: proposal.franchiseId,
        items: requestItems.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        expiresAt: new Date(
          Date.now() + this.reservationTimeoutMinutes() * 60_000,
        ),
        note: 'Reserved after franchise acceptance',
      });

      for (const reservation of reservations) {
        if (reservation.expiresAt) {
          void this.orderAllocationQueue.enqueueReservationExpiration(
            reservation.id,
            Math.max(1000, reservation.expiresAt.getTime() - Date.now()),
          );
        }
      }

      if (order.onlinePaymentStatus === OnlinePaymentStatus.PAID) {
        await this.reservationService.consumeOrderReservations(tx, order.id);
      }

      await tx.orderRequest.update({
        where: { id: request.id },
        data: {
          status: OrderRequestStatus.ACCEPTED,
          selectedFranchiseId: proposal.franchiseId,
          acceptedProposalId: proposal.id,
          actualOrderId: order.id,
          acceptedAt,
          failureReason: null,
        },
      });

      await this.orderDiscountService.consumeCouponUsage(tx, {
        discountCode: discountSnapshot.discountCode ?? null,
        customerId: request.customerId,
        orderId: order.id,
      });

      await tx.franchiseProposal.updateMany({
        where: {
          requestId: request.id,
          id: { not: proposal.id },
          status: ProposalStatus.SENT,
        },
        data: {
          status: ProposalStatus.CANCELLED,
          cancellationNote: 'Another franchise accepted the request',
          respondedAt: acceptedAt,
        },
      });

      return { order, request };
    });

    if (!result.order) {
      this.events.emit(ORDER_ALLOCATION_EVENTS.PROPOSAL_REJECTED, {
        requestId: result.request.id,
        proposalId,
        franchiseId: proposal.franchiseId,
        customerId: result.request.customerId,
        customerUId: result.request.customer?.userId ?? '',
        status: ProposalStatus.REJECTED,
        reason: 'Stock changed before acceptance completed',
      });
      void this.orderAllocationQueue
        .enqueueAllocationRequest(result.request.id)
        .catch((error: Error) =>
          this.logger.error(
            `Failed to requeue after stock rejection ${result.request.id}: ${error.message}`,
          ),
        );
      return null;
    }

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'proposal.accept',
        resource: 'FranchiseProposal',
        resourceId: proposalId,
        metadata: {
          proposalCode: proposal.proposalCode,
          franchiseId: proposal.franchiseId,
          requestId: proposal.requestId,
        },
      }),
      'proposal.accept',
    );

    this.events.emit(ORDER_ALLOCATION_EVENTS.PROPOSAL_ACCEPTED, {
      requestId: result.request.id,
      proposalId,
      franchiseId: proposal.franchiseId,
      customerId: result.request.customerId,
      customerUId: result.request.customer?.userId ?? '',
      status: ProposalStatus.ACCEPTED,
      reason: null,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      totalAmount:
        result.order.total instanceof Prisma.Decimal
          ? result.order.total.toFixed(2)
          : String(result.order.total),
    });
    this.events.emit(ORDER_ALLOCATION_EVENTS.ORDER_CREATED, {
      requestId: result.request.id,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      customerId: result.request.customerId,
      customerUId: result.request.customer?.userId ?? '',
      franchiseId: proposal.franchiseId,
      totalAmount:
        result.order.total instanceof Prisma.Decimal
          ? result.order.total.toFixed(2)
          : String(result.order.total),
    });

    try {
      await this.invoiceService.generatedInvoice({
        orderNumber: result.order.orderNumber,
      } as any);
    } catch (invoiceError: any) {
      this.logger.error(
        `Failed to generate invoice for order ${result.order.orderNumber}: ${invoiceError.message}`,
      );
    }

    // Payment expiration timer is enqueued at order request creation time.

    return result.order;
  }

  async rejectProposal(proposalId: string, user: JwtUser, reason?: string) {
    const proposal = await this.prisma.franchiseProposal.findUnique({
      where: { id: proposalId },
      include: {
        request: {
          include: {
            customer: { select: { userId: true } },
          },
        },
        franchise: true,
      },
    });
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const userFranchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (
      user.role !== Role.SUPERADMIN &&
      userFranchiseId !== proposal.franchiseId
    ) {
      throw new ForbiddenException();
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.franchiseProposal.updateMany({
        where: {
          id: proposal.id,
          status: ProposalStatus.SENT,
        },
        data: {
          status: ProposalStatus.REJECTED,
          rejectedAt: now,
          respondedAt: now,
          cancellationNote: reason ?? 'Rejected by franchise',
          responseTime: Math.round(
            (now.getTime() - proposal.proposedAt.getTime()) / 1000,
          ),
        },
      });
      if (locked.count === 0) {
        throw new BadRequestException('Proposal is no longer available');
      }

      await tx.orderRequest.update({
        where: { id: proposal.requestId },
        data: {
          status: OrderRequestStatus.SEARCHING_FRANCHISE,
          failureReason: null,
        },
      });

      await this.reservationService.releaseRequestReservations(
        tx,
        proposal.requestId,
        reason ?? 'Rejected by franchise',
      );

      return proposal;
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'proposal.reject',
        resource: 'FranchiseProposal',
        resourceId: proposalId,
        metadata: {
          proposalCode: proposal.proposalCode,
          franchiseId: proposal.franchiseId,
          requestId: proposal.requestId,
          reason,
        },
      }),
      'proposal.reject',
    );

    this.events.emit(ORDER_ALLOCATION_EVENTS.PROPOSAL_REJECTED, {
      requestId: proposal.requestId,
      proposalId: proposal.id,
      franchiseId: proposal.franchiseId,
      customerId: proposal.request.customerId,
      customerUId: proposal.request.customer?.userId ?? '',
      status: ProposalStatus.REJECTED,
      reason: reason ?? 'Rejected by franchise',
    });

    void this.orderAllocationQueue
      .enqueueAllocationRequest(proposal.requestId)
      .catch((error: Error) =>
        this.logger.error(
          `Failed to requeue request ${proposal.requestId}: ${error.message}`,
        ),
      );

    return updated;
  }

  async expireProposal(proposalId: string) {
    const proposal = await this.prisma.franchiseProposal.findUnique({
      where: { id: proposalId },
      include: {
        request: {
          include: {
            customer: { select: { userId: true } },
          },
        },
        franchise: true,
      },
    });
    if (!proposal || proposal.status !== ProposalStatus.SENT) {
      return null;
    }

    const now = new Date();
    this.logger.warn(
      `[Allocation] proposalExpired request=${proposal.requestId} proposal=${proposal.id} franchise=${proposal.franchiseId} expiredAt=${now.toISOString()} -> requeue next franchise`,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.franchiseProposal.updateMany({
        where: {
          id: proposal.id,
          status: ProposalStatus.SENT,
        },
        data: {
          status: ProposalStatus.EXPIRED,
          expiredAt: now,
          respondedAt: now,
          cancellationNote: 'Proposal timed out',
          responseTime: Math.round(
            (now.getTime() - proposal.proposedAt.getTime()) / 1000,
          ),
        },
      });
      await tx.orderRequest.update({
        where: { id: proposal.requestId },
        data: {
          status: OrderRequestStatus.SEARCHING_FRANCHISE,
        },
      });

      await this.reservationService.releaseRequestReservations(
        tx,
        proposal.requestId,
        'Proposal timed out',
      );
    });

    this.events.emit(ORDER_ALLOCATION_EVENTS.PROPOSAL_EXPIRED, {
      requestId: proposal.requestId,
      proposalId: proposal.id,
      franchiseId: proposal.franchiseId,
      customerId: proposal.request.customerId,
      customerUId: proposal.request.customer?.userId ?? '',
      status: ProposalStatus.EXPIRED,
      reason: 'Proposal timed out',
    });

    void this.orderAllocationQueue
      .enqueueAllocationRequest(proposal.requestId)
      .then(() => {
        this.logger.log(
          `[Allocation] requeued request=${proposal.requestId} after proposal=${proposal.id} expired`,
        );
      })
      .catch((error: Error) =>
        this.logger.error(
          `Failed to requeue after proposal expiry ${proposal.requestId}: ${error.message}`,
        ),
      );

    return proposal;
  }

  async expireReservation(reservationId: string) {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
      include: {
        order: true,
        orderRequest: true,
        proposal: true,
      },
    });

    if (!reservation || reservation.status !== 'ACTIVE') {
      return null;
    }

    const reservationRow = reservation as any;

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (reservation.orderId) {
        await this.reservationService.releaseOrderReservations(
          tx,
          reservation.orderId,
          'Reservation expired',
        );
      } else if (reservationRow.proposal?.id) {
        await this.reservationService.releaseProposalReservations(
          tx,
          reservationRow.proposal.id,
          'Reservation expired',
        );
      }

      if (reservation.order?.status === OrderStatus.CREATED) {
        await tx.order.update({
          where: { id: reservation.orderId! },
          data: {
            status: OrderStatus.CANCELLED,
            onlinePaymentStatus: OnlinePaymentStatus.FAILED,
          },
        });
      }
      if (reservationRow.orderRequest?.id) {
        await tx.orderRequest.update({
          where: { id: reservationRow.orderRequest.id },
          data: {
            status: OrderRequestStatus.FAILED,
            failedAt: now,
            failureReason: 'Reservation expired before payment completion',
          },
        });
      }
    });

    return reservation;
  }

  async processAllocationRequest(requestId: string) {
    const request = await this.prisma.orderRequest.findUnique({
      where: { id: requestId },
      include: {
        items: true,
        proposals: true,
        customer: {
          select: {
            userId: true,
            name: true,
            phone: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Order request not found');
    }
    if (
      request.status === OrderRequestStatus.ACCEPTED ||
      request.status === OrderRequestStatus.FULFILLED_BY_WAREHOUSE ||
      request.status === OrderRequestStatus.FAILED ||
      request.status === OrderRequestStatus.CANCELLED ||
      request.status === OrderRequestStatus.PROPOSAL_SENT
    ) {
      return request;
    }

    const requestProposals: any[] = (request.proposals as any[]) ?? [];
    const attemptedFranchiseIds = new Set(
      requestProposals.map((proposal: any) => proposal.franchiseId),
    );

    const candidates = await this.findEligibleFranchises(
      request,
      attemptedFranchiseIds,
    );
    if (
      candidates.length > 0 &&
      request.attemptCount < request.maxFranchiseAttempts
    ) {
      const selected = candidates[0]!;
      this.logger.log(
        `[Allocation] request=${request.id} attempt=${request.attemptCount + 1} selectedFranchise=${selected.id}(${selected.name}) distanceKm=${selected.distanceKm.toFixed(
          2,
        )}`,
      );

      const proposal = await this.prisma.$transaction(async (tx) => {
        const created = await tx.franchiseProposal.create({
          data: {
            requestId: request.id,
            proposalCode: `P-${request.id.substring(0, 6).toUpperCase()}-${request.attemptCount + 1}`,
            franchiseId: selected.id,
            status: ProposalStatus.SENT,
            attemptNumber: request.attemptCount + 1,
            distanceKm: new Prisma.Decimal(selected.distanceKm),
            expiresAt: new Date(
              Date.now() + request.proposalTimeoutMinutes * 60_000,
            ),
          },
        });

        await tx.orderRequest.update({
          where: { id: request.id },
          data: {
            status: OrderRequestStatus.PROPOSAL_SENT,
            attemptCount: { increment: 1 },
            failureReason: null,
          },
        });

        return created;
      });

      this.logger.log(
        `[Allocation] proposalSent request=${request.id} proposal=${proposal.id} franchise=${selected.id} attempt=${proposal.attemptNumber} expiresAt=${proposal.expiresAt?.toISOString() ?? 'n/a'}`,
      );

      const franchiseUsers = await this.prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: [Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF] },
          OR: [{ franchiseId: selected.id }, { franchiseOwnerId: selected.id }],
        },
        select: { id: true },
      });

      this.events.emit(ORDER_ALLOCATION_EVENTS.PROPOSAL_SENT, {
        requestId: request.id,
        proposalId: proposal.id,
        franchiseId: selected.id,
        franchiseName: candidates[0]!.name,
        franchiseUserIds: franchiseUsers.map((user) => user.id),
        attemptNumber: proposal.attemptNumber,
        expiresAt:
          proposal.expiresAt ??
          new Date(Date.now() + request.proposalTimeoutMinutes * 60_000),
        status: proposal.status,
        distanceKm: Number(proposal.distanceKm ?? 0),
        customerName: request.customer?.name ?? null,
        customerEmail: request.customer?.user?.email ?? null,
        customerPhone: request.customer?.phone ?? null,
        products: request.items.map((item) => {
          if (item.variantId) {
            return {
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              variantName: formatVariantName(item.variantName) ?? undefined,
              Qty: item.quantity,
            };
          } else {
            return {
              productId: item.productId,
              productName: item.productName,
              Qty: item.quantity,
            };
          }
        }),
      });

      if (proposal.expiresAt) {
        void this.orderAllocationQueue.enqueueProposalExpiration(
          proposal.id,
          Math.max(1000, proposal.expiresAt.getTime() - Date.now()),
        );
      }

      return proposal;
    }

    // Check if warehouse has stock
    const productIds = request.items.map((item) => item.productId);
    const warehouseStocks = await this.prisma.warehouseStock.findMany({
      where: { productId: { in: productIds } },
    });
    let warehouseHasStock = warehouseStocks.length === productIds.length;
    const wsMap = new Map(warehouseStocks.map((ws) => [ws.productId, ws]));

    for (const item of request.items) {
      const ws = wsMap.get(item.productId);
      const available = (ws?.quantity ?? 0) - (ws?.reserved ?? 0);

      const requestWarehouseReservations =
        await this.prisma.inventoryReservation.findMany({
          where: {
            orderRequestId: request.id,
            status: 'ACTIVE',
            franchise: { code: 'CENTRAL_WAREHOUSE' },
            productId: item.productId,
          },
        });
      const selfReserved = requestWarehouseReservations.reduce(
        (sum, r) => sum + r.quantity,
        0,
      );

      if (!ws || available + selfReserved < item.quantity) {
        warehouseHasStock = false;
        break;
      }
    }

    if (warehouseHasStock && warehouseStocks.length === productIds.length) {
      const fulfilled = await this.tryWarehouseFallback(request);
      if (fulfilled) {
        return fulfilled;
      }
    }

    // Warehouse is out of stock. Check order payment details
    const existingOrder = await this.prisma.order.findUnique({
      where: { orderRequestId: request.id },
    });

    const snapshot = request.requestSnapshot as any;
    const paymentMethod =
      snapshot?.payment?.onlinePaymentMethod ||
      snapshot?.input?.onlinePaymentMethod;
    const isOnlinePayment =
      existingOrder?.paymentMode === PaymentModeEnum.ONLINE ||
      paymentMethod === OnlinePaymentMethod.ONLINE;

    // Paid ONLINE & COD Orders proceed to 2nd Cycle - Force Assignment
    const franchises = await this.prisma.franchise.findMany({
      where: {
        status: FranchiseStatus.ACTIVE,
        code: { notIn: ['CENTRAL_WAREHOUSE', 'ADMIN-HQ'] },
      },
    });

    if (franchises.length > 0) {
      // Release any active reservations before computing split allocations
      await this.prisma.$transaction(async (tx) => {
        await this.reservationService.releaseRequestReservations(
          tx,
          request.id,
          'Releasing stock for forceful splitting/allocation',
        );
      });

      let candidates = franchises
        .map((franchise) => ({
          id: franchise.id,
          name: franchise.name,
          code: franchise.code,
          latitude: franchise.latitude,
          longitude: franchise.longitude,
          distanceKm: haversineDistanceKm(
            request.latitude,
            request.longitude,
            franchise.latitude,
            franchise.longitude,
          ),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);

      const bestFranchiseIds = await this.findFranchisesWithMaxProducts(
        this.prisma,
        request.items,
        request.id,
      );
      candidates = candidates.filter((c) => bestFranchiseIds.has(c.id));

      const stocks = await this.prisma.franchiseStock.findMany({
        where: {
          franchiseId: { in: candidates.map((c) => c.id) },
          productId: { in: productIds },
        },
      });

      const stockMap = new Map<string, any>();
      for (const stock of stocks) {
        stockMap.set(`${stock.franchiseId}_${stock.productId}`, stock);
      }

      let allocatedThroughComplete = false;
      let completeFulfillmentFranchise = null;

      // 1. Search for nearest franchise capable of COMPLETE fulfillment
      for (const candidate of candidates) {
        let canFullyFulfill = true;
        for (const item of request.items) {
          const stockKey = `${candidate.id}_${item.productId}`;
          const stock = stockMap.get(stockKey);
          const available = stock ? stock.quantity - stock.reserved : 0;
          if (available < item.quantity) {
            canFullyFulfill = false;
            break;
          }
        }
        if (canFullyFulfill) {
          completeFulfillmentFranchise = candidate;
          break;
        }
      }

      if (completeFulfillmentFranchise) {
        const forceFulfilled = await this.forceAssignToFranchise(
          request.id,
          completeFulfillmentFranchise,
          request.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
            unitPrice: item.unitPrice,
            gstRatePercent: item.gstRatePercent,
          })),
        );
        if (forceFulfilled) {
          return forceFulfilled;
        }
        allocatedThroughComplete = true;
      }

      if (!allocatedThroughComplete) {
        // 2. Split fulfillment across multiple franchises based on stock availability and proximity
        let remainingItems = request.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          unitPrice: item.unitPrice,
          gstRatePercent: item.gstRatePercent,
        }));

        const allocations: Array<{ franchise: any; items: any[] }> = [];

        while (remainingItems.length > 0) {
          let bestFranchise: any = null;
          let bestItemsToAllocate: any[] = [];
          let maxMatchedCount = 0;

          for (const franchise of candidates) {
            const franchiseAllocated: any[] = [];
            let matchedCount = 0;

            for (const item of remainingItems) {
              const stockKey = `${franchise.id}_${item.productId}`;
              const stock = stockMap.get(stockKey);
              const available = stock ? stock.quantity - stock.reserved : 0;

              if (available > 0) {
                const qtyToAllocate = Math.min(item.quantity, available);
                franchiseAllocated.push({
                  ...item,
                  quantity: qtyToAllocate,
                });
                matchedCount += 1;
              }
            }

            if (matchedCount > maxMatchedCount) {
              maxMatchedCount = matchedCount;
              bestFranchise = franchise;
              bestItemsToAllocate = franchiseAllocated;
            }
          }

          if (!bestFranchise) {
            break;
          }

          allocations.push({
            franchise: bestFranchise,
            items: bestItemsToAllocate,
          });

          const allocatedMap = new Map(
            bestItemsToAllocate.map((item) => [item.productId, item.quantity]),
          );
          const nextRemaining: any[] = [];
          for (const item of remainingItems) {
            const allocatedQty = allocatedMap.get(item.productId) ?? 0;
            const remainingQty = item.quantity - allocatedQty;
            if (remainingQty > 0) {
              nextRemaining.push({
                ...item,
                quantity: remainingQty,
              });
            }
          }
          remainingItems = nextRemaining;
        }

        // If complete order quantity cannot be arranged
        if (remainingItems.length > 0) {
          const shouldAutoCancel = !isOnlinePayment && candidates.length === 0;
          if (shouldAutoCancel) {
            // For COD: Automatically cancel
            await this.prisma.$transaction(async (tx) => {
              await this.reservationService.releaseRequestReservations(
                tx,
                request.id,
                'Releasing stock for cancelled out of stock COD order',
              );

              if (existingOrder) {
                await tx.order.update({
                  where: { id: existingOrder.id },
                  data: { status: OrderStatus.CANCELLED },
                });
              }

              await tx.orderRequest.update({
                where: { id: request.id },
                data: {
                  status: OrderRequestStatus.FAILED,
                  failedAt: new Date(),
                  failureReason: 'CANCELLED - OUT OF STOCK',
                },
              });
            });

            this.events.emit(ORDER_ALLOCATION_EVENTS.ORDER_ALLOCATION_FAILED, {
              requestId: request.id,
              customerId: request.customerId,
              customerUId: request.customer?.userId ?? '',
              reason:
                'Unfortunately, the product is currently out of stock and we are unable to fulfill your order. Your order has been cancelled. We apologize for the inconvenience.',
              status: OrderRequestStatus.FAILED,
            });

            return null;
          } else {
            // For Online: Merge remaining unallocated items into the nearest active franchise
            const fallbackFranchise = candidates[0];
            let fallbackAlloc = allocations.find(
              (a) => a.franchise.id === fallbackFranchise.id,
            );
            if (!fallbackAlloc) {
              fallbackAlloc = { franchise: fallbackFranchise, items: [] };
              allocations.push(fallbackAlloc);
            }
            for (const item of remainingItems) {
              const existing = fallbackAlloc.items.find(
                (i) => i.productId === item.productId,
              );
              if (existing) {
                existing.quantity += item.quantity;
              } else {
                fallbackAlloc.items.push(item);
              }
            }
          }
        }

        // Merge duplicate allocations if any
        const mergedAllocationsMap = new Map<
          string,
          { franchise: any; items: any[] }
        >();
        for (const alloc of allocations) {
          const existing = mergedAllocationsMap.get(alloc.franchise.id);
          if (existing) {
            for (const item of alloc.items) {
              const existingItem = existing.items.find(
                (i) => i.productId === item.productId,
              );
              if (existingItem) {
                existingItem.quantity += item.quantity;
              } else {
                existing.items.push(item);
              }
            }
          } else {
            mergedAllocationsMap.set(alloc.franchise.id, {
              franchise: alloc.franchise,
              items: [...alloc.items],
            });
          }
        }
        const mergedAllocations = Array.from(mergedAllocationsMap.values());

        if (mergedAllocations.length === 1) {
          const forceFulfilled = await this.forceAssignToFranchise(
            request.id,
            mergedAllocations[0].franchise,
            mergedAllocations[0].items,
          );
          if (forceFulfilled) {
            return forceFulfilled;
          }
        } else if (mergedAllocations.length > 1) {
          const firstAlloc = mergedAllocations[0]!;
          await this.prisma.$transaction(async (tx) => {
            await tx.orderRequestItem.deleteMany({
              where: { requestId: request.id },
            });
            await tx.orderRequestItem.createMany({
              data: firstAlloc.items.map((item) => ({
                requestId: request.id,
                productId: item.productId,
                variantId: item.variantId ?? undefined,
                quantity: item.quantity,
                productName: item.productName,
                variantName: item.variantName ?? undefined,
                sku: item.sku ?? undefined,
                unitPrice: item.unitPrice,
                gstRatePercent: item.gstRatePercent ?? new Prisma.Decimal(0),
              })),
            });

            const totalAmount = firstAlloc.items.reduce(
              (sum, item) =>
                sum.add(new Prisma.Decimal(item.unitPrice).mul(item.quantity)),
              new Prisma.Decimal(0),
            );

            await tx.orderRequest.update({
              where: { id: request.id },
              data: { totalAmount },
            });
          });

          await this.forceAssignToFranchise(
            request.id,
            firstAlloc.franchise,
            firstAlloc.items,
          );

          for (let i = 1; i < mergedAllocations.length; i++) {
            const alloc = mergedAllocations[i]!;
            const totalAmount = alloc.items.reduce(
              (sum, item) =>
                sum.add(new Prisma.Decimal(item.unitPrice).mul(item.quantity)),
              new Prisma.Decimal(0),
            );

            const subRequest = await this.prisma.orderRequest.create({
              data: {
                customerId: request.customerId,
                status: OrderRequestStatus.ACCEPTED,
                latitude: request.latitude,
                longitude: request.longitude,
                addressJson:
                  request.addressJson as unknown as Prisma.InputJsonValue,
                giftMessage: request.giftMessage ?? undefined,
                giftWrap: request.giftWrap,
                giftWrapperFee: request.giftWrapperFee,
                isInterState: request.isInterState,
                cartId: request.cartId,
                requestSnapshot:
                  request.requestSnapshot as unknown as Prisma.InputJsonValue,
                maxFranchiseAttempts: request.maxFranchiseAttempts,
                attemptCount: request.attemptCount,
                proposalTimeoutMinutes: request.proposalTimeoutMinutes,
                reservationTimeoutMinutes: request.reservationTimeoutMinutes,
                totalAmount,
                selectedFranchiseId: alloc.franchise.id,
                failureReason: `Split child request from original request ${request.id}`,
                discountCode: request.discountCode,
              },
            });

            await this.prisma.orderRequestItem.createMany({
              data: alloc.items.map((item) => ({
                requestId: subRequest.id,
                productId: item.productId,
                variantId: item.variantId ?? undefined,
                quantity: item.quantity,
                productName: item.productName,
                variantName: item.variantName ?? undefined,
                sku: item.sku ?? undefined,
                unitPrice: item.unitPrice,
                gstRatePercent: item.gstRatePercent ?? new Prisma.Decimal(0),
              })),
            });

            await this.forceAssignToFranchise(
              subRequest.id,
              alloc.franchise,
              alloc.items,
            );
          }

          return request;
        }
      }
    }

    // Handled when franchises list is empty
    const failureReasonText = isOnlinePayment
      ? 'No franchise or warehouse could fulfill the request'
      : 'CANCELLED - OUT OF STOCK';
    const failureReasonMessage = isOnlinePayment
      ? 'No franchise or warehouse could fulfill the request'
      : 'Unfortunately, the product is currently out of stock and we are unable to fulfill your order. Your order has been cancelled. We apologize for the inconvenience.';

    await this.prisma.$transaction(async (tx) => {
      await this.reservationService.releaseRequestReservations(
        tx,
        request.id,
        'Releasing stock for failed order request',
      );

      if (existingOrder && !isOnlinePayment) {
        await tx.order.update({
          where: { id: existingOrder.id },
          data: { status: OrderStatus.CANCELLED },
        });
      }

      await tx.orderRequest.update({
        where: { id: request.id },
        data: {
          status: OrderRequestStatus.FAILED,
          failedAt: new Date(),
          failureReason: failureReasonText,
        },
      });
    });

    this.events.emit(ORDER_ALLOCATION_EVENTS.ORDER_ALLOCATION_FAILED, {
      requestId: request.id,
      customerId: request.customerId,
      customerUId: request.customer?.userId ?? '',
      reason: failureReasonMessage,
      status: OrderRequestStatus.FAILED,
    });

    return null;

    return null;
  }

  private async forceAssignToFranchise(
    requestId: string,
    selectedFranchise: any,
    itemsToAssign: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      productName: string;
      variantName: string | null;
      sku: string | null;
      unitPrice: Prisma.Decimal;
      gstRatePercent?: Prisma.Decimal;
    }>,
  ) {
    const created = await this.prisma.$transaction(async (tx) => {
      const db = tx as any;

      for (const item of itemsToAssign) {
        const vId = (item as any).variantId || '';
        const stock = await db.franchiseStock.findUnique({
          where: {
            franchiseId_productId_variantId: {
              franchiseId: selectedFranchise.id,
              productId: item.productId,
              variantId: vId,
            },
          },
        });
        const neededQty = item.quantity;
        const currentQty = stock?.quantity ?? 0;
        const currentReserved = stock?.reserved ?? 0;
        const available = currentQty - currentReserved;
        if (available < neededQty) {
          const shortfall = neededQty - available;
          await db.franchiseStock.upsert({
            where: {
              franchiseId_productId_variantId: {
                franchiseId: selectedFranchise.id,
                productId: item.productId,
                variantId: vId,
              },
            },
            update: { quantity: { increment: shortfall } },
            create: {
              franchiseId: selectedFranchise.id,
              productId: item.productId,
              variantId: vId,
              quantity: shortfall,
              reserved: 0,
            },
          });
        }
      }

      const request = await db.orderRequest.findUnique({
        where: { id: requestId },
        include: { items: true, customer: { select: { userId: true } } },
      });

      const requestSnapshot = (request?.requestSnapshot ?? {}) as Record<
        string,
        any
      >;
      const discountSnapshot = (requestSnapshot.discount ?? {}) as Record<
        string,
        any
      >;

      const totalAmount = itemsToAssign.reduce(
        (sum, line) =>
          sum.add(new Prisma.Decimal(line.unitPrice).mul(line.quantity)),
        new Prisma.Decimal(0),
      );

      const calculatedDiscount = new Prisma.Decimal(
        discountSnapshot.promoDiscountAmount ?? '0',
      )
        .add(new Prisma.Decimal(discountSnapshot.couponDiscountAmount ?? '0'))
        .add(
          new Prisma.Decimal(discountSnapshot.shippingDiscountAmount ?? '0'),
        );

      const originalGrandTotal = new Prisma.Decimal(
        discountSnapshot.grandTotal ?? totalAmount,
      );
      const discountFactor = originalGrandTotal.gt(0)
        ? totalAmount.div(originalGrandTotal)
        : new Prisma.Decimal(1);

      const scaledDiscount = calculatedDiscount
        .mul(discountFactor)
        .toDecimalPlaces(2);
      const franchisePaybleAmount = totalAmount.sub(scaledDiscount);

      const existingOrder = await db.order.findUnique({
        where: { orderRequestId: request.id },
      });

      const paymentMethod =
        requestSnapshot?.payment?.onlinePaymentMethod ||
        requestSnapshot?.input?.onlinePaymentMethod;
      const isOnlinePayment =
        existingOrder?.paymentMode === PaymentModeEnum.ONLINE ||
        paymentMethod === OnlinePaymentMethod.ONLINE;

      const isPaid = existingOrder
        ? existingOrder.onlinePaymentStatus === OnlinePaymentStatus.PAID
        : false;

      let orderStatus = (isOnlinePayment && !isPaid)
        ? OrderStatus.CREATED
        : OrderStatus.CONFIRMED;

      let onlinePaymentStatus = isOnlinePayment
        ? (isPaid ? OnlinePaymentStatus.PAID : OnlinePaymentStatus.UNPAID)
        : OnlinePaymentStatus.UNPAID;

      if (existingOrder) {
        onlinePaymentStatus = existingOrder.onlinePaymentStatus;
        if (existingOrder.status !== OrderStatus.CREATED) {
          orderStatus = existingOrder.status;
        }
      }

      const paymentMode = isOnlinePayment
        ? PaymentModeEnum.ONLINE
        : PaymentModeEnum.COD;

      const orderLines = itemsToAssign.map((item: any) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        productName: item.productName,
        sku: item.sku ?? null,
        variantName: item.variantName ?? null,
        unitPrice: item.unitPrice,
        mrpPrice: item.unitPrice,
        gstPercent: item.gstRatePercent ?? new Prisma.Decimal(0),
        discountAmount: scaledDiscount
          .div(itemsToAssign.length)
          .toDecimalPlaces(2),
        taxAmount: new Prisma.Decimal(0),
        finalAmount: new Prisma.Decimal(item.unitPrice).mul(item.quantity),
      }));

      const billingSnapshot = {
        kind: 'order_request_v1',
        requestId: request.id,
        discount: discountSnapshot,
        seller: {
          id: selectedFranchise.id,
          name: selectedFranchise.name,
          code: selectedFranchise.code,
        },
        lines: orderLines.map((line: any) => ({
          productId: line.productId,
          variantId: line.variantId,
          name: line.productName,
          quantity: line.quantity,
          unitPrice: new Prisma.Decimal(line.unitPrice).toFixed(2),
          sku: line.sku,
          variantName: line.variantName,
        })),
        totals: {
          grandTotal: totalAmount.toFixed(2),
        },
        isForcefullyAssigned: true,
      };

      let order;
      if (existingOrder) {
        order = await db.order.update({
          where: { id: existingOrder.id },
          data: {
            franchiseId: selectedFranchise.id,
            status: orderStatus,
            isApproved: true,
            approvedByUserId: selectedFranchise.id,
            franchisePaybleAmount,
            total: totalAmount,
            discountAmount: scaledDiscount,
            paymentMode,
            billingSnapshot:
              billingSnapshot as unknown as Prisma.InputJsonValue,
            items: {
              deleteMany: {},
              create: orderLines.map((line: any) => ({
                productId: line.productId,
                variantId: line.variantId ?? undefined,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                productName: line.productName,
                sku: line.sku ?? undefined,
                variantName: line.variantName ?? undefined,
                mrpPrice: line.mrpPrice,
                gstPercent: line.gstPercent,
                discountAmount: line.discountAmount,
                taxAmount: line.taxAmount,
                finalAmount: line.finalAmount,
              })),
            },
          },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, slug: true } },
              },
            },
            franchise: true,
          },
        });
      } else {
        order = await db.order.create({
          data: {
            orderNumber: `GF-${Date.now().toString(36).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
            orderRequestId: request.id,
            cartId: request.cartId,
            channel: OrderChannel.ONLINE,
            saleType: SaleType.DELIVERY,
            status: orderStatus,
            franchiseId: selectedFranchise.id,
            customerId: request.customerId,
            total: totalAmount,
            latitude: request.latitude,
            longitude: request.longitude,
            addressJson: JSON.stringify(request.addressJson),
            giftMessage: request.giftMessage,
            giftWrap: request.giftWrap,
            giftWrapperFee: request.giftWrapperFee,
            onlinePaymentStatus: onlinePaymentStatus,
            discountAmount: scaledDiscount,
            couponCode: discountSnapshot.discountCode ?? null,
            isApproved: true,
            approvedByUserId: selectedFranchise.id,
            franchisePaybleAmount,
            referralCode:
              (request.requestSnapshot as any)?.input?.referralCode ?? null,
            paymentMode,
            billingSnapshot:
              billingSnapshot as unknown as Prisma.InputJsonValue,
            items: {
              create: orderLines.map((line: any) => ({
                productId: line.productId,
                variantId: line.variantId ?? undefined,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                productName: line.productName,
                sku: line.sku ?? undefined,
                variantName: line.variantName ?? undefined,
                mrpPrice: line.mrpPrice,
                gstPercent: line.gstPercent,
                discountAmount: line.discountAmount,
                taxAmount: line.taxAmount,
                finalAmount: line.finalAmount,
              })),
            },
          },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, slug: true } },
              },
            },
            franchise: true,
          },
        });
      }

      // Release initial temporary reservation before reserving for the forcefully assigned franchise
      await this.reservationService.releaseOrderReservations(tx, order.id, 'Released warehouse reservation before forceful assignment');

      const reservations = await this.reservationService.reserveForOrder(tx, {
        orderId: order.id,
        requestId: request.id,
        franchiseId: selectedFranchise.id,
        items: itemsToAssign.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        expiresAt: new Date(
          Date.now() + this.reservationTimeoutMinutes() * 60_000,
        ),
        note: 'Reserved after forceful assignment',
      });

      for (const reservation of reservations) {
        if (reservation.expiresAt) {
          void this.orderAllocationQueue.enqueueReservationExpiration(
            reservation.id,
            Math.max(1000, reservation.expiresAt.getTime() - Date.now()),
          );
        }
      }

      if (order.onlinePaymentStatus === OnlinePaymentStatus.PAID) {
        await this.reservationService.consumeOrderReservations(tx, order.id);
      }

      await db.orderRequest.update({
        where: { id: request.id },
        data: {
          status: OrderRequestStatus.ACCEPTED,
          selectedFranchiseId: selectedFranchise.id,
          acceptedProposalId: null,
          actualOrderId: order.id,
          acceptedAt: new Date(),
          failureReason:
            'Forcefully assigned nearest franchise after all options exhausted.',
        },
      });

      await db.franchiseProposal.updateMany({
        where: {
          requestId: request.id,
          status: ProposalStatus.SENT,
        },
        data: {
          status: ProposalStatus.CANCELLED,
          cancellationNote: 'Order forcefully assigned to nearest franchise',
          respondedAt: new Date(),
        },
      });
      if (request.discountCode) {
        await this.orderDiscountService.consumeCouponUsage(tx, {
          discountCode: request.discountCode,
          customerId: request.customerId,
          orderId: order.id,
        });
      }

      return { order, request };
    });

    this.events.emit(ORDER_ALLOCATION_EVENTS.ORDER_CREATED, {
      requestId: created.request.id,
      orderId: created.order.id,
      orderNumber: created.order.orderNumber,
      customerId: created.request.customerId,
      customerUId: created.request.customer?.userId ?? '',
      franchiseId: selectedFranchise.id,
      totalAmount:
        created.order.total instanceof Prisma.Decimal
          ? created.order.total.toFixed(2)
          : String(created.order.total),
      isForcefullyAssigned: true,
    });

    try {
      await this.invoiceService.generatedInvoice({
        orderNumber: created.order.orderNumber,
      } as any);
    } catch (invoiceError: any) {
      this.logger.error(
        `Failed to generate invoice for forcefully assigned order ${created.order.orderNumber}: ${invoiceError.message}`,
      );
    }

    return created.order;
  }

  private async findEligibleFranchises(
    request: {
      id: string;
      latitude: number;
      longitude: number;
      items: Array<{ productId: string; quantity: number }>;
      maxFranchiseAttempts: number;
      attemptCount: number;
      proposals: Array<{ franchiseId: string }>;
      requestSnapshot?: Prisma.JsonValue;
    },
    attemptedFranchiseIds: Set<string>,
  ): Promise<FranchiseCandidate[]> {
    const franchises = await this.prisma.franchise.findMany({
      where: {
        status: FranchiseStatus.ACTIVE,
        code: { notIn: ['CENTRAL_WAREHOUSE', 'ADMIN-HQ'] },
      },
      select: {
        id: true,
        name: true,
        code: true,
        latitude: true,
        longitude: true,
      },
    });

    const snapshot = request.requestSnapshot as any;
    const targetFranchiseId =
      snapshot?.targetFranchiseId || snapshot?.input?.targetFranchiseId;

    let filteredFranchises = franchises;
    if (targetFranchiseId) {
      filteredFranchises = franchises.filter((f) => f.id === targetFranchiseId);
    }

    let candidateMap = filteredFranchises
      .filter((franchise) => !attemptedFranchiseIds.has(franchise.id))
      .map((franchise) => ({
        id: franchise.id,
        name: franchise.name,
        code: franchise.code,
        latitude: franchise.latitude,
        longitude: franchise.longitude,
        distanceKm: haversineDistanceKm(
          request.latitude,
          request.longitude,
          franchise.latitude,
          franchise.longitude,
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (candidateMap.length === 0) {
      return [];
    }

    const productIds = request.items.map((item) => item.productId);
    const warehouseStocks = await this.prisma.warehouseStock.findMany({
      where: { productId: { in: productIds } },
    });
    let warehouseHasStock = warehouseStocks.length === productIds.length;
    const wsMap = new Map(warehouseStocks.map((ws) => [ws.productId, ws]));
    for (const item of request.items) {
      const ws = wsMap.get(item.productId);
      const available = (ws?.quantity ?? 0) - (ws?.reserved ?? 0);
      if (!ws || available < item.quantity) {
        warehouseHasStock = false;
        break;
      }
    }

    if (!warehouseHasStock) {
      const bestFranchiseIds = await this.findFranchisesWithMaxProducts(
        this.prisma,
        request.items,
        request.id,
      );
      candidateMap = candidateMap.filter((c) => bestFranchiseIds.has(c.id));
    }

    const [stocks, requestReservations] = await Promise.all([
      this.prisma.franchiseStock.findMany({
        where: {
          franchiseId: { in: candidateMap.map((candidate) => candidate.id) },
          productId: { in: productIds },
        },
        select: {
          franchiseId: true,
          productId: true,
          quantity: true,
          reserved: true,
        },
      }),
      this.prisma.inventoryReservation.findMany({
        where: {
          orderRequestId: request.id,
          status: 'ACTIVE',
        },
        select: {
          franchiseId: true,
          productId: true,
          quantity: true,
        },
      }),
    ]);

    const reservedByProduct = new Map<string, number>();
    for (const res of requestReservations) {
      if (res.franchiseId) {
        const key = `${res.franchiseId}_${res.productId}`;
        reservedByProduct.set(
          key,
          (reservedByProduct.get(key) ?? 0) + res.quantity,
        );
      }
    }

    const availability = new Map<string, Map<string, number>>();
    for (const stock of stocks) {
      const byProduct =
        availability.get(stock.franchiseId) ?? new Map<string, number>();
      const key = `${stock.franchiseId}_${stock.productId}`;
      const selfReserved = reservedByProduct.get(key) ?? 0;
      byProduct.set(
        stock.productId,
        stock.quantity - stock.reserved + selfReserved,
      );
      availability.set(stock.franchiseId, byProduct);
    }

    return candidateMap.filter((candidate) => {
      const byProduct = availability.get(candidate.id);
      if (!byProduct) {
        return false;
      }
      for (const line of request.items) {
        if ((byProduct.get(line.productId) ?? 0) < line.quantity) {
          return false;
        }
      }
      return true;
    });
  }

  private async tryWarehouseFallback(request: {
    id: string;
    customerId: string;
    customer?: { userId: string } | null;
    latitude: number;
    longitude: number;
    addressJson: Prisma.JsonValue;
    giftMessage: string | null;
    giftWrap: boolean | null;
    giftWrapperFee: Prisma.Decimal | null;
    requestSnapshot?: Prisma.JsonValue;
    cartId?: string | null;
    items: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      productName: string;
      variantName: string | null;
      sku: string | null;
      unitPrice: Prisma.Decimal;
    }>;
  }) {
    let isOnlinePayment = false;
    const created = await this.prisma.$transaction(async (tx) => {
      // Safely upsert a Central Warehouse to satisfy the Foreign Key constraint for franchiseId
      const warehouseFranchise = await tx.franchise.upsert({
        where: { code: 'CENTRAL_WAREHOUSE' },
        update: {},
        create: {
          name: 'Central Warehouse',
          code: 'CENTRAL_WAREHOUSE',
          status: FranchiseStatus.ACTIVE,
          latitude: request.latitude,
          longitude: request.longitude,
          addressLine1: 'Central Fulfillment Center',
          city: 'HQ',
          postalCode: '000000',
          country: 'INDIA',
        },
      });

      const totalAmount = request.items.reduce(
        (sum, line) => sum.add(line.unitPrice.mul(line.quantity)),
        new Prisma.Decimal(0),
      );

      const requestSnapshot = (request?.requestSnapshot ?? {}) as Record<
        string,
        any
      >;
      const paymentSnapshot = (requestSnapshot.payment ?? {}) as Record<
        string,
        any
      >;
      let fallbackOrder;
      const existingOrder = await tx.order.findUnique({
        where: { orderRequestId: request.id },
      });

      const onlinePaymentMethod = paymentSnapshot.onlinePaymentMethod;
      isOnlinePayment = onlinePaymentMethod === OnlinePaymentMethod.ONLINE;
      const isPaid = existingOrder?.onlinePaymentStatus === OnlinePaymentStatus.PAID;
      const orderStatus = (isOnlinePayment && !isPaid)
        ? OrderStatus.CREATED
        : OrderStatus.CONFIRMED;

      if (existingOrder) {
        fallbackOrder = await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            status: orderStatus,
            franchiseId: warehouseFranchise.id,
            isApproved: false,
            approvedByUserId: null,
          },
        });
      } else {
        fallbackOrder = await tx.order.create({
          data: {
            saleType: SaleType.DELIVERY,
            orderNumber: `WH-${Date.now().toString(36).toUpperCase()}`,
            orderRequestId: request.id,
            cartId: request.cartId,
            status: orderStatus,
            channel: OrderChannel.ONLINE,
            franchiseId: warehouseFranchise.id,
            customerId: request.customerId,
            total: totalAmount,
            latitude: request.latitude,
            longitude: request.longitude,
            addressJson: JSON.stringify(request.addressJson),
            giftMessage: request.giftMessage ?? undefined,
            giftWrap: request.giftWrap,
            giftWrapperFee: request.giftWrapperFee,
            isApproved: false,
            approvedByUserId: null,
            referralCode:
              (request.requestSnapshot as any)?.input?.referralCode ?? null,
            paymentMode: isOnlinePayment
              ? PaymentModeEnum.ONLINE
              : PaymentModeEnum.COD,
            items: {
              create: request.items.map((line) => ({
                productId: line.productId,
                variantId: line.variantId ?? undefined,
                quantity: line.quantity,
                productName: line.productName,
                variantName: line.variantName ?? undefined,
                sku: line.sku ?? undefined,
                unitPrice: line.unitPrice,
                mrpPrice: line.unitPrice,
                gstPercent: 0,
                discountAmount: 0,
                taxAmount: 0,
                finalAmount: line.unitPrice.mul(line.quantity),
              })),
            },
          },
        });
      }

      await tx.orderRequest.update({
        where: { id: request.id },
        data: {
          status: OrderRequestStatus.FULFILLED_BY_WAREHOUSE,
          actualOrderId: fallbackOrder.id,
          failureReason:
            'All franchises rejected. Forcefully saved as fallback Order.',
        },
      });

      // Release initial temporary reservation before reserving for the fallback warehouse
      await this.reservationService.releaseOrderReservations(tx, fallbackOrder.id, 'Released previous reservation before warehouse fallback');

      const reservations = await this.reservationService.reserveForOrder(tx, {
        orderId: fallbackOrder.id,
        requestId: request.id,
        franchiseId: warehouseFranchise.id,
        items: request.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        expiresAt: new Date(
          Date.now() + this.reservationTimeoutMinutes() * 60_000,
        ),
        note: 'Reserved after warehouse fallback',
      });

      for (const reservation of reservations) {
        if (reservation.expiresAt) {
          void this.orderAllocationQueue.enqueueReservationExpiration(
            reservation.id,
            Math.max(1000, reservation.expiresAt.getTime() - Date.now()),
          );
        }
      }

      if (fallbackOrder.onlinePaymentStatus === OnlinePaymentStatus.PAID) {
        await this.reservationService.consumeOrderReservations(
          tx,
          fallbackOrder.id,
        );
      }

      return fallbackOrder;
    });

    this.events.emit(ORDER_ALLOCATION_EVENTS.ORDER_CREATED, {
      requestId: request.id,
      orderId: created.id,
      orderNumber: created.orderNumber,
      customerId: request.customerId,
      customerUId: request.customer?.userId ?? '',
      franchiseId: 'WAREHOUSE',
      totalAmount:
        created.total instanceof Prisma.Decimal
          ? created.total.toFixed(2)
          : String(created.total),
    });

    try {
      await this.invoiceService.generatedInvoice({
        orderNumber: created.orderNumber,
      } as any);
    } catch (invoiceError: any) {
      this.logger.error(
        `Failed to generate invoice for fallback order ${created.orderNumber}: ${invoiceError.message}`,
      );
    }

    // Payment expiration timer is enqueued at order request creation time.

    return created;
  }

  async expireOnlinePayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) return;
    if (
      order.paymentMode === PaymentModeEnum.COD ||
      order.onlinePaymentStatus === OnlinePaymentStatus.PAID ||
      order.status === OrderStatus.CANCELLED
    ) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.reservationService.releaseOrderReservations(
        tx,
        orderId,
        `Online payment timed out (${this.paymentExpiryMinutes()} minutes)`,
      );
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          onlinePaymentStatus: OnlinePaymentStatus.FAILED,
        },
      });
    });
    this.logger.log(
      `[Payment Timeout] Order ${order.orderNumber} cancelled because payment was not completed within ${this.paymentExpiryMinutes()} minutes.`,
    );
  }

  private isRequestCod(request: {
    requestSnapshot?: Prisma.JsonValue;
  }): boolean {
    const snapshot = request.requestSnapshot as any;
    const paymentMethod =
      snapshot?.payment?.onlinePaymentMethod ||
      snapshot?.input?.onlinePaymentMethod;
    return (
      paymentMethod === 'COD' ||
      paymentMethod === OnlinePaymentMethod.COD ||
      paymentMethod === PaymentModeEnum.COD
    );
  }

  private async findFranchisesWithMaxProducts(
    tx: Prisma.TransactionClient | PrismaService,
    requestItems: Array<{ productId: string; quantity: number }>,
    requestRequestId: string,
  ): Promise<Set<string>> {
    const productIds = requestItems.map((item) => item.productId);

    const activeFranchises = await tx.franchise.findMany({
      where: {
        status: FranchiseStatus.ACTIVE,
        code: { notIn: ['CENTRAL_WAREHOUSE', 'ADMIN-HQ'] },
      },
      select: {
        id: true,
      },
    });

    if (activeFranchises.length === 0) {
      return new Set<string>();
    }

    const franchiseIds = activeFranchises.map((f: any) => f.id);

    const stocks = await tx.franchiseStock.findMany({
      where: {
        franchiseId: { in: franchiseIds },
        productId: { in: productIds },
      },
      select: {
        franchiseId: true,
        productId: true,
        quantity: true,
        reserved: true,
      },
    });

    const requestReservations = await tx.inventoryReservation.findMany({
      where: {
        orderRequestId: requestRequestId,
        status: 'ACTIVE',
      },
      select: {
        franchiseId: true,
        productId: true,
        quantity: true,
      },
    });

    const reservedByProduct = new Map<string, number>();
    for (const res of requestReservations) {
      if (res.franchiseId) {
        const key = `${res.franchiseId}_${res.productId}`;
        reservedByProduct.set(
          key,
          (reservedByProduct.get(key) ?? 0) + res.quantity,
        );
      }
    }

    const availability = new Map<string, Map<string, number>>();
    for (const stock of stocks) {
      const byProduct =
        availability.get(stock.franchiseId) ?? new Map<string, number>();
      const key = `${stock.franchiseId}_${stock.productId}`;
      const selfReserved = reservedByProduct.get(key) ?? 0;
      byProduct.set(
        stock.productId,
        stock.quantity - stock.reserved + selfReserved,
      );
      availability.set(stock.franchiseId, byProduct);
    }

    let maxMatchingCount = 0;
    let maxTotalQty = 0;

    const scores = activeFranchises.map((f: any) => {
      let matchingCount = 0;
      let totalQty = 0;
      const byProduct = availability.get(f.id);
      if (byProduct) {
        for (const item of requestItems) {
          const available = byProduct.get(item.productId) ?? 0;
          if (available > 0) {
            matchingCount += 1;
            totalQty += Math.min(item.quantity, available);
          }
        }
      }
      if (matchingCount > maxMatchingCount) {
        maxMatchingCount = matchingCount;
        maxTotalQty = totalQty;
      } else if (matchingCount === maxMatchingCount) {
        if (totalQty > maxTotalQty) {
          maxTotalQty = totalQty;
        }
      }
      return {
        id: f.id,
        matchingCount,
        totalQty,
      };
    });

    const bestFranchiseIds = new Set<string>();
    if (maxMatchingCount > 0) {
      for (const score of scores) {
        if (
          score.matchingCount === maxMatchingCount &&
          score.totalQty === maxTotalQty
        ) {
          bestFranchiseIds.add(score.id);
        }
      }
    }

    return bestFranchiseIds;
  }
}
