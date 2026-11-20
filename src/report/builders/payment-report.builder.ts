import { Injectable } from '@nestjs/common';
import { BaseReportBuilder } from './base-report.builder';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveUserFranchiseId } from '../constants/report.constants';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  ReportFilter,
  ReportSummaryCard,
  ReportFieldRegistryItem,
} from '../interfaces/report.interface';
import { Role } from '@prisma/client';
import { PaymentReportFieldEnum } from '../enums/payment-report-field.enum';

@Injectable()
export class PaymentReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'payments';
  }

  getTitle(): string {
    return 'Payments Report';
  }

  getPrimaryEntity(): string {
    return 'FinancialEvent';
  }

  getRelatedEntities(): string[] {
    return ['LedgerEntry'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: PaymentReportFieldEnum.RAZORPAY_ORDER_ID,
        label: 'Razorpay Order ID',
        field: 'razorpayOrderId',
        type: 'string',
        category: 'Transaction Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { razorpayOrderId: true },
      },
      {
        key: PaymentReportFieldEnum.RAZORPAY_PAYMENT_ID,
        label: 'Razorpay Payment ID',
        field: 'razorpayPaymentId',
        type: 'string',
        category: 'Transaction Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { razorpayPaymentId: true },
      },
      {
        key: PaymentReportFieldEnum.GATEWAY_STATUS,
        label: 'Gateway Status',
        field: 'gatewayStatus',
        type: 'status',
        category: 'Transaction Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { gatewayStatus: true },
      },
      {
        key: PaymentReportFieldEnum.PROCESSED,
        label: 'Processed Status',
        field: 'processed',
        type: 'status',
        category: 'Transaction Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { processed: true },
      },
      {
        key: PaymentReportFieldEnum.AMOUNT,
        label: 'Amount',
        field: 'amount',
        type: 'currency',
        category: 'Transaction Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { amount: true },
      },
      {
        key: PaymentReportFieldEnum.CREATED_AT,
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Transaction Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { createdAt: true },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Gateway Status',
        type: 'select',
        options: [
          { label: 'Captured', value: 'captured' },
          { label: 'Failed', value: 'failed' },
          { label: 'Refunded', value: 'refunded' },
        ],
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const userFranchiseId = resolveUserFranchiseId(user);
    const clauses: any[] = [];

    // Franchise scoping via LedgerEntry actor details
    if (
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF
    ) {
      if (userFranchiseId) {
        clauses.push({
          ledgerEntries: {
            some: {
              actorType: 'FRANCHISE',
              actorId: userFranchiseId,
            },
          },
        });
      }
    }

    // Status filter (maps gatewayStatus)
    if (query.status) {
      clauses.push({ gatewayStatus: query.status });
    }

    // Date filters
    const dateRange = this.buildDateRangeFilter(
      query.fromDate,
      query.toDate ?? query.lastDate,
    );
    if (dateRange) {
      clauses.push({ createdAt: dateRange });
    }

    // Search filter
    if (query.search?.trim()) {
      const search = query.search.trim();
      clauses.push({
        OR: [
          { razorpayOrderId: { contains: search, mode: 'insensitive' } },
          { razorpayPaymentId: { contains: search, mode: 'insensitive' } },
          { gatewayStatus: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    // Sort logic
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || query.order || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    return {
      where,
      orderBy,
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const [aggregates, processedCount, unprocessedCount] = await Promise.all([
      prisma.financialEvent.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.financialEvent.count({
        where: {
          ...where,
          processed: true,
        },
      }),
      prisma.financialEvent.count({
        where: {
          ...where,
          processed: false,
        },
      }),
    ]);

    const totalCount = aggregates._count._all;
    const totalAmount = Number(aggregates._sum.amount ?? 0);

    return {
      totalPayments: {
        label: 'Total Payments',
        value: totalCount,
        type: 'number',
      },
      processedPayments: {
        label: 'Processed Payments',
        value: processedCount,
        type: 'number',
      },
      unprocessedPayments: {
        label: 'Unprocessed Payments',
        value: unprocessedCount,
        type: 'number',
      },
      totalAmountSum: {
        label: 'Total Paid Value',
        value: totalAmount.toFixed(2),
        type: 'currency',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      razorpayOrderId: r.razorpayOrderId ?? 'N/A',
      razorpayPaymentId: r.razorpayPaymentId ?? 'N/A',
      gatewayStatus: r.gatewayStatus ?? 'N/A',
      processed: r.processed ? 'PROCESSED' : 'UNPROCESSED',
      amount: Number(r.amount || 0).toFixed(2),
      createdAt: r.createdAt,
    }));
  }
}
