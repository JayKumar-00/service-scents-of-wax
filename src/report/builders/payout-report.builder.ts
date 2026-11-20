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
import { PayoutStatus, Role } from '@prisma/client';
import { PayoutReportFieldEnum } from '../enums/payout-report-field.enum';

@Injectable()
export class PayoutReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'payouts';
  }

  getTitle(): string {
    return 'Payouts Report';
  }

  getPrimaryEntity(): string {
    return 'Payout';
  }

  getRelatedEntities(): string[] {
    return ['Franchise', 'CreditAccount'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: PayoutReportFieldEnum.PAYOUT_CODE,
        label: 'Payout Code',
        field: 'payoutCode',
        type: 'string',
        category: 'Payout Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { payoutCode: true },
      },
      {
        key: PayoutReportFieldEnum.AMOUNT,
        label: 'Amount',
        field: 'amount',
        type: 'currency',
        category: 'Payout Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { amount: true },
      },
      {
        key: PayoutReportFieldEnum.STATUS,
        label: 'Status',
        field: 'status',
        type: 'status',
        category: 'Payout Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: PayoutReportFieldEnum.REFERENCE_ID,
        label: 'Reference ID',
        field: 'referenceId',
        type: 'string',
        category: 'Payout Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { referenceId: true },
      },
      {
        key: PayoutReportFieldEnum.PROCESSED_AT,
        label: 'Processed At',
        field: 'processedAt',
        type: 'date',
        category: 'Payout Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { processedAt: true },
      },
      {
        key: PayoutReportFieldEnum.CREATED_AT,
        label: 'Requested At',
        field: 'createdAt',
        type: 'date',
        category: 'Payout Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { createdAt: true },
      },
      {
        key: PayoutReportFieldEnum.FRANCHISE_NAME,
        label: 'Franchise Name',
        field: 'franchiseName',
        type: 'string',
        category: 'Franchise Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { franchise: { select: { name: true } } },
      },
      {
        key: PayoutReportFieldEnum.FRANCHISE_CODE,
        label: 'Franchise Code',
        field: 'franchiseCode',
        type: 'string',
        category: 'Franchise Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { franchise: { select: { code: true } } },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: Object.values(PayoutStatus).map((status) => ({
          label: status,
          value: status,
        })),
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const userFranchiseId = resolveUserFranchiseId(user);
    const clauses: any[] = [];

    // Franchise scoping (only for franchise owner or franchise staff)
    if (
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF
    ) {
      if (userFranchiseId) {
        clauses.push({ franchiseId: userFranchiseId });
      }
    }

    // Status filter
    if (query.status) {
      clauses.push({ status: query.status as PayoutStatus });
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
          { payoutCode: { contains: search, mode: 'insensitive' } },
          { referenceId: { contains: search, mode: 'insensitive' } },
          { franchise: { name: { contains: search, mode: 'insensitive' } } },
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
        franchise: { select: { name: true, code: true } },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const [counts, processedAgg, pendingAgg] = await Promise.all([
      prisma.payout.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.payout.aggregate({
        where: {
          ...where,
          status: PayoutStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: {
          ...where,
          status: PayoutStatus.PENDING,
        },
        _sum: { amount: true },
      }),
    ]);

    const totalPayouts = counts.reduce((acc, c) => acc + c._count._all, 0);
    const processedAmount = Number(processedAgg._sum.amount ?? 0);
    const pendingAmount = Number(pendingAgg._sum.amount ?? 0);

    return {
      totalPayouts: {
        label: 'Total Payouts',
        value: totalPayouts,
        type: 'number',
      },
      processedAmount: {
        label: 'Processed Amount',
        value: processedAmount.toFixed(2),
        type: 'currency',
        description: 'Sum of completed payouts',
      },
      pendingAmount: {
        label: 'Pending Amount',
        value: pendingAmount.toFixed(2),
        type: 'currency',
        description: 'Sum of payouts awaiting approval',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      payoutCode: r.payoutCode ?? 'N/A',
      franchiseName: r.franchise?.name ?? 'N/A',
      franchiseCode: r.franchise?.code ?? 'N/A',
      amount: Number(r.amount || 0).toFixed(2),
      status: r.status,
      referenceId: r.referenceId ?? 'N/A',
      processedAt: r.processedAt,
      createdAt: r.createdAt,
    }));
  }
}
