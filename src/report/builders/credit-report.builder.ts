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
import { CreditAccountStatus, Role } from '@prisma/client';
import { CreditReportFieldEnum } from '../enums/credit-report-field.enum';

@Injectable()
export class CreditReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'credits';
  }

  getTitle(): string {
    return 'Credits Report';
  }

  getPrimaryEntity(): string {
    return 'CreditAccount';
  }

  getRelatedEntities(): string[] {
    return ['Franchise', 'CreditTransaction'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: CreditReportFieldEnum.FRANCHISE_NAME,
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
        key: CreditReportFieldEnum.FRANCHISE_CODE,
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
      {
        key: CreditReportFieldEnum.TOTAL_CREDIT,
        label: 'Total Credit',
        field: 'totalCredit',
        type: 'currency',
        category: 'Credit Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { totalCredit: true },
      },
      {
        key: CreditReportFieldEnum.USED_CREDIT,
        label: 'Used Credit',
        field: 'usedCredit',
        type: 'currency',
        category: 'Credit Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { usedCredit: true },
      },
      {
        key: CreditReportFieldEnum.AVAILABLE_CREDIT,
        label: 'Available Credit',
        field: 'availableCredit',
        type: 'currency',
        category: 'Credit Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { availableCredit: true },
      },
      {
        key: CreditReportFieldEnum.ADVANCE_BALANCE,
        label: 'Advance Balance',
        field: 'advanceBalance',
        type: 'currency',
        category: 'Credit Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { advanceBalance: true },
      },
      {
        key: CreditReportFieldEnum.WALLET_BALANCE,
        label: 'Wallet Balance',
        field: 'walletBalance',
        type: 'currency',
        category: 'Credit Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { walletBalance: true },
      },
      {
        key: CreditReportFieldEnum.STATUS,
        label: 'Status',
        field: 'status',
        type: 'status',
        category: 'Credit Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: CreditReportFieldEnum.CREATED_AT,
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Credit Details',
        default: false,
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
        label: 'Status',
        type: 'select',
        options: Object.values(CreditAccountStatus).map((status) => ({
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
      clauses.push({ status: query.status as CreditAccountStatus });
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
          { franchise: { name: { contains: search, mode: 'insensitive' } } },
          { franchise: { code: { contains: search, mode: 'insensitive' } } },
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
    const [aggregates, activeCount] = await Promise.all([
      prisma.creditAccount.aggregate({
        where,
        _sum: {
          totalCredit: true,
          usedCredit: true,
          availableCredit: true,
        },
      }),
      prisma.creditAccount.count({
        where: {
          ...where,
          status: CreditAccountStatus.ACTIVE,
        },
      }),
    ]);

    const totalCredit = Number(aggregates._sum.totalCredit ?? 0);
    const usedCredit = Number(aggregates._sum.usedCredit ?? 0);
    const availableCredit = Number(aggregates._sum.availableCredit ?? 0);

    return {
      totalCreditLimit: {
        label: 'Total Credit Limit',
        value: totalCredit.toFixed(2),
        type: 'currency',
        description: 'Sum of all credit limits',
      },
      totalUsedCredit: {
        label: 'Total Used Credit',
        value: usedCredit.toFixed(2),
        type: 'currency',
        description: 'Sum of all used credits',
      },
      totalAvailableCredit: {
        label: 'Available Credit',
        value: availableCredit.toFixed(2),
        type: 'currency',
      },
      activeAccounts: {
        label: 'Active Credit Accounts',
        value: activeCount,
        type: 'number',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      franchiseName: r.franchise?.name ?? 'N/A',
      franchiseCode: r.franchise?.code ?? 'N/A',
      totalCredit: Number(r.totalCredit || 0).toFixed(2),
      usedCredit: Number(r.usedCredit || 0).toFixed(2),
      availableCredit: Number(r.availableCredit || 0).toFixed(2),
      advanceBalance: Number(r.advanceBalance || 0).toFixed(2),
      walletBalance: Number(r.walletBalance || 0).toFixed(2),
      status: r.status,
      createdAt: r.createdAt,
    }));
  }
}
