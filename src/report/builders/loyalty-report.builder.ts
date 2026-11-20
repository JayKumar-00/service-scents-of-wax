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
import { CustomerLifecycleStage, LoyaltyTier } from '@prisma/client';

@Injectable()
export class LoyaltyReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'loyalty';
  }

  getTitle(): string {
    return 'Loyalty & Retention Report';
  }

  getPrimaryEntity(): string {
    return 'RetentionSnapshot';
  }

  getRelatedEntities(): string[] {
    return ['Customer', 'User'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
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
        key: 'STAGE',
        label: 'Lifecycle Stage',
        field: 'stage',
        type: 'string',
        category: 'Loyalty Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { stage: true },
      },
      {
        key: 'TIER',
        label: 'Loyalty Tier',
        field: 'tier',
        type: 'string',
        category: 'Loyalty Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { tier: true },
      },
      {
        key: 'TOTAL_ORDERS',
        label: 'Total Orders',
        field: 'totalOrders',
        type: 'number',
        category: 'Metrics',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { totalOrders: true },
      },
      {
        key: 'TOTAL_SPEND',
        label: 'Total Spend',
        field: 'totalSpend',
        type: 'number',
        category: 'Metrics',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { totalSpend: true },
      },
      {
        key: 'LOYALTY_POINTS',
        label: 'Loyalty Points',
        field: 'loyaltyPoints',
        type: 'number',
        category: 'Metrics',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { loyaltyPoints: true },
      },
      {
        key: 'REFERRAL_CODE',
        label: 'Referral Code',
        field: 'referralCode',
        type: 'string',
        category: 'Loyalty Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { referralCode: true },
      },
      {
        key: 'FIRST_ORDER_AT',
        label: 'First Order At',
        field: 'firstOrderAt',
        type: 'date',
        category: 'Dates',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { firstOrderAt: true },
      },
      {
        key: 'LAST_ORDER_AT',
        label: 'Last Order At',
        field: 'lastOrderAt',
        type: 'date',
        category: 'Dates',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { lastOrderAt: true },
      },
      {
        key: 'DAYS_SINCE_LAST_ORDER',
        label: 'Days Since Last Order',
        field: 'daysSinceLastOrder',
        type: 'number',
        category: 'Metrics',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { daysSinceLastOrder: true },
      },
      {
        key: 'ENGAGEMENT_COUNT',
        label: 'Engagement Count',
        field: 'engagementCount',
        type: 'number',
        category: 'Metrics',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { engagementCount: true },
      },
      {
        key: 'CREATED_AT',
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Dates',
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
        name: 'stage',
        label: 'Lifecycle Stage',
        type: 'select',
        options: Object.values(CustomerLifecycleStage).map((s) => ({
          label: s,
          value: s,
        })),
      },
      {
        name: 'tier',
        label: 'Loyalty Tier',
        type: 'select',
        options: Object.values(LoyaltyTier).map((t) => ({
          label: t,
          value: t,
        })),
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const clauses: any[] = [];

    if (query.stage) {
      clauses.push({ stage: query.stage as CustomerLifecycleStage });
    }

    if (query.tier) {
      clauses.push({ tier: query.tier as LoyaltyTier });
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
          { referralCode: { contains: search, mode: 'insensitive' } },
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
    const agg = await prisma.retentionSnapshot.aggregate({
      where,
      _sum: {
        loyaltyPoints: true,
        totalSpend: true,
      },
      _count: {
        customerId: true,
      },
    });

    return {
      totalCustomers: {
        label: 'Total Loyalty Users',
        value: agg._count.customerId,
        type: 'number',
      },
      totalPoints: {
        label: 'Total Loyalty Points',
        value: agg._sum.loyaltyPoints ?? 0,
        type: 'number',
      },
      totalSpend: {
        label: 'Total Loyalty Spend',
        value: Number(agg._sum.totalSpend ?? 0).toFixed(2),
        type: 'currency',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      customerId: r.customerId,
      customerName: r.customer?.name ?? 'N/A',
      customerEmail: r.customer?.user?.email ?? 'N/A',
      stage: r.stage,
      tier: r.tier,
      totalOrders: r.totalOrders,
      totalSpend: Number(r.totalSpend ?? 0),
      loyaltyPoints: r.loyaltyPoints,
      referralCode: r.referralCode ?? 'N/A',
      firstOrderAt: r.firstOrderAt,
      lastOrderAt: r.lastOrderAt,
      daysSinceLastOrder: r.daysSinceLastOrder,
      engagementCount: r.engagementCount,
      createdAt: r.createdAt,
    }));
  }
}
