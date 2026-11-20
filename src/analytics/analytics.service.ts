import { Injectable } from '@nestjs/common';
import { franchiseHasReadAccess } from '../common/franchise-roles';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import { Role } from '@prisma/client';

function range(from?: string, to?: string): { gte: Date; lte: Date } {
  const lte = to ? new Date(to) : new Date();
  const gte = from
    ? new Date(from)
    : new Date(lte.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { gte, lte };
}

function rangeForFranchise(params: {
  from?: string;
  to?: string;
  period?: '7d' | '30d' | '90d';
}): { gte: Date; lte: Date; periodLabel: string } {
  if (params.from && params.to) {
    const { gte, lte } = range(params.from, params.to);
    return { gte, lte, periodLabel: 'custom' };
  }
  const lte = new Date();
  let days = 30;
  let periodLabel: '7d' | '30d' | '90d' = '30d';
  if (params.period === '7d') {
    days = 7;
    periodLabel = '7d';
  } else if (params.period === '90d') {
    days = 90;
    periodLabel = '90d';
  } else if (params.period === '30d') {
    periodLabel = '30d';
  }
  const gte = new Date(lte.getTime() - days * 24 * 60 * 60 * 1000);
  return { gte, lte, periodLabel };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async superadmin(params: {
    from?: string;
    to?: string;
    type?: 'overview' | 'category' | 'geo';
  }) {
    const { gte, lte } = range(params.from, params.to);
    const where = { createdAt: { gte, lte } };
    const [agg, byStatus, topFranchises] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['franchiseId'],
        where,
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 8,
      }),
    ]);
    const franchiseIds = topFranchises.map((t) => t.franchiseId);
    const franchises = await this.prisma.franchise.findMany({
      where: { id: { in: franchiseIds } },
      select: { id: true, name: true, code: true },
    });
    const nameById = new Map(franchises.map((f) => [f.id, f]));
    const base = {
      type: params.type ?? 'overview',
      range: { from: gte.toISOString(), to: lte.toISOString() },
      ordersTotal: agg._count._all,
      revenue: agg._sum.total?.toString() ?? '0',
      byStatus: byStatus.map((b) => ({
        status: b.status,
        count: b._count._all,
      })),
      topFranchises: topFranchises.map((t) => ({
        franchise: nameById.get(t.franchiseId) ?? { id: t.franchiseId },
        revenue: t._sum.total?.toString() ?? '0',
      })),
    };

    if (params.type === 'category') {
      const orders = await this.prisma.order.findMany({
        where,
        take: 500,
        include: {
          items: {
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
      const catUnits = new Map<string, number>();
      for (const o of orders) {
        for (const it of o.items) {
          const n = it.product.category.name;
          catUnits.set(n, (catUnits.get(n) ?? 0) + it.quantity);
        }
      }
      const categoryDemand = [...catUnits.entries()]
        .map(([category, units]) => ({ category, units }))
        .sort((a, b) => b.units - a.units);
      return { ...base, categoryDemand };
    }

    if (params.type === 'geo') {
      const geoRows = await this.prisma.order.groupBy({
        by: ['franchiseId'],
        where,
        _sum: { total: true },
        _count: { _all: true },
      });
      const fids = geoRows.map((g) => g.franchiseId);
      const flist = await this.prisma.franchise.findMany({
        where: { id: { in: fids } },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          latitude: true,
          longitude: true,
        },
      });
      const fmap = new Map(flist.map((f) => [f.id, f]));
      const geoHeatmap = geoRows.map((g) => ({
        franchise: fmap.get(g.franchiseId) ?? { id: g.franchiseId },
        orders: g._count._all,
        revenue: g._sum.total?.toString() ?? '0',
      }));
      return { ...base, geoHeatmap };
    }

    return base;
  }

  async superadminExportCsv(params: { from?: string; to?: string }) {
    const { gte, lte } = range(params.from, params.to);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte, lte } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: {
        franchise: { select: { code: true, city: true } },
        items: { include: { product: { select: { name: true, slug: true } } } },
      },
    });
    const lines = [
      'orderNumber,status,channel,franchiseCode,city,total,createdAt,lines',
    ];
    for (const o of orders) {
      const lineDesc = o.items
        .map((i) => `${i.quantity}x${i.product.slug}`)
        .join(';');
      lines.push(
        [
          o.orderNumber,
          o.status,
          o.channel,
          o.franchise.code,
          o.franchise.city,
          o.total.toString(),
          o.createdAt.toISOString(),
          `"${lineDesc.replace(/"/g, '""')}"`,
        ].join(','),
      );
    }
    const filename = `giftfactory-orders-${gte.toISOString().slice(0, 10)}-${lte.toISOString().slice(0, 10)}.csv`;
    return { filename, csv: lines.join('\n') };
  }

  async franchise(
    user: JwtUser,
    params: { from?: string; to?: string; period?: '7d' | '30d' | '90d' },
  ) {
    if (!franchiseHasReadAccess(user.role)) {
      return null;
    }

    const fid =
      user.role === Role.FRANCHISE_OWNER
        ? user.franchiseId
        : user.franchiseOwnerId;
    if (!fid) {
      return {
        period: params.period ?? '30d',
        ordersTotal: 0,
        revenue: '0',
        byStatus: [],
        pendingStockRequests: 0,
        fulfillmentRate: 0,
        topProducts: [] as {
          productId: string;
          name: string;
          units: number;
          revenue: string;
        }[],
        categoryBreakdown: [] as { category: string; units: number }[],
        pnl: { revenue: '0', estimatedCogs: '0', estimatedGross: '0' },
      };
    }
    const { gte, lte, periodLabel } = rangeForFranchise(params);
    const where = {
      franchiseId: fid,
      createdAt: { gte, lte },
    };
    const [agg, byStatus, pendingRequests, ordersForMix] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.stockRequest.count({
        where: { franchiseId: fid, status: 'PENDING' },
      }),

      this.prisma.order.findMany({
        where,
        take: 400,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
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
      }),
    ]);

    const statusCounts = new Map(
      byStatus.map((b) => [b.status, b._count._all]),
    );
    const completed = statusCounts.get('COMPLETED') ?? 0;
    const cancelled = statusCounts.get('CANCELLED') ?? 0;
    const denom = Math.max(agg._count._all - cancelled, 1);
    const fulfillmentRate = Math.round((completed / denom) * 1000) / 1000;

    const productUnits = new Map<
      string,
      { name: string; units: number; revenue: number }
    >();
    const categoryUnits = new Map<string, number>();
    for (const o of ordersForMix) {
      for (const it of o.items) {
        const cur = productUnits.get(it.productId) ?? {
          name: it.product.name,
          units: 0,
          revenue: 0,
        };
        cur.units += it.quantity;
        cur.revenue += Number(it.unitPrice) * it.quantity;
        productUnits.set(it.productId, cur);
        const cat = it.product.category.name;
        categoryUnits.set(cat, (categoryUnits.get(cat) ?? 0) + it.quantity);
      }
    }
    const topProducts = [...productUnits.entries()]
      .map(([productId, v]) => ({
        productId,
        name: v.name,
        units: v.units,
        revenue: v.revenue.toFixed(2),
      }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 8);
    const categoryBreakdown = [...categoryUnits.entries()]
      .map(([category, units]) => ({ category, units }))
      .sort((a, b) => b.units - a.units);

    const revenueStr = agg._sum.total?.toString() ?? '0';
    const revenueNum = Number(revenueStr);
    const estimatedCogs = Number.isFinite(revenueNum)
      ? (revenueNum * 0.55).toFixed(2)
      : '0';
    const estimatedGross = Number.isFinite(revenueNum)
      ? (revenueNum * 0.45).toFixed(2)
      : '0';

    return {
      period: periodLabel,
      range: { from: gte.toISOString(), to: lte.toISOString() },
      ordersTotal: agg._count._all,
      revenue: revenueStr,
      byStatus: byStatus.map((b) => ({
        status: b.status,
        count: b._count._all,
      })),
      pendingStockRequests: pendingRequests,
      fulfillmentRate,
      topProducts,
      categoryBreakdown,
      pnl: {
        revenue: revenueStr,
        estimatedCogs,
        estimatedGross,
      },
    };
  }

  async opsQueue() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      pendingStockRequests,
      openSupportTickets,
      franchisesKycPending,
      webhookFailures7d,
    ] = await Promise.all([
      this.prisma.stockRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.franchise.count({ where: { kycStatus: 'PENDING' } }),
      this.prisma.webhookDelivery.count({
        where: { status: 'FAILED', createdAt: { gte: since } },
      }),
    ]);
    return {
      pendingStockRequests,
      openSupportTickets,
      franchisesKycPending,
      webhookFailures7d,
    };
  }

  async franchiseSla(user: JwtUser) {
    if (!franchiseHasReadAccess(user.role)) {
      return null;
    }
    const fid =
      user.role === Role.FRANCHISE_OWNER
        ? user.franchiseId
        : user.franchiseOwnerId;
    if (!fid) {
      return null;
    }
    const now = new Date();
    const [
      pendingStockRequests,
      lateInboundDeliveries,
      openSupportTickets,
      recentApproved,
    ] = await Promise.all([
      this.prisma.stockRequest.count({
        where: { franchiseId: fid, status: 'PENDING' },
      }),
      this.prisma.inboundDelivery.count({
        where: {
          franchiseId: fid,
          status: { not: 'DELIVERED' },
          expectedAt: { not: null, lt: now },
        },
      }),
      this.prisma.supportTicket.count({
        where: { franchiseId: fid, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.stockRequest.findMany({
        where: {
          franchiseId: fid,
          status: 'APPROVED',
          reviewedAt: { not: null },
        },
        orderBy: { reviewedAt: 'desc' },
        take: 40,
        select: { createdAt: true, reviewedAt: true },
      }),
    ]);
    let avgStockApproveHours: number | null = null;
    if (recentApproved.length) {
      const ms = recentApproved.reduce((acc, r) => {
        if (!r.reviewedAt) return acc;
        return acc + (r.reviewedAt.getTime() - r.createdAt.getTime());
      }, 0);
      avgStockApproveHours =
        Math.round((ms / recentApproved.length / 3600000) * 10) / 10;
    }
    return {
      franchiseId: fid,
      pendingStockRequests,
      lateInboundDeliveries,
      openSupportTickets,
      avgStockApproveHours,
    };
  }
}
