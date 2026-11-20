import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RevenuePeriod } from './enums/period.enum';
import { RevenueResponseDto, RevenueGraphPointDto } from './dto/revenue-response.dto';
import { Prisma, RefundStatus } from '@prisma/client';
import { JwtUser } from '../auth/types/jwt-user.type';

@Injectable()
export class RevenueService {
  private readonly logger = new Logger(RevenueService.name);

  constructor(private readonly prisma: PrismaService) {}

  public getDateRange(
    periodStr?: string,
    fromDateStr?: string,
    toDateStr?: string,
  ): { gte: Date; lte: Date; normalizedPeriod: string } {
    if (fromDateStr || toDateStr) {
      let gte: Date;
      let lte: Date;

      if (fromDateStr) {
        gte = new Date(fromDateStr);
        if (/^\d{4}-\d{2}-\d{2}$/.test(fromDateStr)) {
          gte.setHours(0, 0, 0, 0);
        }
      } else {
        gte = new Date(0);
      }

      if (toDateStr) {
        lte = new Date(toDateStr);
        if (/^\d{4}-\d{2}-\d{2}$/.test(toDateStr)) {
          lte.setHours(23, 59, 59, 999);
        }
      } else {
        lte = new Date();
      }

      const normalizedPeriod =
        periodStr && periodStr !== RevenuePeriod.DAY
          ? periodStr === 'MONTHELY'
            ? 'MONTHLY'
            : periodStr.toUpperCase()
          : 'CUSTOM';

      return {
        gte,
        lte,
        normalizedPeriod,
      };
    }

    const lte = new Date();
    const gte = new Date(lte);

    const periodKey = (periodStr || RevenuePeriod.DAY).toUpperCase();

    switch (periodKey) {
      case 'DAY':
        gte.setHours(0, 0, 0, 0);
        break;
      case 'WEEK':
        const dayOfWeek = gte.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        gte.setDate(gte.getDate() - diffToMonday);
        gte.setHours(0, 0, 0, 0);
        break;
      case 'MONTHLY':
      case 'MONTHELY':
        gte.setDate(1);
        gte.setHours(0, 0, 0, 0);
        break;
      case 'YEARLY':
        gte.setMonth(0, 1);
        gte.setHours(0, 0, 0, 0);
        break;
      default:
        gte.setHours(0, 0, 0, 0);
        break;
    }

    return {
      gte,
      lte,
      normalizedPeriod: periodKey === 'MONTHELY' ? 'MONTHLY' : periodKey,
    };
  }

  async getAdminRevenue(params: {
    period?: RevenuePeriod | string;
    franchiseId?: string;
    limit?: number;
    fromDate?: string;
    toDate?: string;
  }): Promise<RevenueResponseDto> {
    return this.getRevenueMetrics(params);
  }

