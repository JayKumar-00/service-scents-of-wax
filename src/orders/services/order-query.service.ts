import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { franchiseHasReadAccess } from '../../common/franchise-roles';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { buildPrismaDateRangeFilter } from 'src/products/utils/range-filter.util';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderQueryDto } from '../dto/order-query.dto';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';
import { InvoiceService } from 'src/invoice/invoice.service';

export const ORDER_ITEM_PRODUCT_SELECT = {
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
export class OrderQueryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => InvoiceService))
    private readonly invoiceService: InvoiceService,
  ) {}

  async getById(orderId: string, user: JwtUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        franchise: {
          select: {
            id: true,
            name: true,
            code: true,
            badge: true,
            businessName: true,
            ownerEmail: true,
            status: true,
            acceptingOrders: true,
            city: true,
            country: true,
            postalCode: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            user: { select: { email: true } },
          },
        },
        soldBy: { select: { id: true, email: true } },
        items: { include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } } },
        retailCustomer: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const enriched = this.enrichOrderPickupDetails(order);
    if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF) {
      return enriched;
    }
    if (user.role === Role.CUSTOMER) {
      if (order.customerId !== user.customerId) {
        throw new ForbiddenException();
      }
      return enriched;
    }

    if (
      user.role === Role.FRANCHISE_STAFF ||
      user.role === Role.FRANCHISE_OWNER
    ) {
      if (
        [user.franchiseId, user.franchiseOwnerId].includes(order.franchiseId)
      ) {
        return enriched;
      }
    }

    throw new ForbiddenException();
  }

  async listForUser(user: JwtUser, query: OrderQueryDto) {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: 'insensitive' } },
            { invoiceNumber: { contains: search, mode: 'insensitive' } },
            {
              customer: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
            {
              customer: {
                user: {
                  email: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              items: {
                some: {
                  product: {
                    name: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            },
          ],
        }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.saleType) {
      clauses.push({ saleType: query.saleType });
    }

    if (q.orderNumber) {
      clauses.push({
        orderNumber: { contains: q.orderNumber, mode: 'insensitive' },
      });
    }

    if (q.invoiceNumber) {
      clauses.push({
        invoiceNumber: { contains: q.invoiceNumber, mode: 'insensitive' },
      });
    }

    if (user.role === Role.ADMIN_STAFF || user.role === Role.SUPERADMIN) {
      const platformFranchise = await this.prisma.franchise.findUnique({
        where: { code: 'CENTRAL_WAREHOUSE' },
        select: { id: true },
      });

      if (query.isFromPlatform === BooleanEnum.TRUE) {
        clauses.push({
          franchiseId: platformFranchise?.id ?? 'CENTRAL_WAREHOUSE_NOT_FOUND',
        });
      } else {
        if (platformFranchise?.id) {
          clauses.push({
            franchiseId: { not: platformFranchise.id },
          });
        }
      }
    }

    if (q.paymentReference) {
      clauses.push({
        paymentReference: { contains: q.paymentReference, mode: 'insensitive' },
      });
    }

    if (q.paymentProvider) {
      clauses.push({
        paymentProvider: { contains: q.paymentProvider, mode: 'insensitive' },
      });
    }

    if (q.onlinePaymentStatus) {
      clauses.push({ onlinePaymentStatus: q.onlinePaymentStatus });
    }

    if (q.posPaymentMode) {
      clauses.push({ paymentMode: q.posPaymentMode });
    }

    if (q.paymentMode) {
      clauses.push({ paymentMode: q.paymentMode });
    }

    if (q.status) {
      clauses.push({ status: q.status });
    }

    if (q.channel) {
      clauses.push({ channel: q.channel });
    }

    if (q.soldByUserId) {
      clauses.push({ soldByUserId: q.soldByUserId });
    }

    if (q.retailCustomerId) {
      clauses.push({ retailCustomerId: q.retailCustomerId });
    }

    if (q.franchiseId) {
      clauses.push({ franchiseId: q.franchiseId });
    }

    if (q.customerId) {
      clauses.push({ customer: { id: q.customerId } });
    }

    if (q.address) {
      clauses.push({
        addressJson: {
          contains: q.address,
          mode: 'insensitive',
        },
      });
    }

    if (q.fromPaidAt || q.toPaidAt) {
      const paidAt = buildPrismaDateRangeFilter({
        fromDate: q.fromPaidAt,
        toDate: q.toPaidAt,
      });
      if (paidAt) {
        clauses.push({ paidAt });
      }
    }

    const include: Record<string, unknown> = {
      franchise: {
        select: {
          id: true,
          name: true,
          code: true,
          badge: true,
          businessName: true,
          ownerEmail: true,
          status: true,
          acceptingOrders: true,
          city: true,
          country: true,
          postalCode: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
          user: { select: { email: true } },
        },
      },
      soldBy: { select: { id: true, email: true } },
      items: { include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } } },
      retailCustomer: true,
    };

    if (user.role !== Role.SUPERADMIN && franchiseHasReadAccess(user.role)) {
      const allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      clauses.push({ franchise: { id: allowedFranchiseId } });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = buildSortOrder(q.sortBy, q.order, ['status', 'paidAt']);

    const paged = await paginatePrisma<any>({
      model: this.prisma.order as any,
      where,
      // select,
      orderBy,
      page,
      limit,
      include,
    });

    return {
      data: (paged.data || []).map((o: any) =>
        this.enrichOrderPickupDetails(o),
      ),
      meta: paged.meta,
    };
  }

  async invoiceHtml(orderId: string, user: JwtUser): Promise<string> {
    const order = await this.getById(orderId, user);
    const snap = order?.billingSnapshot as Record<string, unknown> | null;
    let lines = (snap?.lines as unknown[]) ?? [];
    if (!lines.length && order?.items?.length) {
      lines = order.items.map((it: any) => {
        const unit =
          it.unitPrice instanceof Prisma.Decimal
            ? it.unitPrice.toFixed(2)
            : String(it.unitPrice);
        const subtotal = (Number(unit) * it.quantity).toFixed(2);
        return {
          name: it.product.name,
          quantity: it.quantity,
          unitPrice: unit,
          lineSubtotal: subtotal,
          lineTax: '0.00',
        };
      }) as unknown[];
    }
    const totals =
      (snap?.totals as Record<string, string>) ??
      (order?.total
        ? {
            subtotal: '0.00',
            cgst: '0.00',
            sgst: '0.00',
            igst: '0.00',
            grandTotal:
              order.total instanceof Prisma.Decimal
                ? order.total.toFixed(2)
                : String(order.total),
          }
        : {});
    const seller = (snap?.seller as Record<string, string>) ?? {
      name: order?.franchise.name,
      code: order?.franchise.code,
    };
    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const rows = (lines as Record<string, unknown>[])
      .map(
        (l) =>
          `<tr><td>${esc(String(l.name ?? ''))}</td><td>${l.quantity}</td><td class="r">₹${l.unitPrice}</td><td class="r">₹${l.lineSubtotal}</td><td class="r">₹${l.lineTax}</td></tr>`,
      )
      .join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice ${esc(order.orderNumber)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:16px;color:#111}
h1{font-size:1.25rem}.muted{color:#666;font-size:0.85rem}table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border-bottom:1px solid #eee;padding:8px;text-align:left}.r{text-align:right}</style></head><body>
<p class="muted">UnBoxIO · ${esc(seller.name ?? '')} (${esc(seller.code ?? '')})</p>
<h1>Order ${esc(order.orderNumber)}</h1>
<p class="muted">Status: ${esc(order.status)} · Payment: ${esc(String(order.onlinePaymentStatus ?? '—'))}</p>
<table><thead><tr><th>Item</th><th>Qty</th><th class="r">Unit</th><th class="r">Subtotal</th><th class="r">GST</th></tr></thead><tbody>${rows}</tbody></table>
<p><strong>Subtotal:</strong> ₹${totals.subtotal ?? '0.00'}</p>
<p><strong>CGST:</strong> ₹${totals.cgst ?? '0.00'} · <strong>SGST:</strong> ₹${totals.sgst ?? '0.00'} · <strong>IGST:</strong> ₹${totals.igst ?? '0.00'}</p>
<p><strong>Grand total:</strong> ₹${totals.grandTotal ?? '0.00'}</p>
</body></html>`;
  }

  async upsertInvoice(user: JwtUser, orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isPickupCod =
      order.saleType?.toUpperCase() === 'PICKUP' &&
      order.paymentMode === 'COD';

    if (isPickupCod && order.status !== 'DELIVERED') {
      throw new BadRequestException(
        `Invoice cannot be generated for PICKUP and COD orders until they are DELIVERED`,
      );
    }

    if (order.invoiceNumber) {
      const htmlContent = await this.invoiceHtml(order.id, user);
      return {
        data: {
          order,
          html: htmlContent,
        },
      };
    }

    try {
      await this.invoiceService.generatedInvoice({
        orderNumber,
      } as any);
    } catch (err: any) {
      // Fallback to legacy structure in case of any issues with the invoice service
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          invoiceNumber: `#INV-${orderNumber}`,
        },
      });
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: order.id },
    });

    const htmlContent = await this.invoiceHtml(order.id, user);

    return {
      data: {
        updated: updated || order,
        html: htmlContent,
      },
    };
  }

  private enrichOrderPickupDetails(order: any) {
    if (!order) return order;

    let fromPickupScheduleTime: string | null = null;
    let toPickupScheduleTime: string | null = null;
    const thresholdHours =
      Number(process.env.LATE_PICKUP_THRESHOLD_HOURS) || 48;
    const extendedDuration: string = `${thresholdHours} hours`;
    let pickupLateNote = 'Not a pickup order';
    let isLatePickup = false;

    if (order.saleType === 'Pickup' || order.saleType === 'PICKUP') {
      pickupLateNote = 'No scheduled pickup time set';
      try {
        const address =
          typeof order.addressJson === 'string'
            ? JSON.parse(order.addressJson)
            : order.addressJson;

        if (address) {
          fromPickupScheduleTime = address.fromPickupScheduleTime ?? null;
          toPickupScheduleTime = address.toPickupScheduleTime ?? null;

          const endTimeStr =
            address.toPickupScheduleTime || address.fromPickupScheduleTime;
          if (endTimeStr) {
            const endTime = new Date(endTimeStr);
            const comparisonTime =
              order.status === 'DELIVERED'
                ? new Date(order.updatedAt)
                : new Date();
            const hrsDiff =
              (comparisonTime.getTime() - endTime.getTime()) / (1000 * 60 * 60);
            if (hrsDiff > thresholdHours) {
              isLatePickup = true;
              pickupLateNote = `Picked up more than ${thresholdHours} hours after scheduled time. (Delayed by ${hrsDiff.toFixed(1)} hours)`;
            } else if (hrsDiff > 0) {
              isLatePickup = false;
              pickupLateNote = `Scheduled pickup time exceeded by ${hrsDiff.toFixed(1)} hours. (Within ${thresholdHours}-hour grace period)`;
            } else {
              isLatePickup = false;
              pickupLateNote = `On Time. (Time remaining: ${Math.abs(hrsDiff).toFixed(1)} hours)`;
            }
          }
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }

    return {
      ...order,
      fromPickupScheduleTime,
      toPickupScheduleTime,
      extendedDuration,
      pickupLateNote,
      isLatePickup,
    };
  }
}
