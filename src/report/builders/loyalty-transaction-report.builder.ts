import { Injectable } from '@nestjs/common';
import { BaseReportBuilder } from './base-report.builder';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  ReportFilter,
  ReportSummaryCard,
  ReportFieldRegistryItem,
} from '../interfaces/report.interface';
import { LoyaltyTransactionType } from '@prisma/client';

@Injectable()
export class LoyaltyTransactionReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'loyalty_transactions';
  }

  getTitle(): string {
    return 'Loyalty Transactions Report';
  }

  getPrimaryEntity(): string {
    return 'LoyaltyTransaction';
  }

  getRelatedEntities(): string[] {
    return ['Customer', 'User'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: 'ID',
        label: 'Transaction ID',
        field: 'id',
        type: 'string',
        category: 'Transaction',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { id: true },
      },
      {
        key: 'CUSTOMER_ID',
        label: 'Customer ID',
        field: 'customerId',
        type: 'string',
        category: 'Customer',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { customerId: true },
      },
      {
        key: 'CUSTOMER_NAME',
        label: 'Customer Name',
        field: 'customerName',
        type: 'string',
        category: 'Customer',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: { customer: { select: { name: true } } },
      },
      {
        key: 'CUSTOMER_EMAIL',
        label: 'Customer Email',
        field: 'customerEmail',
        type: 'string',
        category: 'Customer',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: {
          customer: { select: { user: { select: { email: true } } } },
        },
      },
      {
        key: 'POINTS',
        label: 'Points Changed',
        field: 'points',
        type: 'number',
        category: 'Transaction',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { points: true },
      },
      {
        key: 'TYPE',
        label: 'Transaction Type',
        field: 'type',
        type: 'string',
        category: 'Transaction',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { type: true },
      },
      {
        key: 'DESCRIPTION',
        label: 'Description',
        field: 'description',
        type: 'string',
        category: 'Transaction',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
        dbSelect: { description: true },
      },
      {
        key: 'REFERENCE_ID',
        label: 'Reference ID',
        field: 'referenceId',
        type: 'string',
        category: 'Transaction',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { referenceId: true },
      },
      {
        key: 'CREATED_AT',
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Transaction',
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
        name: 'type',
        label: 'Transaction Type',
        type: 'select',
        options: Object.values(LoyaltyTransactionType).map((t) => ({
          label: t,
          value: t,
        })),
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const clauses: any[] = [];

    if (query.type) {
      clauses.push({ type: query.type as LoyaltyTransactionType });
    }

    const dateRange = this.buildDateRangeFilter(
      query.fromDate,
      query.toDate ?? query.lastDate,
    );
    if (dateRange) {
      clauses.push({ createdAt: dateRange });
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      clauses.push({
        OR: [
          { customerId: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { referenceId: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          {
            customer: {
              user: { email: { contains: search, mode: 'insensitive' } },
            },
          },
        ],
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || query.order || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    return {
      where,
      orderBy,
      include: {
        customer: {
          select: {
            name: true,
            user: { select: { email: true } },
          },
        },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const [agg, typeBreakdown] = await Promise.all([
      prisma.loyaltyTransaction.aggregate({
        where,
        _sum: {
          points: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.loyaltyTransaction.groupBy({
        by: ['type'],
        where,
        _sum: {
          points: true,
        },
      }),
    ]);

    const earnedPoints = typeBreakdown
      .filter((tb) => tb.type && tb._sum.points && tb._sum.points > 0)
      .reduce((sum, tb) => sum + (tb._sum.points ?? 0), 0);

    const redeemedPoints = Math.abs(
      typeBreakdown
        .filter((tb) => tb.type && tb._sum.points && tb._sum.points < 0)
        .reduce((sum, tb) => sum + (tb._sum.points ?? 0), 0),
    );

    return {
      totalTransactions: {
        label: 'Total Transactions',
        value: agg._count.id,
        type: 'number',
      },
      netPoints: {
        label: 'Net Points Change',
        value: agg._sum.points ?? 0,
        type: 'number',
      },
      earnedPoints: {
        label: 'Total Points Earned',
        value: earnedPoints,
        type: 'number',
      },
      redeemedPoints: {
        label: 'Total Points Redeemed',
        value: redeemedPoints,
        type: 'number',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerName: r.customer?.name ?? 'N/A',
      customerEmail: r.customer?.user?.email ?? 'N/A',
      points: r.points,
      type: r.type,
      description: r.description,
      referenceId: r.referenceId ?? 'N/A',
      createdAt: r.createdAt,
    }));
  }
}