  async getFranchiseRevenue(
    user: JwtUser,
    params: {
      period?: RevenuePeriod | string;
      franchiseId?: string;
      limit?: number;
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<RevenueResponseDto> {
    const fid =
      params.franchiseId ||
      user.franchiseId ||
      user.franchiseOwnerId;

    return this.getRevenueMetrics({
      period: params.period,
      franchiseId: fid,
      limit: params.limit,
      fromDate: params.fromDate,
      toDate: params.toDate,
    });
  }

  private async computeMetricsForRange(gte: Date, lte: Date, franchiseId?: string) {
    let customerOrderRevenues = 0;
    let posRevenue = 0;
    let onlineCustomerRevenue = 0;

    try {
      const orderWhere: Prisma.OrderWhereInput = {
        createdAt: { gte, lte },
        status: { notIn: ['CANCELLED'] },
      };

      if (franchiseId) {
        orderWhere.franchiseId = franchiseId;
      }

      const totalOrdersAgg = await this.prisma.order.aggregate({
        where: orderWhere,
        _sum: { total: true },
      });
      customerOrderRevenues = Number(totalOrdersAgg._sum.total || 0);

      const posOrdersAgg = await this.prisma.order.aggregate({
        where: {
          ...orderWhere,
          channel: 'POS',
        },
        _sum: { total: true },
      });
      posRevenue = Number(posOrdersAgg._sum.total || 0);

      const onlineOrdersAgg = await this.prisma.order.aggregate({
        where: {
          ...orderWhere,
          channel: 'ONLINE',
        },
        _sum: { total: true },
      });
      onlineCustomerRevenue = Number(onlineOrdersAgg._sum.total || 0);
    } catch (error) {
      this.logger.error('Error computing customer order revenues:', error);
    }

    let franchiseStockRevenue = 0;
    try {
      const stockReqWhere: Prisma.StockRequestWhereInput = {
        createdAt: { gte, lte },
        status: { notIn: ['REJECTED', 'CANCELLED'] },
      };

      if (franchiseId) {
        stockReqWhere.franchiseId = franchiseId;
      }

      const stockReqAgg = await this.prisma.stockRequest.aggregate({
        where: stockReqWhere,
        _sum: { billingTotal: true, paidAmount: true },
      });

      franchiseStockRevenue = Number(
        stockReqAgg._sum.billingTotal || stockReqAgg._sum.paidAmount || 0,
      );
    } catch (error) {
      this.logger.error('Error computing franchise stock revenue:', error);
    }

    let supplierPayments = 0;
    try {
      const poWhere: Prisma.PurchaseOrderWhereInput = {
        createdAt: { gte, lte },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      };

      const poAgg = await this.prisma.purchaseOrder.aggregate({
        where: poWhere,
        _sum: { totalAmount: true },
      });
      supplierPayments = Number(poAgg._sum.totalAmount || 0);
    } catch (error) {
      this.logger.error('Error computing supplier payments:', error);
    }

    let refundLosses = 0;
    try {
      const refundWhere: Prisma.RefundWhereInput = {
        createdAt: { gte, lte },
        status: { notIn: [RefundStatus.FAILED, RefundStatus.CANCELLED] },
      };

      if (franchiseId) {
        refundWhere.returnRequest = {
          franchiseId,
        };
      }

      const refundAgg = await this.prisma.refund.aggregate({
        where: refundWhere,
        _sum: { processedRefundAmount: true, expectedRefundAmount: true },
      });

      refundLosses = Number(
        refundAgg._sum.processedRefundAmount ||
          refundAgg._sum.expectedRefundAmount ||
          0,
      );
    } catch (error) {
      this.logger.error('Error computing refund losses:', error);
    }

    const overAllRevanure = customerOrderRevenues + franchiseStockRevenue;
    const mergedCustomerOrderRevenues = customerOrderRevenues + franchiseStockRevenue;

    return {
      customerOrderRevenues: mergedCustomerOrderRevenues,
      posRevenue,
      onlineCustomerRevenue,
      supplierPayments,
      refundLosses,
      overAllRevanure,
      POSRevanue: posRevenue,
      OnlineCustomerRevanue: onlineCustomerRevenue,
      SupplierPayments: supplierPayments,
      CustomerOrderRevenues: mergedCustomerOrderRevenues,
      RefundLosses: refundLosses,
    };
  }

  private async generateGraphBuckets(params: {
    periodKey: string;
    limit: number;
    franchiseId?: string;
    gte?: Date;
    lte?: Date;
    fromDate?: string;
    toDate?: string;
  }): Promise<RevenueGraphPointDto[]> {
    const limit = Math.max(1, Math.min(params.limit || 7, 100));
    const periodKey = (params.periodKey || 'DAY').toUpperCase();
    const buckets: { gte: Date; lte: Date; label: string }[] = [];

    if (params.fromDate || params.toDate) {
      const start = new Date(params.gte!);
      const end = new Date(params.lte!);

      if (periodKey === 'MONTHLY' || periodKey === 'MONTHELY') {
        const current = new Date(start);
        current.setDate(1);
        current.setHours(0, 0, 0, 0);

        while (current <= end && buckets.length < 100) {
          const bGte = new Date(current);
          const bLte = new Date(
            current.getFullYear(),
            current.getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          );
          const label = `${bGte.getFullYear()}-${String(
            bGte.getMonth() + 1,
          ).padStart(2, '0')}`;
          buckets.push({
            gte: bGte < start ? start : bGte,
            lte: bLte > end ? end : bLte,
            label,
          });
          current.setMonth(current.getMonth() + 1);
        }
      } else if (periodKey === 'YEARLY') {
        const current = new Date(start);
        current.setMonth(0, 1);
        current.setHours(0, 0, 0, 0);

        while (current <= end && buckets.length < 100) {
          const bGte = new Date(current);
          const bLte = new Date(
            current.getFullYear(),
            11,
            31,
            23,
            59,
            59,
            999,
          );
          const label = `${bGte.getFullYear()}`;
          buckets.push({
            gte: bGte < start ? start : bGte,
            lte: bLte > end ? end : bLte,
            label,
          });
          current.setFullYear(current.getFullYear() + 1);
        }
      } else {
        const current = new Date(start);
        current.setHours(0, 0, 0, 0);

        while (current <= end && buckets.length < 100) {
          const bGte = new Date(current);
          if (bGte < start) bGte.setTime(start.getTime());

          const bLte = new Date(current);
          bLte.setHours(23, 59, 59, 999);
          if (bLte > end) bLte.setTime(end.getTime());

          const label = bGte.toISOString().split('T')[0];
          buckets.push({ gte: bGte, lte: bLte, label });

          current.setDate(current.getDate() + 1);
        }
      }
    } else {
      const now = new Date();

      for (let i = limit - 1; i >= 0; i--) {
        const gte = new Date(now);
        const lte = new Date(now);

        switch (periodKey) {
          case 'DAY': {
            gte.setDate(gte.getDate() - i);
            gte.setHours(0, 0, 0, 0);

            lte.setDate(lte.getDate() - i);
            lte.setHours(23, 59, 59, 999);

            const label = gte.toISOString().split('T')[0];
            buckets.push({ gte, lte, label });
            break;
          }
          case 'WEEK': {
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() - i * 7);

            const dayOfWeek = targetDate.getDay();
            const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            gte.setTime(targetDate.getTime());
            gte.setDate(gte.getDate() - diffToMonday);
            gte.setHours(0, 0, 0, 0);

            lte.setTime(gte.getTime());
            lte.setDate(lte.getDate() + 6);
            lte.setHours(23, 59, 59, 999);

            const label = `W-${gte.toISOString().split('T')[0]}`;
            buckets.push({ gte, lte, label });
            break;
          }
          case 'MONTHLY':
          case 'MONTHELY': {
            gte.setMonth(gte.getMonth() - i, 1);
            gte.setHours(0, 0, 0, 0);

            lte.setMonth(gte.getMonth() + 1, 0);
            lte.setHours(23, 59, 59, 999);

            const year = gte.getFullYear();
            const month = String(gte.getMonth() + 1).padStart(2, '0');
            const label = `${year}-${month}`;
            buckets.push({ gte, lte, label });
            break;
          }
          case 'YEARLY': {
            gte.setFullYear(gte.getFullYear() - i, 0, 1);
            gte.setHours(0, 0, 0, 0);

            lte.setFullYear(gte.getFullYear(), 11, 31);
            lte.setHours(23, 59, 59, 999);

            const label = `${gte.getFullYear()}`;
            buckets.push({ gte, lte, label });
            break;
          }
          default: {
            gte.setDate(gte.getDate() - i);
            gte.setHours(0, 0, 0, 0);

            lte.setDate(lte.getDate() - i);
            lte.setHours(23, 59, 59, 999);

            const label = gte.toISOString().split('T')[0];
            buckets.push({ gte, lte, label });
            break;
          }
        }
      }
    }

    const graphPoints = await Promise.all(
      buckets.map(async (b) => {
        const metrics = await this.computeMetricsForRange(
          b.gte,
          b.lte,
          params.franchiseId,
        );

        return {
          label: b.label,
          startDate: b.gte.toISOString(),
          endDate: b.lte.toISOString(),

          overAllRevanure: metrics.overAllRevanure,
          SupplierPayments: metrics.SupplierPayments,
          CustomerOrderRevenues: metrics.CustomerOrderRevenues,
          RefundLosses: metrics.RefundLosses,

          overallRevenue: metrics.overAllRevanure,
          supplierPayments: metrics.SupplierPayments,
          customerOrderRevenues: metrics.CustomerOrderRevenues,
          refundLosses: metrics.RefundLosses,

          POSRevanue: metrics.POSRevanue,
          OnlineCustomerRevanue: metrics.OnlineCustomerRevanue,
          posRevenue: metrics.POSRevanue,
          onlineCustomerRevenue: metrics.OnlineCustomerRevanue,
        };
      }),
    );

    return graphPoints;
  }

  async getRevenueMetrics(params: {
    period?: RevenuePeriod | string;
    franchiseId?: string;
    limit?: number;
    fromDate?: string;
    toDate?: string;
  }): Promise<RevenueResponseDto> {
    const { gte, lte, normalizedPeriod } = this.getDateRange(
      params.period,
      params.fromDate,
      params.toDate,
    );
    const franchiseId = params.franchiseId;
    let franchiseCode: string | null = null;
    if (franchiseId) {
      try {
        const franchise = await this.prisma.franchise.findUnique({
          where: { id: franchiseId },
          select: { code: true },
        });
        franchiseCode = franchise?.code || null;
      } catch (error) {
        this.logger.error(`Error querying franchise code for id ${franchiseId}:`, error);
      }
    }
    const limit = params.limit || 7;

    const graphData = await this.generateGraphBuckets({
      periodKey: normalizedPeriod,
      limit,
      franchiseId,
      gte,
      lte,
      fromDate: params.fromDate,
      toDate: params.toDate,
    });

    const totals = graphData.reduce(
      (acc, item) => {
        acc.overAllRevanure += item.overAllRevanure || 0;
        acc.SupplierPayments += item.SupplierPayments || 0;
        acc.CustomerOrderRevenues += item.CustomerOrderRevenues || 0;
        acc.RefundLosses += item.RefundLosses || 0;
        acc.POSRevanue += item.POSRevanue || 0;
        acc.OnlineCustomerRevanue += item.OnlineCustomerRevanue || 0;
        return acc;
      },
      {
        overAllRevanure: 0,
        SupplierPayments: 0,
        CustomerOrderRevenues: 0,
        RefundLosses: 0,
        POSRevanue: 0,
        OnlineCustomerRevanue: 0,
      },
    );

    const overAllRevanure = Number(totals.overAllRevanure.toFixed(2));
    const SupplierPayments = Number(totals.SupplierPayments.toFixed(2));
    const CustomerOrderRevenues = Number(totals.CustomerOrderRevenues.toFixed(2));
    const RefundLosses = Number(totals.RefundLosses.toFixed(2));
    const POSRevanue = Number(totals.POSRevanue.toFixed(2));
    const OnlineCustomerRevanue = Number(totals.OnlineCustomerRevanue.toFixed(2));

    const response: RevenueResponseDto = {
      period: normalizedPeriod,
      startDate: gte.toISOString(),
      endDate: lte.toISOString(),
      fromDate: params.fromDate || null,
      toDate: params.toDate || null,
      franchiseId: franchiseId || null,
      franchiseCode: franchiseCode || null,
      limit,

      // Base fields calculated as sum of graphData
      overAllRevanure,
      SupplierPayments,
      CustomerOrderRevenues,
      RefundLosses,

      // camelCase aliases
      overallRevenue: overAllRevanure,
      supplierPayments: SupplierPayments,
      customerOrderRevenues: CustomerOrderRevenues,
      refundLosses: RefundLosses,

      // Franchise specific fields
      POSRevanue,
      OnlineCustomerRevanue,
      posRevenue: POSRevanue,
      onlineCustomerRevenue: OnlineCustomerRevanue,

      // Historical graph points based on limit
      graphData,
    };

    return response;
  }
}
