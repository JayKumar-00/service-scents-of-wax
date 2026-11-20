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
import { ReferralStatus } from '@prisma/client';

@Injectable()
export class ReferralReportBuilder extends BaseReportBuilder {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  getModuleName(): string {
    return 'referrals';
  }

  getTitle(): string {
    return 'Referral Invites Report';
  }

  getPrimaryEntity(): string {
    return 'Referral';
  }

  getRelatedEntities(): string[] {
    return ['Customer', 'User'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: 'ID',
        label: 'Referral ID',
        field: 'id',
        type: 'string',
        category: 'Referral Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { id: true },
      },
      {
        key: 'REFERRER_ID',
        label: 'Referrer ID',
        field: 'referrerId',
        type: 'string',
        category: 'Referrer Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { referrerId: true },
      },
      {
        key: 'REFERRER_NAME',
        label: 'Referrer Name',
        field: 'referrerName',
        type: 'string',
        category: 'Referrer Info',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
      },
      {
        key: 'REFERRER_EMAIL',
        label: 'Referrer Email',
        field: 'referrerEmail',
        type: 'string',
        category: 'Referrer Info',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
      },
      {
        key: 'REFEREE_ID',
        label: 'Referee ID / Email',
        field: 'refereeId',
        type: 'string',
        category: 'Referee Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { refereeId: true },
      },
      {
        key: 'REFEREE_NAME',
        label: 'Referee Name',
        field: 'refereeName',
        type: 'string',
        category: 'Referee Info',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
      },
      {
        key: 'REFEREE_EMAIL',
        label: 'Referee Email',
        field: 'refereeEmail',
        type: 'string',
        category: 'Referee Info',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
      },
      {
        key: 'STATUS',
        label: 'Status',
        field: 'status',
        type: 'string',
        category: 'Referral Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: 'ORDER_ID',
        label: 'Completed Order ID',
        field: 'orderId',
        type: 'string',
        category: 'Referral Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { orderId: true },
      },
      {
        key: 'POINTS_AWARDED',
        label: 'Points Awarded',
        field: 'pointsAwarded',
        type: 'string',
        category: 'Referral Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { pointsAwarded: true },
      },
      {
        key: 'CREATED_AT',
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Dates',
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
        label: 'Referral Status',
        type: 'select',
        options: Object.values(ReferralStatus).map((s) => ({
          label: s,
          value: s,
        })),
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const clauses: any[] = [];

    if (query.status) {
      clauses.push({ status: query.status as ReferralStatus });
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
          { referrerId: { contains: search, mode: 'insensitive' } },
          { refereeId: { contains: search, mode: 'insensitive' } },
          { orderId: { contains: search, mode: 'insensitive' } },
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
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const counts = await prisma.referral.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const total = counts.reduce((sum, c) => sum + c._count.id, 0);
    const completed =
      counts.find((c) => c.status === ReferralStatus.COMPLETED)?._count.id ?? 0;
    const pending =
      counts.find((c) => c.status === ReferralStatus.PENDING)?._count.id ?? 0;

    return {
      totalReferrals: {
        label: 'Total Referrals',
        value: total,
        type: 'number',
      },
      completedReferrals: {
        label: 'Completed Referrals',
        value: completed,
        type: 'number',
      },
      pendingReferrals: {
        label: 'Pending Referrals',
        value: pending,
        type: 'number',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    const referrerIds = [...new Set(records.map((r) => r.referrerId))].filter(
      Boolean,
    );
    const refereeIds = [...new Set(records.map((r) => r.refereeId))].filter(
      (id) => id.includes('cmp'),
    );

    const [referrers, referees] = await Promise.all([
      this.prisma.customer.findMany({
        where: { id: { in: referrerIds } },
        select: {
          id: true,
          name: true,
          user: { select: { email: true } },
        },
      }),
      this.prisma.customer.findMany({
        where: { id: { in: refereeIds } },
        select: {
          id: true,
          name: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    const referrerMap = new Map(referrers.map((c) => [c.id, c]));
    const refereeMap = new Map(referees.map((c) => [c.id, c]));

    return records.map((r) => {
      const referrer = referrerMap.get(r.referrerId);
      const referee = refereeMap.get(r.refereeId);

      return {
        id: r.id,
        referrerId: r.referrerId,
        referrerName: referrer?.name ?? 'N/A',
        referrerEmail: referrer?.user?.email ?? 'N/A',
        refereeId: r.refereeId,
        refereeName: referee?.name ?? 'N/A',
        refereeEmail:
          referee?.user?.email ??
          (r.refereeId.includes('@') ? r.refereeId : 'N/A'),
        status: r.status,
        orderId: r.orderId ?? 'N/A',
        pointsAwarded: r.pointsAwarded ? 'Yes' : 'No',
        createdAt: r.createdAt,
      };
    });
  }
}
