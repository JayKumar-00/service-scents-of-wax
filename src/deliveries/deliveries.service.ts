import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoService } from 'src/notification/services/brevo.service';
import { InvoiceService } from 'src/invoice/invoice.service';
import { InvoiceHtmlBuilder } from 'src/invoice/template/invoice-html.builder';
import { PdfGenerator } from 'src/common/utils/pdf-generator.util';
import { DeliveryEmailBuilder } from './template/delivery-email.builder';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import {
  DeliveryStatus,
  InventoryReservationKind,
  InventoryReservationStatus,
  InboundDiscrepancyStatus,
  Prisma,
  Shipment,
  Role,
  StockRequestPaymentStatus,
  InboundDelivery,
  OrderStatus,
  StockRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import { franchiseCanMutate } from '../common/franchise-roles';
import { AuditService } from '../audit/audit.service';
import { DomainEventsService } from '../supply-chain/domain-events.service';
import { DeliveryQueryDto } from './dto/delivery-query.dto';
import {
  buildSortOrder,
  normalizePositiveInteger,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { buildPrismaTextSearchFilter } from 'src/common/utils/search.util';
import {
  buildPrismaDateRangeFilter,
  buildPrismaRatingRangeFilter,
} from 'src/products/utils/range-filter.util';
import { OrderType } from 'src/common/dto/query.dto';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { DeliveryShipmentDto } from './dto/delivery-shipment.dto';
import {
  UnifiedListQueryDto,
  UnifiedTypeEnum,
} from './dto/unified-list-query.dto';
import { UpdateDeliveryMetaDto } from './dto/update-delivery-meta.dto';

const DELIVERY_PRODUCT_SELECT = {
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
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    private readonly brevoService: BrevoService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => InvoiceService))
    private readonly invoiceService: InvoiceService,
  ) {}

  private buildDeliverySortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, [
      'createdAt',
      'status',
      'carrier',
      'expectedAt',
      'deliveredAt',
      'dispatchedAt',
      'quantityReceived',
    ]);

  private buildShipmentSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'deliveredAt', 'status']);

  async list(
    query: DeliveryQueryDto,
  ): Promise<{ data: InboundDelivery[]; meta: IMeta }> {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
          OR: [
            {
              stockRequest: {
                product: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              franchise: {
                name: { contains: search, mode: 'insensitive' },
                ownerFullName: { contains: search, mode: 'insensitive' },
                ownerEmail: { contains: search, mode: 'insensitive' },
                state: { contains: search, mode: 'insensitive' },
                city: { contains: search, mode: 'insensitive' },
                postalCode: { contains: search, mode: 'insensitive' },
                country: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.stockApplied !== null && query.stockApplied !== undefined) {
      clauses.push({
        stockApplied: query.stockApplied.includes('true') ? true : false,
      });
    }

    if (query.status) {
      clauses.push({ status: q.status });
    }

    if (query.carrier) {
      clauses.push({ carrier: { contains: q.carrier, mode: 'insensitive' } });
    }

    if (query.trackingCode) {
      clauses.push({
        trackingCode: { contains: q.trackingCode, mode: 'insensitive' },
      });
    }

    if (query.deliveryFrom || query.deliveryTo) {
      const deliveredAt = buildPrismaDateRangeFilter({
        fromDate: query.deliveryFrom,
        toDate: query.deliveryTo,
      });

      if (deliveredAt) {
        clauses.push({ deliveredAt });
      }
    }

    if (query.expectedFrom || query.expectedTo) {
      const expectedAt = buildPrismaDateRangeFilter({
        fromDate: query.expectedFrom,
        toDate: query.expectedTo,
      });

      if (expectedAt) {
        clauses.push({ expectedAt });
      }
    }

    if (query.transportLaneId) {
      clauses.push({ transportLaneId: q.transportLaneId });
    }

    if (
      query.mindamagedQuantity !== null &&
      query.mindamagedQuantity !== undefined
    ) {
      const damagedQuantity = buildPrismaRatingRangeFilter({
        minRatingOrComment: query.mindamagedQuantity,
        maxRatingOrComment: query.maxdamagedQuantity,
      });

      if (damagedQuantity) {
        clauses.push({ damagedQuantity });
      }
    }

    if (query.discrepancyStatus) {
      clauses.push({ discrepancyStatus: query.discrepancyStatus });
    }

    if (query.franchiseId) {
      clauses.push({ franchise: { id: query.franchiseId } });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildDeliverySortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.inboundDelivery as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        franchise: true,
        // category: categoryIncludeBreadcrumb,
        // brandRef: true,
        // variants: true,
        stockRequest: {
          include: { product: { select: DELIVERY_PRODUCT_SELECT } },
        },
      },
    });

    // paged.data = paged.data.map((p: any) =>
    //   this.mapProductResponse(this.applyAwsPrefixToProduct(p)),
    // );

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;
    /*
    if (user.role === Role.SUPERADMIN) {
      return this.prisma.inboundDelivery.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          franchise: true,
          stockRequest: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      });
    }
    if (franchiseHasReadAccess(user.role)) {
      const allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      if (!allowedFranchiseId) return [];
      return this.prisma.inboundDelivery.findMany({
        where: { franchiseId: allowedFranchiseId },
        orderBy: { createdAt: 'desc' },
        include: {
          stockRequest: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      });
    }
    return [];
    */
  }

  async listWithShipments(
    query: DeliveryShipmentDto,
  ): Promise<{ data: Shipment[]; meta: IMeta }> {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const shipmentId = q.shipmentId?.trim();
    if (shipmentId) {
      clauses.push({ shipmentId });
    }

    const orderId = q.orderId?.trim();
    if (orderId) {
      clauses.push({ orderId });
    }

    const courierName = q.courierName?.trim();
    if (courierName) {
      clauses.push({
        courierName: { contains: courierName, mode: 'insensitive' },
      });
    }

    const trackingNumber = q.trackingNumber?.trim();
    if (trackingNumber) {
      clauses.push({ trackingNumber });
    }

    if (q.status) {
      clauses.push({ status: q.status });
    }

    const franchiseId = q.franchiseId?.trim();
    if (franchiseId) {
      clauses.push({ franchiseId: franchiseId });
    }

    const searchFilter = buildPrismaTextSearchFilter(q.search, [
      'shipmentId',
      'orderId',
      'trackingNumber',
      'courierName',
    ]);

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildShipmentSortOrder(q.sortBy, q.order);

    return paginatePrisma<Shipment>({
      model: this.prisma.shipment as any,
      where,
      orderBy,
      page,
      limit,
    });
  }

  async updateMeta(
    id: string,
    body: UpdateDeliveryMetaDto,
    user: JwtUser,
    ip?: string,
  ) {
    if (user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }
    const row = await this.prisma.inboundDelivery.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Delivery not found');

    let expectedAt: Date | null | undefined = undefined;
    if (body.expectedAt !== undefined) {
      if (body.expectedAt === null || body.expectedAt === '') {
        expectedAt = null;
      } else {
        const d = new Date(body.expectedAt);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('Invalid expectedAt date');
        }
        expectedAt = d;
      }
    }

    const carrier =
      body.carrier === undefined
        ? undefined
        : body.carrier === ''
          ? null
          : body.carrier;
    const trackingCode =
      body.trackingCode === undefined
        ? undefined
        : body.trackingCode === ''
          ? null
          : body.trackingCode;

    let slaDueAt: Date | null | undefined = undefined;
    if (body.slaDueAt !== undefined) {
      if (body.slaDueAt === null || body.slaDueAt === '') {
        slaDueAt = null;
      } else {
        const d = new Date(body.slaDueAt);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('Invalid slaDueAt date');
        }
        slaDueAt = d;
      }
    }

    const transportLaneId =
      body.transportLaneId === undefined
        ? undefined
        : body.transportLaneId === ''
          ? null
          : body.transportLaneId;
    const carrierReference =
      body.carrierReference === undefined
        ? undefined
        : body.carrierReference === ''
          ? null
          : body.carrierReference;
    const discrepancyNote =
      body.discrepancyNote === undefined
        ? undefined
        : body.discrepancyNote === ''
          ? null
          : body.discrepancyNote;

    const asnPayload =
      body.asnPayload === undefined
        ? undefined
        : (body.asnPayload as Prisma.InputJsonValue);

    if (body.transportLaneId?.trim()) {
      const lane = await this.prisma.transportLane.findUnique({
        where: { id: body.transportLaneId },
      });
      if (!lane) {
        throw new BadRequestException(
          `Transport lane should be valid & that should be exist on 'TransportLane'`,
        );
      }
    }

    const updated = await this.prisma.inboundDelivery.update({
      where: { id },
      data: {
        carrier,
        trackingCode,
        expectedAt: expectedAt === undefined ? undefined : expectedAt,
        transportLaneId,
        carrierReference,
        slaDueAt: slaDueAt === undefined ? undefined : slaDueAt,
        asnPayload,
        ...(body.quantityShipped !== undefined
          ? { quantityShipped: body.quantityShipped }
          : {}),
        ...(body.quantityReceived !== undefined
          ? { quantityReceived: body.quantityReceived }
          : {}),
        discrepancyNote,
        ...(body.damagedQuantity !== undefined
          ? { damagedQuantity: body.damagedQuantity }
          : {}),
      },
      include: {
        franchise: true,
        stockRequest: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'DELIVERY_META_UPDATE',
        resource: 'InboundDelivery',
        resourceId: id,
        metadata: {
          carrier: updated.carrier,
          trackingCode: updated.trackingCode,
          expectedAt: updated.expectedAt?.toISOString() ?? null,
          transportLaneId: updated.transportLaneId,
          carrierReference: updated.carrierReference,
        },
        ip,
      }),
      'DELIVERY_META_UPDATE',
    );

    const node = await this.prisma.stockingNode.findFirst({
      where: { franchiseId: updated.franchiseId },
    });
    void this.domainEvents.emit(
      'shipment.meta_updated',
      {
        deliveryId: updated.id,
        franchiseId: updated.franchiseId,
        stockRequestId: updated.stockRequestId,
      },
      {
        refType: 'INBOUND_DELIVERY',
        refId: updated.id,
        stockingNodeId: node?.id,
      },
    );

    return updated;
  }

  private stockPaymentCleared(
    sr: {
      paymentStatus: StockRequestPaymentStatus;
    } | null,
  ): boolean {
    if (!sr) return true;
    return (
      sr.paymentStatus === StockRequestPaymentStatus.PAID ||
      sr.paymentStatus === StockRequestPaymentStatus.WAIVED
    );
  }

  private assertPaymentAllowsDispatchOrReceipt(
    sr: { paymentStatus: StockRequestPaymentStatus } | null,
    status: DeliveryStatus,
  ): void {
    const cleared = this.stockPaymentCleared(sr);
    if (
      !cleared &&
      (status === DeliveryStatus.IN_TRANSIT ||
        status === DeliveryStatus.DELIVERED)
    ) {
      throw new BadRequestException(
        'Record payment on this stock order (or waive it) before dispatch or delivery confirmation.',
      );
    }
  }

  /** Expected units for this inbound (approved qty capped by shipped when ASN/shipped is known). */
  private expectedInboundQty(
    row: { quantityShipped: number | null },
    sr: { approvedQuantity: number | null; quantity: number },
  ): number {
    const base = sr.approvedQuantity ?? sr.quantity;
    if (row.quantityShipped != null && row.quantityShipped > 0) {
      return Math.min(base, row.quantityShipped);
    }
    return base;
  }

  private assertTransition(
    prev: DeliveryStatus,
    next: DeliveryStatus,
    user: JwtUser,
  ): void {
    if (prev === next) return;

    const isSuperadmin = user.role === Role.SUPERADMIN;

    if (franchiseCanMutate(user.role)) {
      if (next === DeliveryStatus.DELIVERED) {
        if (prev !== DeliveryStatus.IN_TRANSIT) {
          throw new BadRequestException(
            'Confirm receipt only after head office marks the shipment as in transit.',
          );
        }
        return;
      }
      if (next === DeliveryStatus.IN_TRANSIT) {
        if (prev !== DeliveryStatus.SCHEDULED) {
          throw new BadRequestException(
            'You can mark in transit only while the shipment is scheduled.',
          );
        }
        return;
      }
      throw new ForbiddenException('You cannot set this shipment status.');
    }

    if (!isSuperadmin) {
      throw new ForbiddenException();
    }

    const allowed: Record<DeliveryStatus, DeliveryStatus[]> = {
      SCHEDULED: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.CANCELLED],
      IN_TRANSIT: [
        DeliveryStatus.DELIVERED,
        DeliveryStatus.SCHEDULED,
        DeliveryStatus.CANCELLED,
      ],
      DELIVERED: [DeliveryStatus.IN_TRANSIT],
      CANCELLED: [DeliveryStatus.SCHEDULED],
    };

    const ok = allowed[prev]?.includes(next);
    if (!ok) {
      throw new BadRequestException(
        `Illegal status transition: ${prev} → ${next}. To undo receipt, move from delivered back to in transit first; to cancel after delivery, undo receipt first.`,
      );
    }
  }

  async updateStatus(
    id: string,
    status: DeliveryStatus,
    user: JwtUser,
    ip?: string,
  ) {
    const row = await this.prisma.inboundDelivery.findUnique({
      where: { id },
      include: {
        stockRequest: {
          select: {
            id: true,
            productId: true,
            approvedQuantity: true,
            quantity: true,
            paymentStatus: true,
            status: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Delivery not found');
    }

    if (franchiseCanMutate(user.role)) {
      const allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      if (!allowedFranchiseId || allowedFranchiseId !== row.franchiseId) {
        throw new ForbiddenException();
      }
    } else if (user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }

    let deliveryIds = [id];
    const asnPayload: any = row.asnPayload;
    if (asnPayload && asnPayload.bundleId) {
      const assignment = await this.prisma.franchiseBundleAssignment.findUnique({
        where: {
          franchiseId_bundleId: {
            franchiseId: row.franchiseId,
            bundleId: asnPayload.bundleId,
          }
        }
      });
      if (assignment && assignment.provisionedItems && Array.isArray(assignment.provisionedItems)) {
        const ids = (assignment.provisionedItems as any[])
          .map((item: any) => item.inboundDeliveryId)
          .filter(Boolean);
        if (ids.length > 0) {
          deliveryIds = Array.from(new Set([...deliveryIds, ...ids]));
        }
      }
    }

    const primaryPrevStatus = row.status;

    if (primaryPrevStatus === status) {
      return this.prisma.inboundDelivery.findUnique({
        where: { id },
        include: {
          franchise: true,
          stockRequest: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      });
    }

    this.assertTransition(primaryPrevStatus, status, user);
    this.assertPaymentAllowsDispatchOrReceipt(row.stockRequest, status);

    const results = await this.prisma.$transaction(async (tx) => {
      const updatedDeliveries = [];
      for (const currentDeliveryId of deliveryIds) {
        const live = await tx.inboundDelivery.findUnique({
          where: { id: currentDeliveryId },
          include: {
            stockRequest: {
              select: {
                id: true,
                productId: true,
                approvedQuantity: true,
                quantity: true,
                paymentStatus: true,
                status: true,
              },
            },
          },
        });
        if (!live) continue;
        const srLive = live.stockRequest;
        const prevStatus = live.status;

        if (prevStatus === status) {
          const unchanged = await tx.inboundDelivery.findUnique({
            where: { id: currentDeliveryId },
            include: {
              franchise: true,
              stockRequest: {
                include: {
                  product: { select: { id: true, name: true, slug: true, category: { select: { name: true } } } },
                },
              },
            },
          });
          if (unchanged) updatedDeliveries.push({ delivery: unchanged, prevStatus });
          continue;
        }

        const revertStock =
          prevStatus === DeliveryStatus.DELIVERED &&
          live.stockApplied &&
          srLive != null &&
          status !== DeliveryStatus.DELIVERED;

        if (revertStock && srLive) {
          const qty = this.expectedInboundQty(live, srLive);
          const vId = srLive.variantId || (live.asnPayload as any)?.variantId || '';
          const fs = await tx.franchiseStock.findUnique({
            where: {
              franchiseId_productId_variantId: {
                franchiseId: live.franchiseId,
                productId: srLive.productId,
                variantId: vId,
              },
            },
          });
          if (!fs || fs.quantity < qty) {
            throw new BadRequestException(
              'Cannot undo delivery: franchise stock is lower than this shipment quantity (adjust inventory first).',
            );
          }

          await tx.franchiseStock.update({
            where: {
              franchiseId_productId_variantId: {
                franchiseId: live.franchiseId,
                productId: srLive.productId,
                variantId: vId,
              },
            },
            data: { quantity: { decrement: qty } },
          });

          fireAndForget(
            this.audit.log({
              userId: user.sub,
              action: 'franchise_stock.update',
              resource: 'FranchiseStock',
              resourceId: `${live.franchiseId}:${srLive.productId}:${vId}`,
              metadata: {
                franchiseId: live.franchiseId,
                productId: srLive.productId,
                variantId: vId,
                actionType: 'DECREMENT',
                changeQuantity: qty,
                reason: 'Revert delivery stock',
              },
              ip,
            }),
          );
        }

        const applyStock =
          !revertStock &&
          status === DeliveryStatus.DELIVERED &&
          prevStatus !== DeliveryStatus.DELIVERED &&
          !live.stockApplied &&
          live.stockRequestId != null &&
          srLive != null;

        if (applyStock && srLive) {
          const expected = this.expectedInboundQty(live, srLive);
          const receivedBefore = live.quantityReceived ?? 0;
          const remainder = Math.max(0, expected - receivedBefore);
          if (remainder > 0) {
            const vId = srLive.variantId || (live.asnPayload as any)?.variantId || '';
            await tx.franchiseStock.upsert({
              where: {
                franchiseId_productId_variantId: {
                  franchiseId: live.franchiseId,
                  productId: srLive.productId,
                  variantId: vId,
                },
              },
              create: {
                franchiseId: live.franchiseId,
                productId: srLive.productId,
                variantId: vId,
                quantity: remainder,
              },
              update: { quantity: { increment: remainder } },
            });

            fireAndForget(
              this.audit.log({
                userId: user.sub,
                action: 'franchise_stock.update',
                resource: 'FranchiseStock',
                resourceId: `${live.franchiseId}:${srLive.productId}:${vId}`,
                metadata: {
                  franchiseId: live.franchiseId,
                  productId: srLive.productId,
                  variantId: vId,
                  actionType: 'INCREMENT',
                  changeQuantity: remainder,
                  reason: 'Apply delivery stock',
                },
                ip,
              }),
            );
          }
        }

        let nextStockApplied = live.stockApplied;
        if (revertStock) nextStockApplied = false;
        else if (applyStock) nextStockApplied = true;

        let dispatchedPatch: Date | null | undefined = undefined;
        let partialUndoQty = 0;
        if (
          status === DeliveryStatus.IN_TRANSIT &&
          prevStatus !== DeliveryStatus.IN_TRANSIT
        ) {
          if (srLive) {
            const qty = this.expectedInboundQty(live, srLive);
            const activeRes = await tx.inventoryReservation.findFirst({
              where: {
                stockRequestId: srLive.id,
                kind: InventoryReservationKind.CENTRAL_STOCK_REQUEST,
                status: InventoryReservationStatus.ACTIVE,
              },
              orderBy: { createdAt: 'asc' },
            });
            if (activeRes) {
              const ws = await tx.warehouseStock.findUnique({
                where: { productId: srLive.productId },
              });
              if (!ws || ws.quantity < qty || ws.reserved < qty) {
                throw new BadRequestException(
                  'Central reservation out of sync for dispatch',
                );
              }
              await tx.warehouseStock.update({
                where: { productId: srLive.productId },
                data: {
                  quantity: { decrement: qty },
                  reserved: { decrement: qty },
                },
              });
              await tx.inventoryReservation.update({
                where: { id: activeRes.id },
                data: {
                  status: InventoryReservationStatus.CONSUMED,
                  note: 'Consumed on dispatch',
                },
              });
            }
          }
          dispatchedPatch = live.dispatchedAt ?? new Date();
        } else if (
          status === DeliveryStatus.SCHEDULED &&
          prevStatus === DeliveryStatus.IN_TRANSIT &&
          user.role === Role.SUPERADMIN
        ) {
          dispatchedPatch = null;
          if (srLive) {
            const qty = this.expectedInboundQty(live, srLive);
            await tx.warehouseStock.update({
              where: { productId: srLive.productId },
              data: {
                quantity: { increment: qty },
                reserved: { increment: qty },
              },
            });
            await tx.inventoryReservation.create({
              data: {
                kind: InventoryReservationKind.CENTRAL_STOCK_REQUEST,
                status: InventoryReservationStatus.ACTIVE,
                productId: srLive.productId,
                quantity: qty,
                stockRequestId: srLive.id,
                note: 'Re-reserved after dispatch rollback',
              },
            });
          }
          partialUndoQty = live.quantityReceived ?? 0;
          if (partialUndoQty > 0 && srLive) {
            const vId = srLive.variantId || (live.asnPayload as any)?.variantId || '';
            const fs = await tx.franchiseStock.findUnique({
              where: {
                franchiseId_productId_variantId: {
                  franchiseId: live.franchiseId,
                  productId: srLive.productId,
                  variantId: vId,
                },
              },
            });
            if (!fs || fs.quantity < partialUndoQty) {
              throw new BadRequestException(
                'Cannot roll back dispatch: outlet stock is lower than partial receipts already booked in.',
              );
            }
            await tx.franchiseStock.update({
              where: {
                franchiseId_productId_variantId: {
                  franchiseId: live.franchiseId,
                  productId: srLive.productId,
                  variantId: vId,
                },
              },
              data: { quantity: { decrement: partialUndoQty } },
            });

            fireAndForget(
              this.audit.log({
                userId: user.sub,
                action: 'franchise_stock.update',
                resource: 'FranchiseStock',
                resourceId: `${live.franchiseId}:${srLive.productId}`,
                metadata: {
                  franchiseId: live.franchiseId,
                  productId: srLive.productId,
                  actionType: 'DECREMENT',
                  changeQuantity: partialUndoQty,
                  reason: 'Rollback dispatch stock',
                },
                ip,
              }),
            );
          }
        }

        const deliveredAt =
          status === DeliveryStatus.DELIVERED ? new Date() : null;
        const expectedForRow = srLive
          ? this.expectedInboundQty(live, srLive)
          : null;

        const updatedDelivery = await tx.inboundDelivery.update({
          where: { id: currentDeliveryId },
          data: {
            status,
            deliveredAt,
            stockApplied: nextStockApplied,
            ...(expectedForRow != null && applyStock
              ? { quantityReceived: expectedForRow }
              : {}),
            ...(partialUndoQty > 0 ? { quantityReceived: null } : {}),
            ...(dispatchedPatch !== undefined
              ? { dispatchedAt: dispatchedPatch }
              : {}),
          },
          include: {
            franchise: true,
            stockRequest: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
        });

        updatedDeliveries.push({ delivery: updatedDelivery, prevStatus });
      }
      return updatedDeliveries;
    });

    for (const res of results) {
      const { delivery: result, prevStatus } = res as any;
      if (!result || prevStatus === status) continue;

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'delivery.status_update',
          resource: 'InboundDelivery',
          resourceId: result.id,
          metadata: {
            previousStatus: prevStatus,
            nextStatus: status,
          },
          ip,
        }),
        'delivery.status_update',
      );

      const node = await this.prisma.stockingNode.findFirst({
        where: { franchiseId: result.franchiseId },
      });
      if (
        status === DeliveryStatus.IN_TRANSIT &&
        prevStatus === DeliveryStatus.SCHEDULED
      ) {
        void this.domainEvents.emit(
          'shipment.dispatched',
          {
            deliveryId: result.id,
            franchiseId: result.franchiseId,
            stockRequestId: result.stockRequestId,
          },
          {
            refType: 'INBOUND_DELIVERY',
            refId: result.id,
            stockingNodeId: node?.id,
          },
        );
      } else if (
        status === DeliveryStatus.DELIVERED &&
        prevStatus !== DeliveryStatus.DELIVERED
      ) {
        void this.domainEvents.emit(
          'shipment.delivered',
          {
            deliveryId: result.id,
            franchiseId: result.franchiseId,
            stockRequestId: result.stockRequestId,
          },
          {
            refType: 'INBOUND_DELIVERY',
            refId: result.id,
            stockingNodeId: node?.id,
          },
        );

        void this.sendStockRequestDeliveredEmail(
          result.id,
          result.franchiseId,
          result.stockRequestId,
        );
      } else if (status === DeliveryStatus.CANCELLED) {
        void this.domainEvents.emit(
          'shipment.cancelled',
          { deliveryId: result.id, franchiseId: result.franchiseId },
          {
            refType: 'INBOUND_DELIVERY',
            refId: result.id,
            stockingNodeId: node?.id,
          },
        );
      }
    }

    const primaryResult = results.find((r: any) => r.delivery && r.delivery.id === id);
    return primaryResult ? primaryResult.delivery : (results[0] ? (results[0] as any).delivery : null);
  }

  async recordPartialReceipt(
    id: string,
    dto: { quantity: number; note?: string; reportDiscrepancy?: boolean },
    user: JwtUser,
    ip?: string,
  ) {
    const allowedFranchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (!franchiseCanMutate(user.role) || !allowedFranchiseId) {
      throw new ForbiddenException();
    }
    const row = await this.prisma.inboundDelivery.findUnique({
      where: { id },
      include: {
        stockRequest: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            approvedQuantity: true,
            quantity: true,
          },
        },
      },
    });
    if (!row || row.franchiseId !== allowedFranchiseId) {
      throw new NotFoundException('Delivery not found');
    }
    if (row.status !== DeliveryStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'Partial receipts are only allowed while the shipment is in transit.',
      );
    }
    const sr = row.stockRequest;
    if (!sr) {
      throw new BadRequestException(
        'This inbound shipment is not linked to a stock request.',
      );
    }
    const expected = this.expectedInboundQty(row, sr);
    const received = row.quantityReceived ?? 0;
    const remaining = expected - received;
    if (remaining <= 0) {
      throw new BadRequestException(
        'Expected quantity is already fully received for this shipment.',
      );
    }
    const delta = Math.min(dto.quantity, remaining);
    const nextReceived = received + delta;
    const markDisc =
      Boolean(dto.reportDiscrepancy) || Boolean(dto.note?.trim());

    const updated = await this.prisma.$transaction(async (tx) => {
      const vId = sr.variantId || (row.asnPayload as any)?.variantId || '';
      await tx.franchiseStock.upsert({
        where: {
          franchiseId_productId_variantId: {
            franchiseId: row.franchiseId,
            productId: sr.productId,
            variantId: vId,
          },
        },
        create: {
          franchiseId: row.franchiseId,
          productId: sr.productId,
          variantId: vId,
          quantity: delta,
        },
        update: { quantity: { increment: delta } },
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'franchise_stock.update',
          resource: 'FranchiseStock',
          resourceId: `${row.franchiseId}:${sr.productId}`,
          metadata: {
            franchiseId: row.franchiseId,
            productId: sr.productId,
            actionType: 'INCREMENT',
            changeQuantity: delta,
            reason: 'Record delivery receipt',
          },
          ip,
        }),
      );

      const notePatch =
        dto.note?.trim() != null && dto.note.trim().length > 0
          ? row.discrepancyNote
            ? `${row.discrepancyNote}\n${dto.note.trim()}`
            : dto.note.trim()
          : undefined;
      return tx.inboundDelivery.update({
        where: { id },
        data: {
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
          stockApplied: true,
          quantityReceived: nextReceived,
          ...(markDisc
            ? { discrepancyStatus: InboundDiscrepancyStatus.REPORTED }
            : {}),
          ...(notePatch != null ? { discrepancyNote: notePatch } : {}),
        },
        include: {
          franchise: true,
          stockRequest: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      });
    });

    const node = await this.prisma.stockingNode.findFirst({
      where: { franchiseId: updated.franchiseId },
    });
    void this.domainEvents.emit(
      'shipment.partial_received',
      {
        deliveryId: updated.id,
        franchiseId: updated.franchiseId,
        stockRequestId: sr.id,
        delta,
        cumulativeReceived: nextReceived,
        expected,
      },
      {
        refType: 'INBOUND_DELIVERY',
        refId: updated.id,
        productId: sr.productId,
        stockingNodeId: node?.id,
        quantityDelta: delta,
      },
    );
    void this.domainEvents.emit(
      'shipment.delivered',
      {
        deliveryId: updated.id,
        franchiseId: updated.franchiseId,
        stockRequestId: updated.stockRequestId,
      },
      {
        refType: 'INBOUND_DELIVERY',
        refId: updated.id,
        stockingNodeId: node?.id,
      },
    );

    return updated;
  }

  async resolveDiscrepancy(
    id: string,
    dto: { resolutionNote?: string },
    user: JwtUser,
    ip: string,
  ) {
    if (user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }
    const row = await this.prisma.inboundDelivery.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Delivery not found');
    if (row.discrepancyStatus !== InboundDiscrepancyStatus.REPORTED) {
      throw new BadRequestException(
        'No open discrepancy to resolve on this shipment.',
      );
    }
    const note =
      dto.resolutionNote?.trim() != null && dto.resolutionNote.trim().length > 0
        ? row.discrepancyNote
          ? `${row.discrepancyNote}\nRESOLVED: ${dto.resolutionNote.trim()}`
          : `RESOLVED: ${dto.resolutionNote.trim()}`
        : row.discrepancyNote;
    const updated = await this.prisma.inboundDelivery.update({
      where: { id },
      data: {
        discrepancyStatus: InboundDiscrepancyStatus.RESOLVED,
        ...(note != null ? { discrepancyNote: note } : {}),
      },
      include: {
        franchise: true,
        stockRequest: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    const node = await this.prisma.stockingNode.findFirst({
      where: { franchiseId: updated.franchiseId },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'resolve_discrepancy_inboundDelivery.update',
        resource: 'InboundDelivery',
        resourceId: id,
        metadata: {
          franchiseId: row.franchiseId,
          actionType: 'RESOLVE_DISCREPANCY',
          reason: 'Delivery discrepancy resolved',
        },
        ip,
      }),
    );

    void this.domainEvents.emit(
      'shipment.discrepancy_resolved',
      { deliveryId: updated.id, franchiseId: updated.franchiseId },
      {
        refType: 'INBOUND_DELIVERY',
        refId: updated.id,
        stockingNodeId: node?.id,
      },
    );
    return updated;
  }

  async listUnifiedForAdmin(user: JwtUser, query: UnifiedListQueryDto) {
    const page = normalizePositiveInteger(query.page, 1);
    const limit = normalizePositiveInteger(query.limit, 10);
    const skip = (page - 1) * limit;

    const validOrderStatuses = Object.values(OrderStatus);
    const validStockRequestStatuses = Object.values(StockRequestStatus);

    // Build order filter
    const orderWhere: Prisma.OrderWhereInput = {
      channel: 'ONLINE',
    };
    if (query.franchiseId) {
      orderWhere.franchiseId = query.franchiseId;
    }
    if (query.fromDate || query.lastDate) {
      orderWhere.createdAt = buildPrismaDateRangeFilter({
        fromDate: query.fromDate,
        toDate: query.lastDate,
      });
    }
    if (query.status) {
      if (validOrderStatuses.includes(query.status as any)) {
        orderWhere.status = query.status as OrderStatus;
      } else {
        orderWhere.status = 'NON_EXISTENT_STATUS' as any;
      }
    }
    if (query.search) {
      const search = query.search.trim();
      orderWhere.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          },
        },
        {
          franchise: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Build stock request filter
    const stockRequestWhere: Prisma.StockRequestWhereInput = {};
    if (query.franchiseId) {
      stockRequestWhere.franchiseId = query.franchiseId;
    }
    if (query.fromDate || query.lastDate) {
      stockRequestWhere.createdAt = buildPrismaDateRangeFilter({
        fromDate: query.fromDate,
        toDate: query.lastDate,
      });
    }
    if (query.status) {
      if (validStockRequestStatuses.includes(query.status as any)) {
        stockRequestWhere.status = query.status as StockRequestStatus;
      } else {
        stockRequestWhere.status = 'NON_EXISTENT_STATUS' as any;
      }
    }
    if (query.search) {
      const search = query.search.trim();
      stockRequestWhere.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        {
          product: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          franchise: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const type = query.type;
    let data: any[] = [];
    let totalCount = 0;

    const orderInclude = {
      franchise: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    };

    const stockRequestInclude = {
      franchise: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
        },
      },
    };

    if (type === UnifiedTypeEnum.ONLINE_ORDER) {
      totalCount = await this.prisma.order.count({ where: orderWhere });
      const orders = await this.prisma.order.findMany({
        where: orderWhere,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });
      data = orders.map((o) => ({
        id: o.id,
        type: 'ONLINE_ORDER',
        referenceNumber: o.orderNumber,
        createdAt: o.createdAt,
        status: o.status,
        totalAmount: Number(o.total),
        franchise: {
          id: o.franchise.id,
          name: o.franchise.name,
          code: o.franchise.code,
        },
        details: {
          customerName: o.customer?.name || null,
          customerEmail: o.customer?.user?.email || null,
          customerPhone: o.customer?.phone || null,
          paymentMode: o.paymentMode,
          paymentStatus: o.onlinePaymentStatus,
        },
      }));
    } else if (type === UnifiedTypeEnum.STOCK_REQUEST) {
      totalCount = await this.prisma.stockRequest.count({
        where: stockRequestWhere,
      });
      const stockRequests = await this.prisma.stockRequest.findMany({
        where: stockRequestWhere,
        include: stockRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });
      data = stockRequests.map((sr) => ({
        id: sr.id,
        type: 'STOCK_REQUEST',
        referenceNumber:
          sr.invoiceNumber || `SR-${sr.id.slice(-6).toUpperCase()}`,
        createdAt: sr.createdAt,
        status: sr.status,
        totalAmount: sr.billingTotal ? Number(sr.billingTotal) : 0,
        franchise: {
          id: sr.franchise.id,
          name: sr.franchise.name,
          code: sr.franchise.code,
        },
        details: {
          productName: sr.product?.name || null,
          productQuantity: sr.quantity,
          approvedQuantity: sr.approvedQuantity || null,
          paymentStatus: sr.paymentStatus,
        },
      }));
    } else {
      const [ordersCount, stockRequestsCount] = await Promise.all([
        this.prisma.order.count({ where: orderWhere }),
        this.prisma.stockRequest.count({ where: stockRequestWhere }),
      ]);
      totalCount = ordersCount + stockRequestsCount;

      const maxToFetch = page * limit;
      const [orders, stockRequests] = await Promise.all([
        this.prisma.order.findMany({
          where: orderWhere,
          include: orderInclude,
          orderBy: { createdAt: 'desc' },
          take: maxToFetch,
        }),
        this.prisma.stockRequest.findMany({
          where: stockRequestWhere,
          include: stockRequestInclude,
          orderBy: { createdAt: 'desc' },
          take: maxToFetch,
        }),
      ]);

      const mergedList = [
        ...orders.map((o) => ({
          id: o.id,
          type: 'ONLINE_ORDER',
          referenceNumber: o.orderNumber,
          createdAt: o.createdAt,
          status: o.status,
          totalAmount: Number(o.total),
          franchise: {
            id: o.franchise.id,
            name: o.franchise.name,
            code: o.franchise.code,
          },
          details: {
            customerName: o.customer?.name || null,
            customerEmail: o.customer?.user?.email || null,
            customerPhone: o.customer?.phone || null,
            paymentMode: o.paymentMode,
            paymentStatus: o.onlinePaymentStatus,
          },
        })),
        ...stockRequests.map((sr) => ({
          id: sr.id,
          type: 'STOCK_REQUEST',
          referenceNumber:
            sr.invoiceNumber || `SR-${sr.id.slice(-6).toUpperCase()}`,
          createdAt: sr.createdAt,
          status: sr.status,
          totalAmount: sr.billingTotal ? Number(sr.billingTotal) : 0,
          franchise: {
            id: sr.franchise.id,
            name: sr.franchise.name,
            code: sr.franchise.code,
          },
          details: {
            productName: sr.product?.name || null,
            productQuantity: sr.quantity,
            approvedQuantity: sr.approvedQuantity || null,
            paymentStatus: sr.paymentStatus,
          },
        })),
      ];

      mergedList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      data = mergedList.slice(skip, skip + limit);
    }

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 0;

    return {
      data,
      meta: {
        count: totalCount,
        totalPages,
        page,
        limit,
      },
    };
  }

  private async sendStockRequestDeliveredEmail(
    deliveryId: string,
    franchiseId: string,
    stockRequestId?: string | null,
  ) {
    try {
      const franchise = await this.prisma.franchise.findUnique({
        where: { id: franchiseId },
        select: {
          id: true,
          name: true,
          code: true,
          businessName: true,
          ownerEmail: true,
          ownerFullName: true,
        },
      });

      if (!franchise || !franchise.ownerEmail) return;

      let attachment: Array<{ content: string; name: string }> | undefined = undefined;
      if (stockRequestId && this.invoiceService) {
        try {
          const stockReq = await this.prisma.stockRequest.findUnique({
            where: { id: stockRequestId },
            select: { paymentStatus: true },
          });
          if (stockReq?.paymentStatus === StockRequestPaymentStatus.PAID) {
            const invoice = await this.invoiceService.generatedInvoice({
              stockRequestId,
            } as any);
            if (invoice && invoice.invoiceNumber) {
              const invoiceViewModel = await this.invoiceService.getInvoiceByNumber(
                invoice.invoiceNumber,
                { role: Role.SUPERADMIN } as any,
              );
              const htmlContent = InvoiceHtmlBuilder.build(invoiceViewModel, {
                autoPrint: false,
              });
              const pdfBuffer = await PdfGenerator.generateFromHtml(htmlContent, {
                noHeaderFooter: true,
              });
              attachment = [
                {
                  content: pdfBuffer.toString('base64'),
                  name: `Invoice-${invoice.invoiceNumber}.pdf`,
                },
              ];
            }
          }
        } catch (pdfErr: any) {
          this.logger.error(
            `Failed to generate invoice PDF for stock request delivery ${deliveryId}: ${pdfErr.message}`,
          );
        }
      }

      let productName: string | undefined = undefined;
      let variantName: string | undefined = undefined;
      let quantity: number | undefined = undefined;

      if (stockRequestId) {
        try {
          const stockReq = (await this.prisma.stockRequest.findUnique({
            where: { id: stockRequestId },
            select: {
              quantity: true,
              product: {
                select: { name: true },
              },
              variant: {
                select: { attributeSummary: true },
              },
            },
          })) as any;
          if (stockReq) {
            productName = stockReq.product?.name;
            variantName = stockReq.variant?.attributeSummary;
            quantity = stockReq.quantity;
          }
        } catch (dbErr: any) {
          this.logger.error(
            `Failed to fetch stock request details for delivery email ${deliveryId}: ${dbErr.message}`,
          );
        }
      }

      const html = DeliveryEmailBuilder.build({
        deliveryId,
        stockRequestId,
        franchise,
        platformName: this.configService.get('PLATFORM_NAME', 'ScentsOfWax'),
        productName,
        variantName,
        quantity,
      });

      await this.brevoService.sendEmail({
        to: franchise.ownerEmail,
        subject: `Stock Request Shipment Delivered ✓ - ${deliveryId}`,
        htmlContent: html,
        attachment,
      });

      this.logger.log(
        `Stock request delivery email sent to ${franchise.ownerEmail} for delivery ${deliveryId}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to send stock request delivery email for ${deliveryId}: ${err.message}`,
      );
    }
  }
}
