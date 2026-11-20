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
import { TransactionReportFieldEnum } from '../enums/transaction-report-field.enum';

@Injectable()
export class TransactionReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'transactions';
  }

  getTitle(): string {
    return 'Ledger Entries Report';
  }

  getPrimaryEntity(): string {
    return 'LedgerEntry';
  }

  getRelatedEntities(): string[] {
    return ['FinancialEvent'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: TransactionReportFieldEnum.ENTRY_ID,
        label: 'Entry ID',
        field: 'id',
        type: 'string',
        category: 'Ledger Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { id: true },
      },
      {
        key: TransactionReportFieldEnum.EVENT_ID,
        label: 'Event ID',
        field: 'eventId',
        type: 'string',
        category: 'Event Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { eventId: true },
      },
      {
        key: TransactionReportFieldEnum.EVENT_TYPE,
        label: 'Event Type',
        field: 'eventType',
        type: 'string',
        category: 'Event Info',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: { event: { select: { type: true } } },
      },
      {
        key: TransactionReportFieldEnum.ACTOR_TYPE,
        label: 'Actor Type',
        field: 'actorType',
        type: 'string',
        category: 'Actor Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { actorType: true },
      },
      {
        key: TransactionReportFieldEnum.ACTOR_ID,
        label: 'Actor ID',
        field: 'actorId',
        type: 'string',
        category: 'Actor Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { actorId: true },
      },
      {
        key: TransactionReportFieldEnum.DIRECTION,
        label: 'Direction',
        field: 'direction',
        type: 'string',
        category: 'Ledger Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { direction: true },
      },
      {
        key: TransactionReportFieldEnum.AMOUNT,
        label: 'Amount',
        field: 'amount',
        type: 'currency',
        category: 'Ledger Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { amount: true },
      },
      {
        key: TransactionReportFieldEnum.STATUS,
        label: 'Status',
        field: 'status',
        type: 'string',
        category: 'Ledger Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: TransactionReportFieldEnum.RAZORPAY_ORDER_ID,
        label: 'Razorpay Order ID',
        field: 'razorpayOrderId',
        type: 'string',
        category: 'Payment Info',
        default: false,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: { event: { select: { razorpayOrderId: true } } },
      },
      {
        key: TransactionReportFieldEnum.RAZORPAY_PAYMENT_ID,
        label: 'Razorpay Payment ID',
        field: 'razorpayPaymentId',
        type: 'string',
        category: 'Payment Info',
        default: false,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: { event: { select: { razorpayPaymentId: true } } },
      },
      {
        key: TransactionReportFieldEnum.GATEWAY_STATUS,
        label: 'Gateway Status',
        field: 'gatewayStatus',
        type: 'string',
        category: 'Payment Info',
        default: false,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: { event: { select: { gatewayStatus: true } } },
      },
      {
        key: TransactionReportFieldEnum.CREATED_AT,
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Ledger Info',
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
        label: 'Actor / Direction Filter',
        type: 'select',
        options: [
          { label: 'Direction: CREDIT', value: 'CREDIT' },
          { label: 'Direction: DEBIT', value: 'DEBIT' },
          { label: 'Actor: FRANCHISE', value: 'FRANCHISE' },
          { label: 'Actor: CUSTOMER', value: 'CUSTOMER' },
          { label: 'Actor: PLATFORM', value: 'PLATFORM' },
        ],
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const userFranchiseId = resolveUserFranchiseId(user);
    const clauses: any[] = [];

    // Franchise scoping: limit entries to FRANCHISE actor type matching user franchise ID
    if (
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF
    ) {
      if (userFranchiseId) {
        clauses.push({ actorType: 'FRANCHISE', actorId: userFranchiseId });
      }
    }

    // Status filter (direction or actorType or status fallback)
    if (query.status) {
      if (query.status === 'CREDIT' || query.status === 'DEBIT') {
        clauses.push({ direction: query.status });
      } else if (
        query.status === 'FRANCHISE' ||
        query.status === 'CUSTOMER' ||
        query.status === 'PLATFORM'
      ) {
        clauses.push({ actorType: query.status });
      } else {
        clauses.push({ status: query.status });
      }
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
          { id: { contains: search, mode: 'insensitive' } },
          { eventId: { contains: search, mode: 'insensitive' } },
          { actorId: { contains: search, mode: 'insensitive' } },
          { event: { type: { contains: search, mode: 'insensitive' } } },
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
      include: {
        event: {
          select: {
            type: true,
            razorpayOrderId: true,
            razorpayPaymentId: true,
            gatewayStatus: true,
          },
        },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const [aggregates, creditSumAgg, debitSumAgg] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where,
        _count: { _all: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          ...where,
          direction: 'CREDIT',
        },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          ...where,
          direction: 'DEBIT',
        },
        _sum: { amount: true },
      }),
    ]);

    const totalCount = aggregates._count._all;
    const creditSum = Number(creditSumAgg._sum.amount ?? 0);
    const debitSum = Number(debitSumAgg._sum.amount ?? 0);
    const netSum = creditSum - debitSum;

    return {
      totalEntries: {
        label: 'Total Ledger Entries',
        value: totalCount,
        type: 'number',
      },
      totalCredits: {
        label: 'Total Credits (+)',
        value: creditSum.toFixed(2),
        type: 'currency',
      },
      totalDebits: {
        label: 'Total Debits (-)',
        value: debitSum.toFixed(2),
        type: 'currency',
      },
      netFlow: {
        label: 'Net Ledger Flow',
        value: netSum.toFixed(2),
        type: 'currency',
        description: 'Credits minus Debits',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      eventType: r.event?.type ?? 'N/A',
      actorType: r.actorType,
      actorId: r.actorId ?? 'N/A',
      direction: r.direction,
      amount: Number(r.amount || 0).toFixed(2),
      status: r.status,
      razorpayOrderId: r.event?.razorpayOrderId ?? 'N/A',
      razorpayPaymentId: r.event?.razorpayPaymentId ?? 'N/A',
      gatewayStatus: r.event?.gatewayStatus ?? 'N/A',
      createdAt: r.createdAt,
    }));
  }
}
