import { Injectable, ForbiddenException } from '@nestjs/common';
import {
  Role,
  OrderStatus,
  FranchiseStatus,
  StockRequestStatus,
  SupportTicketStatus,
  KycStatus,
  StockTransferStatus,
  FaqStatus,
  FaqAudience,
  DeliveryStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import { DashboardQueryDto, DashboardPeriod } from './dto/dashboard-query.dto';
import {
  DashboardMetricsResponseDto,
  DashboardWidgetsDto,
} from './dto/dashboard-metrics-response.dto';
import { FranchiseDashboardQueryDto } from './dto/franchise-dashboard-query.dto';
import { FranchiseDashboardResponseDto } from './dto/franchise-dashboard-response.dto';
import {
  mergePermissionGrants,
  normalizePermissionModuleName,
} from '../common/utils/permission.util';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) { }

  private hasPermission(user: JwtUser, moduleName: string): boolean {
    if (user.role === Role.SUPERADMIN || user.role === Role.FRANCHISE_OWNER) {
      return true;
    }
    if (!user.appRole || !user.appRole.isActive) {
      return false;
    }
    const permissionMap = mergePermissionGrants(user.appRole.permissions);
    const normalized = normalizePermissionModuleName(moduleName);
    return permissionMap.get(normalized)?.canRead ?? false;
  }

  async getMetrics(
    user: JwtUser,
    query: DashboardQueryDto,
  ): Promise<DashboardMetricsResponseDto> {
    const isFranchiseRole =
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF ||
      user.role === Role.FRANCHISE_AUDITOR;

    const franchiseId = isFranchiseRole
      ? (user.franchiseId ?? user.franchiseOwnerId)
      : undefined;

    if (isFranchiseRole && !franchiseId) {
      throw new ForbiddenException('Access denied: Franchise not assigned');
    }

    // 1. Calculate Date Ranges
    const lte = query.to ? new Date(query.to) : new Date();
    let gte: Date;
    if (query.from) {
      gte = new Date(query.from);
    } else {
      let days = 30;
      if (query.period === DashboardPeriod.SEVEN_DAYS) {
        days = 7;
      } else if (query.period === DashboardPeriod.FIFTEEN_DAYS) {
        days = 15;
      } else if (query.period === DashboardPeriod.THIRTY_DAYS) {
        days = 30;
      }
      gte = new Date(lte.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const durationMs = lte.getTime() - gte.getTime();
    const prevGte = new Date(gte.getTime() - durationMs);
    const prevLte = gte;

    const widgets: DashboardWidgetsDto = {};

    // 2. Build widgets dynamically depending on roles/permissions
    const promises: Promise<any>[] = [];
    const widgetKeys: string[] = [];

    // Executive Overview visibility check
    const viewExecutive =
      user.role === Role.SUPERADMIN ||
      user.role === Role.FRANCHISE_OWNER ||
      (user.role === Role.ADMIN_STAFF &&
        (this.hasPermission(user, 'products') ||
          this.hasPermission(user, 'warehouse') ||
          this.hasPermission(user, 'orders') ||
          this.hasPermission(user, 'customers') ||
          this.hasPermission(user, 'franchises'))) ||
      (user.role === Role.FRANCHISE_STAFF &&
        (this.hasPermission(user, 'orders') ||
          this.hasPermission(user, 'inventory') ||
          this.hasPermission(user, 'stock-requests')));

    if (viewExecutive) {
      widgetKeys.push('executiveOverview');
      promises.push(
        this.buildExecutiveOverview(franchiseId, gte, lte, prevGte, prevLte),
      );
    }

    // Sales Analytics & Order Analytics visibility check
    const viewSalesOrders =
      user.role === Role.SUPERADMIN ||
      user.role === Role.FRANCHISE_OWNER ||
      (user.role === Role.ADMIN_STAFF &&
        (this.hasPermission(user, 'orders') ||
          this.hasPermission(user, 'returns'))) ||
      (user.role === Role.FRANCHISE_STAFF &&
        this.hasPermission(user, 'orders'));

    if (viewSalesOrders) {
      widgetKeys.push('salesAnalytics');
      promises.push(
        this.buildSalesAnalytics(franchiseId, gte, lte, prevGte, prevLte),
      );

      widgetKeys.push('orderAnalytics');
      promises.push(this.buildOrderAnalytics(franchiseId, gte, lte));
    }

    // Inventory Analytics visibility check
    const viewInventory =
      user.role === Role.SUPERADMIN ||
      user.role === Role.FRANCHISE_OWNER ||
      (user.role === Role.ADMIN_STAFF &&
        (this.hasPermission(user, 'products') ||
          this.hasPermission(user, 'warehouse') ||
          this.hasPermission(user, 'supply-chain'))) ||
      (user.role === Role.FRANCHISE_STAFF &&
        (this.hasPermission(user, 'inventory') ||
          this.hasPermission(user, 'stock-requests')));

    if (viewInventory) {
      widgetKeys.push('inventoryAnalytics');
      promises.push(this.buildInventoryAnalytics(franchiseId, gte, lte));
    }

    // Customer Analytics visibility check
    const viewCustomers =
      user.role === Role.SUPERADMIN ||
      user.role === Role.FRANCHISE_OWNER ||
      (user.role === Role.ADMIN_STAFF &&
        this.hasPermission(user, 'customers')) ||
      (user.role === Role.FRANCHISE_STAFF &&
        this.hasPermission(user, 'customers'));

    if (viewCustomers) {
      widgetKeys.push('customerAnalytics');
      promises.push(
        this.buildCustomerAnalytics(franchiseId, gte, lte, prevGte, prevLte),
      );
    }

    // Franchise Analytics visibility check (Only Global / Superadmin / Admin Staff with permissions)
    const viewFranchises =
      !isFranchiseRole &&
      (user.role === Role.SUPERADMIN ||
        (user.role === Role.ADMIN_STAFF &&
          this.hasPermission(user, 'franchises')));

    if (viewFranchises) {
      widgetKeys.push('franchiseAnalytics');
      promises.push(this.buildFranchiseAnalytics(gte, lte));
    }

    // Operational Analytics visibility check
    const viewOps =
      user.role === Role.SUPERADMIN ||
      user.role === Role.FRANCHISE_OWNER ||
      (user.role === Role.ADMIN_STAFF &&
        (this.hasPermission(user, 'stock-requests') ||
          this.hasPermission(user, 'tickets'))) ||
      (user.role === Role.FRANCHISE_STAFF &&
        (this.hasPermission(user, 'stock-requests') ||
          this.hasPermission(user, 'tickets') ||
          this.hasPermission(user, 'distribution')));

    if (viewOps) {
      widgetKeys.push('operationalAnalytics');
      promises.push(this.buildOperationalAnalytics(franchiseId));
    }

    // Recent Activities visibility check
    const viewActivities =
      user.role === Role.SUPERADMIN ||
      user.role === Role.FRANCHISE_OWNER ||
      (user.role === Role.ADMIN_STAFF &&
        (this.hasPermission(user, 'audit') ||
          this.hasPermission(user, 'users'))) ||
      (user.role === Role.FRANCHISE_STAFF &&
        (this.hasPermission(user, 'audit') ||
          this.hasPermission(user, 'users')));

    if (viewActivities) {
      widgetKeys.push('recentActivities');
      promises.push(this.buildRecentActivities(franchiseId, gte, lte));
    }

    // Media Library Analytics visibility check
    const viewMediaLibrary =
      user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;
    if (viewMediaLibrary) {
      widgetKeys.push('mediaLibrary');
      promises.push(this.buildMediaLibraryAnalytics());
    }

    // Add missing franchise widgets for metrics overview
    widgetKeys.push('charts');
    promises.push(this.buildCharts(franchiseId));

    widgetKeys.push('inventory');
    promises.push(this.buildInventory(franchiseId));

    widgetKeys.push('recentDeliveries');
    promises.push(this.buildRecentDeliveries(franchiseId));

    widgetKeys.push('topCustomers');
    promises.push(this.buildTopCustomers(franchiseId));

    widgetKeys.push('faqPreview');
    promises.push(this.buildFaqPreview());

    const results = await Promise.all(promises);
    for (let i = 0; i < widgetKeys.length; i++) {
      (widgets as any)[widgetKeys[i]] = results[i];
    }

    return {
      role: user.role,
      scope: franchiseId ? `FRANCHISE:${franchiseId}` : 'GLOBAL',
      period: query.period ?? DashboardPeriod.THIRTY_DAYS,
      range: {
        from: gte.toISOString(),
        to: lte.toISOString(),
      },
      widgets,
    };
  }

  private async buildExecutiveOverview(
    franchiseId: string | undefined,
    gte: Date,
    lte: Date,
    prevGte: Date,
    prevLte: Date,
  ): Promise<any> {
    const revenueWhere = {
      createdAt: { gte, lte },
      status: {
        notIn: [
          OrderStatus.CANCELLED,
          OrderStatus.RETURNED,
          OrderStatus.REFUNDED,
        ] as OrderStatus[],
      },
      ...(franchiseId ? { franchiseId } : {}),
    };
    const prevRevenueWhere = {
      createdAt: { gte: prevGte, lte: prevLte },
      status: {
        notIn: [
          OrderStatus.CANCELLED,
          OrderStatus.RETURNED,
          OrderStatus.REFUNDED,
        ] as OrderStatus[],
      },
      ...(franchiseId ? { franchiseId } : {}),
    };

    const [currentRevenueAgg, prevRevenueAgg] = await Promise.all([
      this.prisma.order.aggregate({
        where: revenueWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: prevRevenueWhere,
        _sum: { total: true },
      }),
    ]);

    const currentRevenue = Number(currentRevenueAgg._sum.total ?? 0);
    const prevRevenue = Number(prevRevenueAgg._sum.total ?? 0);
    const growthPercentage =
      prevRevenue > 0
        ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
        : 0;

    let customerCount = 0;
    if (franchiseId) {
      const result = await this.prisma.order.groupBy({
        by: ['customerId'],
        where: {
          franchiseId,
          customerId: { not: null },
          createdAt: { gte, lte },
        },
      });
      customerCount = result.length;
    } else {
      customerCount = await this.prisma.customer.count({
        where: { createdAt: { gte, lte } },
      });
    }

    let inventoryValuation = '0.00';
    let atpUnits = 0;

    if (franchiseId) {
      const stocks = await this.prisma.franchiseStock.findMany({
        where: { franchiseId },
        select: {
          quantity: true,
          reserved: true,
          product: { select: { price: true } },
        },
      });
      const val = stocks.reduce(
        (sum, s) => sum + s.quantity * Number(s.product.price),
        0,
      );
      inventoryValuation = val.toFixed(2);
      atpUnits = stocks.reduce(
        (sum, s) => sum + Math.max(0, s.quantity - s.reserved),
        0,
      );
    } else {
      const [products, franchiseStocks] = await Promise.all([
        this.prisma.product.findMany({
          where: { deletedAt: null },
          select: {
            price: true,
            stock: true,
            warehouseStocks: { select: { quantity: true, reserved: true } },
            variants: { select: { stock: true } },
          },
        }),
        this.prisma.franchiseStock.findMany({
          select: {
            quantity: true,
            reserved: true,
            product: { select: { price: true } },
          },
        }),
      ]);

      const wVal = products.reduce((sum, p) => {
        const qty =
          p.warehouseStocks?.quantity ??
          (p.variants.length > 0
            ? p.variants.reduce((sumVar, v) => sumVar + (v.stock ?? 0), 0)
            : (p.stock ?? 0));
        return sum + qty * Number(p.price ?? 0);
      }, 0);

      const fVal = franchiseStocks.reduce(
        (sum, s) => sum + s.quantity * Number(s.product.price),
        0,
      );

      inventoryValuation = (wVal + fVal).toFixed(2);

      const wAtp = products.reduce((sum, p) => {
        const qty =
          p.warehouseStocks?.quantity ??
          (p.variants.length > 0
            ? p.variants.reduce((sumVar, v) => sumVar + (v.stock ?? 0), 0)
            : (p.stock ?? 0));
        const reserved = p.warehouseStocks?.reserved ?? 0;
        return sum + Math.max(0, qty - reserved);
      }, 0);

      const fAtp = franchiseStocks.reduce(
        (sum, s) => sum + Math.max(0, s.quantity - s.reserved),
        0,
      );

      atpUnits = wAtp + fAtp;
    }

    let franchiseCount: number | undefined;
    if (!franchiseId) {
      franchiseCount = await this.prisma.franchise.count({
        where: { status: FranchiseStatus.ACTIVE },
      });
    }

    const completedOrders = await this.prisma.order.count({
      where: {
        createdAt: { gte, lte },
        status: { in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] },
        ...(franchiseId ? { franchiseId } : {}),
      },
    });

    const openDeliveries = await this.prisma.inboundDelivery.count({
      where: {
        status: { in: [DeliveryStatus.SCHEDULED, DeliveryStatus.IN_TRANSIT] },
        ...(franchiseId ? { franchiseId } : {}),
      },
    });

    const totalOrders = currentRevenueAgg._count._all;
    const completionPercentage =
      totalOrders > 0
        ? Math.round((completedOrders / totalOrders) * 100 * 100) / 100
        : 0;

    return {
      totalRevenue: currentRevenue.toFixed(2),
      orderCount: totalOrders,
      customerCount,
      inventoryValuation,
      growthPercentage: Math.round(growthPercentage * 100) / 100,
      completedOrders,
      openDeliveries,
      atpUnits,
      completionPercentage,
      totalSales: currentRevenue,
      totalOrders: totalOrders,
      ...(franchiseCount !== undefined ? { franchiseCount } : {}),
    };
  }

  private async buildSalesAnalytics(
    franchiseId: string | undefined,
    gte: Date,
    lte: Date,
    prevGte: Date,
    prevLte: Date,
  ): Promise<any> {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const buildRevenueQuery = (from: Date, to: Date) => {
      return this.prisma.order.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          status: { notIn: [OrderStatus.CANCELLED] },
          ...(franchiseId ? { franchiseId } : {}),
        },
        _sum: { total: true },
        _count: { _all: true },
      });
    };

    const [todayAgg, weeklyAgg, monthlyAgg, yearlyAgg, prevMonthlyAgg] =
      await Promise.all([
        buildRevenueQuery(startOfToday, now),
        buildRevenueQuery(
          new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          now,
        ),
        buildRevenueQuery(
          new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          now,
        ),
        buildRevenueQuery(
          new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          now,
        ),
        buildRevenueQuery(
          new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        ),
      ]);

    const todaySales = Number(todayAgg._sum.total ?? 0).toFixed(2);
    const weeklySales = Number(weeklyAgg._sum.total ?? 0).toFixed(2);
    const monthlySales = Number(monthlyAgg._sum.total ?? 0).toFixed(2);
    const yearlySales = Number(yearlyAgg._sum.total ?? 0).toFixed(2);

    const mSales = Number(monthlyAgg._sum.total ?? 0);
    const pmSales = Number(prevMonthlyAgg._sum.total ?? 0);
    const revenueGrowthMoM =
      pmSales > 0
        ? Math.round(((mSales - pmSales) / pmSales) * 100 * 100) / 100
        : 0;

    const totalOrders = monthlyAgg._count._all;
    const averageOrderValue =
      totalOrders > 0 ? (mSales / totalOrders).toFixed(2) : '0.00';

    let conversionRate: number | undefined;
    if (!franchiseId) {
      const [totalCarts, orderedCarts] = await Promise.all([
        this.prisma.cart.count({ where: { createdAt: { gte, lte } } }),
        this.prisma.cart.count({
          where: { createdAt: { gte, lte }, status: 'ORDERED' },
        }),
      ]);
      conversionRate =
        totalCarts > 0
          ? Math.round((orderedCarts / totalCarts) * 10000) / 100
          : 0;
    }

    return {
      todaySales,
      weeklySales,
      monthlySales,
      yearlySales,
      revenueGrowthMoM,
      averageOrderValue,
      ...(conversionRate !== undefined ? { conversionRate } : {}),
    };
  }

  private async buildInventoryAnalytics(
    franchiseId: string | undefined,
    gte: Date,
    lte: Date,
  ): Promise<any> {
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inventoryValuationNum = 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    let newStockCount = 0;
    let mediumStockCount = 0;
    let oldStockCount = 0;

    if (franchiseId) {
      const stocks = await this.prisma.franchiseStock.findMany({
        where: { franchiseId },
        select: {
          quantity: true,
          lowStockThreshold: true,
          product: {
            select: {
              price: true,
              createdAt: true,
            },
          },
        },
      });

      for (const s of stocks) {
        const qty = s.quantity;
        totalStock += qty;
        if (qty <= s.lowStockThreshold && qty > 0) {
          lowStockCount++;
        }
        if (qty === 0) {
          outOfStockCount++;
        }
        inventoryValuationNum += qty * Number(s.product.price);

        const created = s.product.createdAt;
        if (created >= thirtyDaysAgo) {
          newStockCount += qty;
        } else if (created >= ninetyDaysAgo) {
          mediumStockCount += qty;
        } else {
          oldStockCount += qty;
        }
      }
    } else {
      const [products, franchiseStocks] = await Promise.all([
        this.prisma.product.findMany({
          where: { deletedAt: null },
          select: {
            price: true,
            stock: true,
            createdAt: true,
            warehouseStocks: {
              select: {
                quantity: true,
                lowStockThreshold: true,
              },
            },
            variants: {
              select: {
                stock: true,
              },
            },
          },
        }),
        this.prisma.franchiseStock.findMany({
          select: {
            quantity: true,
            lowStockThreshold: true,
            product: { select: { price: true, createdAt: true } },
          },
        }),
      ]);

      for (const p of products) {
        const qty =
          p.warehouseStocks?.quantity ??
          (p.variants.length > 0
            ? p.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)
            : (p.stock ?? 0));
        const lowStockThreshold = p.warehouseStocks?.lowStockThreshold ?? 5;

        totalStock += qty;
        if (qty <= lowStockThreshold && qty > 0) {
          lowStockCount++;
        }
        if (qty === 0) {
          outOfStockCount++;
        }
        inventoryValuationNum += qty * Number(p.price ?? 0);

        const created = p.createdAt;
        if (created >= thirtyDaysAgo) {
          newStockCount += qty;
        } else if (created >= ninetyDaysAgo) {
          mediumStockCount += qty;
        } else {
          oldStockCount += qty;
        }
      }

      for (const s of franchiseStocks) {
        const qty = s.quantity;
        totalStock += qty;
        if (qty <= s.lowStockThreshold && qty > 0) {
          lowStockCount++;
        }
        if (qty === 0) {
          outOfStockCount++;
        }
        inventoryValuationNum += qty * Number(s.product.price);

        const created = s.product.createdAt;
        if (created >= thirtyDaysAgo) {
          newStockCount += qty;
        } else if (created >= ninetyDaysAgo) {
          mediumStockCount += qty;
        } else {
          oldStockCount += qty;
        }
      }
    }

    const itemSales = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte, lte },
          status: { notIn: [OrderStatus.CANCELLED] },
          ...(franchiseId ? { franchiseId } : {}),
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 20,
    });

    const fastSales = itemSales.slice(0, 5);
    const slowSales = itemSales.slice(-5).reverse();

    const fetchProductDetails = async (salesList: typeof itemSales) => {
      if (!salesList.length) {
        return [];
      }
      const ids = salesList.map((s) => s.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          variants: { select: { sku: true }, take: 1 },
        },
      });
      const prodMap = new Map(products.map((p) => [p.id, p]));
      return salesList.map((s) => {
        const p = prodMap.get(s.productId);
        return {
          id: s.productId,
          name: p?.name ?? 'Unknown Product',
          sku: p?.variants[0]?.sku ?? 'N/A',
          unitsSold: s._sum.quantity ?? 0,
        };
      });
    };

    const [fastMovingProducts, slowMovingProducts] = await Promise.all([
      fetchProductDetails(fastSales),
      fetchProductDetails(slowSales),
    ]);

    return {
      totalStock,
      lowStockCount,
      outOfStockCount,
      fastMovingProducts,
      slowMovingProducts,
      inventoryValuation: inventoryValuationNum.toFixed(2),
      stockAging: {
        newStockCount,
        mediumStockCount,
        oldStockCount,
      },
    };
  }

  private async buildOrderAnalytics(
    franchiseId: string | undefined,
    gte: Date,
    lte: Date,
  ): Promise<any> {
    const orderGroups = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte, lte },
        ...(franchiseId ? { franchiseId } : {}),
      },
      _count: { _all: true },
    });

    const statusCounts: Record<string, number> = {};
    for (const og of orderGroups) {
      statusCounts[og.status] = og._count._all;
    }

    const completed =
      (statusCounts[OrderStatus.DELIVERED] ?? 0) +
      (statusCounts[OrderStatus.COMPLETED] ?? 0) +
      (statusCounts[OrderStatus.CONFIRMED] ?? 0);
    const cancelled = statusCounts[OrderStatus.CANCELLED] ?? 0;
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const denom = total - cancelled;
    const fulfillmentRate =
      denom > 0 ? Math.round((completed / denom) * 100) : 0;

    return {
      statusCounts,
      fulfillmentRate,
    };
  }

  private async buildCustomerAnalytics(
    franchiseId: string | undefined,
    gte: Date,
    lte: Date,
    prevGte: Date,
    prevLte: Date,
  ): Promise<any> {
    const customerOrders = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        customerId: { not: null },
        ...(franchiseId ? { franchiseId } : {}),
      },
      _count: { _all: true },
    });
    const totalCustomers = customerOrders.length;
    const repeatCustomers = customerOrders.filter(
      (co) => co._count._all > 1,
    ).length;
    const repeatPurchaseRate =
      totalCustomers > 0
        ? Math.round((repeatCustomers / totalCustomers) * 100)
        : 0;

    let newCustomers = 0;
    let returningCustomers = 0;
    let customerRetentionRate = 0;

    const firstOrders = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        customerId: { not: null },
        ...(franchiseId ? { franchiseId } : {}),
      },
      _min: { createdAt: true },
    });

    newCustomers = firstOrders.filter(
      (fo) =>
        fo._min?.createdAt &&
        fo._min.createdAt >= gte &&
        fo._min.createdAt <= lte,
    ).length;
    returningCustomers = firstOrders.filter(
      (fo) => fo._min?.createdAt && fo._min.createdAt < gte,
    ).length;

    const prevPeriodCustomers = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        createdAt: { gte: prevGte, lte: prevLte },
        customerId: { not: null },
        ...(franchiseId ? { franchiseId } : {}),
      },
    });
    const currentPeriodCustomers = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        createdAt: { gte, lte },
        customerId: { not: null },
        ...(franchiseId ? { franchiseId } : {}),
      },
    });

    const prevSet = new Set(prevPeriodCustomers.map((p) => p.customerId));
    const retainedCount = currentPeriodCustomers.filter((c) =>
      prevSet.has(c.customerId),
    ).length;
    customerRetentionRate =
      prevSet.size > 0 ? Math.round((retainedCount / prevSet.size) * 100) : 0;

    const revenueAgg = await this.prisma.order.aggregate({
      where: {
        status: { notIn: [OrderStatus.CANCELLED] },
        ...(franchiseId ? { franchiseId } : {}),
      },
      _sum: { total: true },
    });
    const totalRevenue = Number(revenueAgg._sum.total ?? 0);
    const customerLifetimeValue =
      totalCustomers > 0 ? (totalRevenue / totalCustomers).toFixed(2) : '0.00';

    return {
      newCustomers,
      returningCustomers,
      customerRetentionRate,
      repeatPurchaseRate,
      customerLifetimeValue,
    };
  }

  private async buildFranchiseAnalytics(gte: Date, lte: Date): Promise<any> {
    const franchiseGroup = await this.prisma.order.groupBy({
      by: ['franchiseId'],
      where: {
        createdAt: { gte, lte },
        status: { notIn: [OrderStatus.CANCELLED] },
      },
      _sum: { total: true },
      _count: { _all: true },
    });

    if (!franchiseGroup.length) {
      return {
        bestPerformingFranchise: null,
        lowestPerformingFranchise: null,
        revenueByFranchise: [],
      };
    }

    const fids = franchiseGroup.map((fg) => fg.franchiseId);
    const franchises = await this.prisma.franchise.findMany({
      where: { id: { in: fids } },
      select: { id: true, name: true, code: true },
    });
    const franchiseMap = new Map(franchises.map((f) => [f.id, f]));

    const list = franchiseGroup
      .map((fg) => {
        const f = franchiseMap.get(fg.franchiseId) ?? {
          name: 'Unknown',
          code: 'N/A',
        };
        return {
          id: fg.franchiseId,
          name: f.name,
          code: f.code,
          revenue: (fg._sum.total ?? 0).toString(),
          orderCount: fg._count._all,
        };
      })
      .sort((a, b) => Number(b.revenue) - Number(a.revenue));

    const bestPerformingFranchise =
      list.length > 0
        ? {
          id: list[0].id,
          name: list[0].name,
          revenue: Number(list[0].revenue).toFixed(2),
        }
        : null;
    const lowestPerformingFranchise =
      list.length > 0
        ? {
          id: list[list.length - 1].id,
          name: list[list.length - 1].name,
          revenue: Number(list[list.length - 1].revenue).toFixed(2),
        }
        : null;

    const revenueByFranchise = list.map((item) => ({
      ...item,
      revenue: Number(item.revenue).toFixed(2),
    }));

    return {
      bestPerformingFranchise,
      lowestPerformingFranchise,
      revenueByFranchise,
    };
  }

  private async buildOperationalAnalytics(
    franchiseId: string | undefined,
  ): Promise<any> {
    const pendingRequests = await this.prisma.stockRequest.count({
      where: {
        status: StockRequestStatus.PENDING,
        ...(franchiseId ? { franchiseId } : {}),
      },
    });

    const openIssues = await this.prisma.supportTicket.count({
      where: {
        status: {
          in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
        },
        ...(franchiseId ? { franchiseId } : {}),
      },
    });

    let pendingApprovals: number | undefined;
    let inventoryTransfersCount: number | undefined;

    if (!franchiseId) {
      pendingApprovals = await this.prisma.franchise.count({
        where: { kycStatus: KycStatus.PENDING },
      });
      inventoryTransfersCount = await this.prisma.stockTransfer.count({
        where: {
          status: {
            in: [StockTransferStatus.APPROVED, StockTransferStatus.IN_TRANSIT],
          },
        },
      });
    }

    return {
      ...(pendingApprovals !== undefined ? { pendingApprovals } : {}),
      stockRequestsCount: pendingRequests,
      ...(inventoryTransfersCount !== undefined
        ? { inventoryTransfersCount }
        : {}),
      openIssuesCount: openIssues,
    };
  }

  private async buildRecentActivities(
    franchiseId: string | undefined,
    gte: Date,
    lte: Date,
  ): Promise<any> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte, lte },
        ...(franchiseId ? { user: { franchiseId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId,
      user: l.user.email,
      createdAt: l.createdAt,
    }));
  }

  async getFranchiseMetrics(
    user: JwtUser,
    query: FranchiseDashboardQueryDto,
  ): Promise<FranchiseDashboardResponseDto> {
    const isFranchiseRole =
      user.role === Role.FRANCHISE_OWNER || user.role === Role.FRANCHISE_STAFF;

    const franchiseId = user.franchiseId ?? user.franchiseOwnerId;

    if (!isFranchiseRole || !franchiseId) {
      throw new ForbiddenException(
        'Access denied: Scope restricted to Franchise Owners or Franchise Staff',
      );
    }

    // Determine date range based on query parameters
    const lte = query.to ? new Date(query.to) : new Date();
    let gte: Date;
    if (query.from) {
      gte = new Date(query.from);
    } else {
      let days = 30;
      if (query.period === DashboardPeriod.SEVEN_DAYS) {
        days = 7;
      } else if (query.period === DashboardPeriod.FIFTEEN_DAYS) {
        days = 15;
      } else if (query.period === DashboardPeriod.THIRTY_DAYS) {
        days = 30;
      }
      gte = new Date(lte.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Determine 6 months ago for charts
    const startOfSixMonthsAgo = new Date();
    startOfSixMonthsAgo.setMonth(startOfSixMonthsAgo.getMonth() - 5);
    startOfSixMonthsAgo.setDate(1);
    startOfSixMonthsAgo.setHours(0, 0, 0, 0);

    // List of months for charts
    const monthsList: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthName = d.toLocaleString('en-US', { month: 'long' });
      monthsList.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: monthName,
      });
    }

    const [
      stocks,
      totalSalesAgg,
      totalOrders,
      completedOrders,
      openDeliveries,
      recentOrdersRaw,
      recentDeliveriesRaw,
      topCustomerGroups,
      faqs,
      pendingStockRequests,
      inTransitTransfers,
      openSupportTickets,
      monthlySalesOrders,
      monthlyDeliveredItems,
      topRetailCustomerGroups,
    ] = await Promise.all([
      // 1. Franchise stock for inventory metrics, low stock, categories, reorder suggestions
      this.prisma.franchiseStock.findMany({
        where: { franchiseId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              categoryId: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      // 2. Overview total sales (revenue sum)
      this.prisma.order.aggregate({
        where: {
          franchiseId,
          status: {
            notIn: [
              OrderStatus.CANCELLED,
              OrderStatus.RETURNED,
              OrderStatus.REFUNDED,
            ],
          },
          createdAt: { gte, lte },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      // 3. Overview total orders count
      this.prisma.order.count({
        where: { franchiseId, createdAt: { gte, lte } },
      }),
      // 4. Overview completed orders count
      this.prisma.order.count({
        where: {
          franchiseId,
          status: { in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] },
          createdAt: { gte, lte },
        },
      }),
      // 5. Overview open deliveries count (SCHEDULED or IN_TRANSIT)
      this.prisma.inboundDelivery.count({
        where: {
          franchiseId,
          status: { in: [DeliveryStatus.SCHEDULED, DeliveryStatus.IN_TRANSIT] },
          createdAt: { gte, lte },
        },
      }),
      // 6. Recent Orders (latest 10 rows)
      this.prisma.order.findMany({
        where: { franchiseId, createdAt: { gte, lte } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
      // 7. Recent Inbound Deliveries (latest 10 rows)
      this.prisma.inboundDelivery.findMany({
        where: { franchiseId, createdAt: { gte, lte } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      }),
      // 8. Top Customer groups (groupBy customerId on Order)
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: {
          franchiseId,
          customerId: { not: null },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      }),
      // 9. FAQ preview (visible, published, limit 3)
      this.prisma.faq.findMany({
        where: {
          isVisible: true,
          isDeleted: false,
          status: FaqStatus.PUBLISHED,
          audience: { in: [FaqAudience.FRANCHISE, FaqAudience.ALL] },
        },
        take: 3,
        select: {
          id: true,
          question: true,
          answer: true,
        },
      }),
      // 10. Operational Summary: pending stock requests
      this.prisma.stockRequest.count({
        where: {
          franchiseId,
          status: StockRequestStatus.PENDING,
        },
      }),
      // 11. Operational Summary: in-transit transfers via toNode.franchiseId
      this.prisma.stockTransfer.count({
        where: {
          toNode: { franchiseId },
          status: StockTransferStatus.IN_TRANSIT,
        },
      }),
      // 12. Operational Summary: open support tickets
      this.prisma.supportTicket.count({
        where: {
          franchiseId,
          status: {
            in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
          },
        },
      }),
      // 13. Monthly Sales (orders in 6 months)
      this.prisma.order.findMany({
        where: {
          franchiseId,
          createdAt: { gte, lte },
          status: {
            notIn: [
              OrderStatus.CANCELLED,
              OrderStatus.RETURNED,
              OrderStatus.REFUNDED,
            ],
          },
        },
        select: {
          total: true,
          createdAt: true,
        },
      }),
      // 14. Monthly Deliveries (deliveries in 6 months)
      this.prisma.inboundDelivery.findMany({
        where: {
          franchiseId,
          createdAt: { gte, lte },
          status: DeliveryStatus.DELIVERED,
        },
        select: {
          createdAt: true,
        },
      }),
      // 15. Top Retail Customer groups (groupBy retailCustomerId on Order)
      this.prisma.order.groupBy({
        by: ['retailCustomerId'],
        where: {
          franchiseId,
          retailCustomerId: { not: null },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    // Fetch customer details for top customer groups in one batch
    const customerIds = topCustomerGroups.map((g) => g.customerId as string);
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({
        where: { id: { in: customerIds } },
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
      })
      : [];
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    // Fetch retail customer details for top retail customer groups in one batch
    const retailCustomerIds = topRetailCustomerGroups.map(
      (g) => g.retailCustomerId as string,
    );
    const retailCustomers = retailCustomerIds.length
      ? await this.prisma.retailCustomer.findMany({
        where: { id: { in: retailCustomerIds } },
        select: {
          id: true,
          name: true,
          phoneNorm: true,
          email: true,
        },
      })
      : [];
    const retailCustomerMap = new Map(retailCustomers.map((rc) => [rc.id, rc]));

    const mappedCustomers = topCustomerGroups.map((g) => {
      const c = customerMap.get(g.customerId as string);
      return {
        customerId: g.customerId as string,
        name: c?.name ?? 'Unknown Customer',
        phone: c?.phone ?? null,
        email: c?.user?.email ?? null,
        totalOrders: g._count.id,
      };
    });

    const mappedRetailCustomers = topRetailCustomerGroups.map((g) => {
      const rc = retailCustomerMap.get(g.retailCustomerId as string);
      return {
        customerId: g.retailCustomerId as string,
        name: rc?.name ?? 'Unknown Retail Customer',
        phone: rc?.phoneNorm ?? null,
        email: rc?.email ?? null,
        totalOrders: g._count.id,
      };
    });

    const topCustomers = [...mappedCustomers, ...mappedRetailCustomers]
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10);

    // 1. Overview computations
    const totalSales = Number(totalSalesAgg._sum.total ?? 0);
    const atpUnits = stocks.reduce(
      (sum, s) => sum + Math.max(0, s.quantity - s.reserved),
      0,
    );
    const completionPercentage =
      totalOrders > 0
        ? Math.round((completedOrders / totalOrders) * 100 * 100) / 100
        : 0;

    const overview = {
      totalSales,
      completedOrders,
      totalOrders,
      openDeliveries,
      atpUnits,
      completionPercentage,
    };

    // 2. Charts computations
    const salesByMonth = new Map<string, number>();
    const deliveriesByMonth = new Map<string, number>();

    for (const m of monthsList) {
      const key = `${m.year}-${m.month}`;
      salesByMonth.set(key, 0);
      deliveriesByMonth.set(key, 0);
    }

    for (const order of monthlySalesOrders) {
      const key = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth() + 1}`;
      if (salesByMonth.has(key)) {
        salesByMonth.set(key, salesByMonth.get(key)! + Number(order.total));
      }
    }

    for (const del of monthlyDeliveredItems) {
      const key = `${del.createdAt.getFullYear()}-${del.createdAt.getMonth() + 1}`;
      if (deliveriesByMonth.has(key)) {
        deliveriesByMonth.set(key, deliveriesByMonth.get(key)! + 1);
      }
    }

    const monthlySales = monthsList.map((m) => ({
      month: m.label,
      revenue:
        Math.round((salesByMonth.get(`${m.year}-${m.month}`) ?? 0) * 100) / 100,
    }));

    const monthlyDeliveries = monthsList.map((m) => ({
      month: m.label,
      deliveries: deliveriesByMonth.get(`${m.year}-${m.month}`) ?? 0,
    }));

    const charts = {
      monthlySales,
      monthlyDeliveries,
    };

    // 3. Inventory computations
    const totalInventoryRows = stocks.length;

    const lowStockProducts = stocks
      .filter((s) => s.quantity <= s.lowStockThreshold)
      .map((s) => {
        const totalQty = s.quantity;
        const reservedQty = s.reserved;
        const availableQty = Math.max(0, totalQty - reservedQty);
        const stockPercentage =
          totalQty > 0 ? Math.round((availableQty / totalQty) * 100) : 0;
        return {
          productId: s.productId,
          productName: s.product.name,
          availableQty,
          totalQty,
          reservedQty,
          stockPercentage,
        };
      });

    const categoryUnitsMap = new Map<string, { name: string; units: number }>();
    let totalAllUnits = 0;

    for (const s of stocks) {
      const catId = s.product.categoryId || 'unknown';
      const catName = s.product.category?.name || 'Uncategorized';
      const units = s.quantity;
      totalAllUnits += units;

      const existing = categoryUnitsMap.get(catId);
      if (existing) {
        existing.units += units;
      } else {
        categoryUnitsMap.set(catId, { name: catName, units });
      }
    }

    const categoryBreakdown = Array.from(categoryUnitsMap.entries()).map(
      ([id, val]) => {
        const percentage =
          totalAllUnits > 0 ? Math.round((val.units / totalAllUnits) * 100) : 0;
        return {
          categoryId: id === 'unknown' ? null : id,
          categoryName: val.name,
          units: val.units,
          percentage,
        };
      },
    );

    const inventory = {
      totalInventoryRows,
      atpUnits,
      lowStockProducts,
      categoryBreakdown,
    };

    // 4. Reorder Suggestions computations
    const reorderSuggestions = stocks
      .map((s) => {
        const currentQty = s.quantity;
        const reservedQty = s.reserved ?? 0;
        const availableQty = Math.max(0, currentQty - reservedQty);
        const lowStockThreshold = s.lowStockThreshold;
        return {
          productId: s.productId,
          productName: s.product.name,
          categoryName: s.product.category?.name ?? null,
          currentQty,
          availableQty,
          lowStockThreshold,
          suggestedOrderQty: Math.max(
            lowStockThreshold * 2 - availableQty,
            lowStockThreshold,
          ),
        };
      })
      .filter((r) => r.availableQty <= (r.lowStockThreshold ?? 5));

    // 5. Recent Orders mapping
    const recentOrders = recentOrdersRaw.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      amount: Number(o.total),
      status: o.status,
      createdAt: o.createdAt,
    }));

    // 6. Recent Deliveries mapping
    const recentDeliveries = recentDeliveriesRaw.map((d) => ({
      deliveryId: d.id,
      status: d.status,
      createdAt: d.createdAt,
    }));

    // 7. Operational Summary mapping
    const operationalSummary = {
      pendingStockRequests,
      inTransitTransfers,
      openSupportTickets,
    };

    return {
      overview,
      charts,
      inventory,
      reorderSuggestions,
      recentOrders,
      recentDeliveries,
      topCustomers,
      faqPreview: faqs,
      operationalSummary,
      period: query.period,
      range: { from: query.from, to: query.to },
    };
  }

  private async buildMediaLibraryAnalytics(): Promise<any> {
    const items = await this.prisma.mediaLibrary.findMany({
      select: {
        size: true,
      },
    });

    const totalCount = items.length;
    const occupiedStorageBytes = items.reduce((sum, item) => {
      const parsed = parseFloat(item.size);
      return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);

    const formatBytes = (bytes: number, decimals = 2) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    return {
      totalCount,
      occupiedStorage: formatBytes(occupiedStorageBytes),
    };
  }

  private async buildCharts(franchiseId: string | undefined): Promise<any> {
    const startOfSixMonthsAgo = new Date();
    startOfSixMonthsAgo.setMonth(startOfSixMonthsAgo.getMonth() - 5);
    startOfSixMonthsAgo.setDate(1);
    startOfSixMonthsAgo.setHours(0, 0, 0, 0);

    const monthsList: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthName = d.toLocaleString('en-US', { month: 'long' });
      monthsList.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: monthName,
      });
    }

    const [monthlySalesOrders, monthlyDeliveredItems] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          ...(franchiseId ? { franchiseId } : {}),
          createdAt: { gte: startOfSixMonthsAgo },
          status: {
            notIn: [
              OrderStatus.CANCELLED,
              OrderStatus.RETURNED,
              OrderStatus.REFUNDED,
            ],
          },
        },
        select: {
          total: true,
          createdAt: true,
        },
      }),
      this.prisma.inboundDelivery.findMany({
        where: {
          ...(franchiseId ? { franchiseId } : {}),
          createdAt: { gte: startOfSixMonthsAgo },
          status: DeliveryStatus.DELIVERED,
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const salesByMonth = new Map<string, number>();
    const deliveriesByMonth = new Map<string, number>();

    for (const m of monthsList) {
      const key = `${m.year}-${m.month}`;
      salesByMonth.set(key, 0);
      deliveriesByMonth.set(key, 0);
    }

    for (const order of monthlySalesOrders) {
      const key = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth() + 1}`;
      if (salesByMonth.has(key)) {
        salesByMonth.set(key, salesByMonth.get(key)! + Number(order.total));
      }
    }

    for (const del of monthlyDeliveredItems) {
      const key = `${del.createdAt.getFullYear()}-${del.createdAt.getMonth() + 1}`;
      if (deliveriesByMonth.has(key)) {
        deliveriesByMonth.set(key, deliveriesByMonth.get(key)! + 1);
      }
    }

    const monthlySales = monthsList.map((m) => ({
      month: m.label,
      revenue:
        Math.round((salesByMonth.get(`${m.year}-${m.month}`) ?? 0) * 100) / 100,
    }));

    const monthlyDeliveries = monthsList.map((m) => ({
      month: m.label,
      deliveries: deliveriesByMonth.get(`${m.year}-${m.month}`) ?? 0,
    }));

    return {
      monthlySales,
      monthlyDeliveries,
    };
  }

  private async buildInventory(franchiseId: string | undefined): Promise<any> {
    let totalInventoryRows = 0;
    let atpUnits = 0;
    let lowStockProducts: any[] = [];
    const categoryUnitsMap = new Map<string, { name: string; units: number }>();
    let totalAllUnits = 0;

    if (franchiseId) {
      const stocks = await this.prisma.franchiseStock.findMany({
        where: { franchiseId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              categoryId: true,
              category: { select: { name: true } },
            },
          },
        },
      });

      totalInventoryRows = stocks.length;
      atpUnits = stocks.reduce(
        (sum, s) => sum + Math.max(0, s.quantity - s.reserved),
        0,
      );

      lowStockProducts = stocks
        .filter((s) => s.quantity <= s.lowStockThreshold)
        .map((s) => {
          const totalQty = s.quantity;
          const reservedQty = s.reserved;
          const availableQty = Math.max(0, totalQty - reservedQty);
          const stockPercentage =
            totalQty > 0 ? Math.round((availableQty / totalQty) * 100) : 0;
          return {
            productId: s.productId,
            productName: s.product.name,
            availableQty,
            totalQty,
            reservedQty,
            stockPercentage,
          };
        });

      for (const s of stocks) {
        const catId = s.product.categoryId || 'unknown';
        const catName = s.product.category?.name || 'Uncategorized';
        const units = s.quantity;
        totalAllUnits += units;

        const existing = categoryUnitsMap.get(catId);
        if (existing) {
          existing.units += units;
        } else {
          categoryUnitsMap.set(catId, { name: catName, units });
        }
      }
    } else {
      const [products, franchiseStocks] = await Promise.all([
        this.prisma.product.findMany({
          where: { deletedAt: null },
          include: {
            warehouseStocks: true,
            category: { select: { name: true } },
            variants: { select: { stock: true } },
          },
        }),
        this.prisma.franchiseStock.findMany({
          include: {
            product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                category: { select: { name: true } },
              },
            },
          },
        }),
      ]);

      totalInventoryRows = products.length + franchiseStocks.length;

      const wAtp = products.reduce((sum, p) => {
        const qty =
          p.warehouseStocks?.quantity ??
          (p.variants.length > 0
            ? p.variants.reduce((sumVar, v) => sumVar + (v.stock ?? 0), 0)
            : (p.stock ?? 0));
        const reserved = p.warehouseStocks?.reserved ?? 0;
        return sum + Math.max(0, qty - reserved);
      }, 0);

      const fAtp = franchiseStocks.reduce(
        (sum, s) => sum + Math.max(0, s.quantity - s.reserved),
        0,
      );
      atpUnits = wAtp + fAtp;

      const warehouseLow = products
        .map((p) => {
          const qty =
            p.warehouseStocks?.quantity ??
            (p.variants.length > 0
              ? p.variants.reduce((sumVar, v) => sumVar + (v.stock ?? 0), 0)
              : (p.stock ?? 0));
          const lowStockThreshold = p.warehouseStocks?.lowStockThreshold ?? 5;
          const reserved = p.warehouseStocks?.reserved ?? 0;
          return {
            productId: p.id,
            productName: p.name,
            availableQty: Math.max(0, qty - reserved),
            totalQty: qty,
            reservedQty: reserved,
            lowStockThreshold,
          };
        })
        .filter((item) => item.totalQty <= item.lowStockThreshold);

      const franchiseLow = franchiseStocks
        .filter((s) => s.quantity <= s.lowStockThreshold)
        .map((s) => {
          const totalQty = s.quantity;
          const reservedQty = s.reserved;
          const availableQty = Math.max(0, totalQty - reservedQty);
          return {
            productId: s.productId,
            productName: s.product.name,
            availableQty,
            totalQty,
            reservedQty,
            lowStockThreshold: s.lowStockThreshold,
          };
        });

      lowStockProducts = warehouseLow.map((item) => {
        const stockPercentage =
          item.totalQty > 0
            ? Math.round((item.availableQty / item.totalQty) * 100)
            : 0;
        return {
          productId: item.productId,
          productName: item.productName,
          availableQty: item.availableQty,
          totalQty: item.totalQty,
          reservedQty: item.reservedQty,
          stockPercentage,
        };
      });

      for (const p of products) {
        const catId = p.categoryId || 'unknown';
        const catName = p.category?.name || 'Uncategorized';
        const qty =
          p.warehouseStocks?.quantity ??
          (p.variants.length > 0
            ? p.variants.reduce((sumVar, v) => sumVar + (v.stock ?? 0), 0)
            : (p.stock ?? 0));
        totalAllUnits += qty;

        const existing = categoryUnitsMap.get(catId);
        if (existing) {
          existing.units += qty;
        } else {
          categoryUnitsMap.set(catId, { name: catName, units: qty });
        }
      }

      for (const s of franchiseStocks) {
        const catId = s.product.categoryId || 'unknown';
        const catName = s.product.category?.name || 'Uncategorized';
        const units = s.quantity;
        totalAllUnits += units;

        const existing = categoryUnitsMap.get(catId);
        if (existing) {
          existing.units += units;
        } else {
          categoryUnitsMap.set(catId, { name: catName, units });
        }
      }
    }

    const categoryBreakdown = Array.from(categoryUnitsMap.entries()).map(
      ([id, val]) => {
        const percentage =
          totalAllUnits > 0 ? Math.round((val.units / totalAllUnits) * 100) : 0;
        return {
          categoryId: id === 'unknown' ? null : id,
          categoryName: val.name,
          units: val.units,
          percentage,
        };
      },
    );

    return {
      totalInventoryRows,
      atpUnits,
      lowStockProducts,
      categoryBreakdown,
    };
  }

  private async buildRecentDeliveries(
    franchiseId: string | undefined,
  ): Promise<any[]> {
    const deliveries = await this.prisma.inboundDelivery.findMany({
      where: {
        ...(franchiseId ? { franchiseId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    return deliveries.map((d) => ({
      deliveryId: d.id,
      status: d.status,
      createdAt: d.createdAt,
    }));
  }

  private async buildTopCustomers(
    franchiseId: string | undefined,
  ): Promise<any[]> {
    const topCustomerGroups = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        customerId: { not: null },
        ...(franchiseId ? { franchiseId } : {}),
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    const customerIds = topCustomerGroups.map((g) => g.customerId as string);
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({
        where: { id: { in: customerIds } },
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
      })
      : [];
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    return topCustomerGroups.map((g) => {
      const c = customerMap.get(g.customerId as string);
      return {
        customerId: g.customerId as string,
        name: c?.name ?? 'Unknown Customer',
        phone: c?.phone ?? null,
        email: c?.user?.email ?? null,
        totalOrders: g._count.id,
      };
    });
  }

  private async buildFaqPreview(): Promise<any[]> {
    return this.prisma.faq.findMany({
      where: {
        isVisible: true,
        isDeleted: false,
        status: FaqStatus.PUBLISHED,
        audience: { in: [FaqAudience.FRANCHISE, FaqAudience.ALL] },
      },
      take: 3,
      select: {
        id: true,
        question: true,
        answer: true,
      },
    });
  }
}
