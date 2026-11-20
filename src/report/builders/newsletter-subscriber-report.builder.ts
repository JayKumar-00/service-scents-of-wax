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
import { NewsletterSource, NewsletterStatus } from '@prisma/client';

@Injectable()
export class NewsletterSubscriberReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'newsletter_subscribers';
  }

  getTitle(): string {
    return 'Newsletter Subscribers Report';
  }

  getPrimaryEntity(): string {
    return 'NewsletterSubscriber';
  }

  getRelatedEntities(): string[] {
    return ['Customer'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: 'ID',
        label: 'Subscriber ID',
        field: 'id',
        type: 'string',
        category: 'Subscriber Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { id: true },
      },
      {
        key: 'EMAIL',
        label: 'Email Address',
        field: 'email',
        type: 'string',
        category: 'Subscriber Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { email: true },
      },
      {
        key: 'CUSTOMER_ID',
        label: 'Customer ID',
        field: 'customerId',
        type: 'string',
        category: 'Customer Link',
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
        category: 'Customer Link',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: { customer: { select: { name: true } } },
      },
      {
        key: 'SOURCE',
        label: 'Signup Source',
        field: 'source',
        type: 'string',
        category: 'Subscriber Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { source: true },
      },
      {
        key: 'STATUS',
        label: 'Status',
        field: 'status',
        type: 'string',
        category: 'Subscriber Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: 'SUBSCRIBED_AT',
        label: 'Subscribed At',
        field: 'subscribedAt',
        type: 'date',
        category: 'Subscriber Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { subscribedAt: true },
      },
      {
        key: 'UNSUBSCRIBED_AT',
        label: 'Unsubscribed At',
        field: 'unsubscribedAt',
        type: 'date',
        category: 'Subscriber Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { unsubscribedAt: true },
      },
      {
        key: 'CREATED_AT',
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Subscriber Info',
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
        options: Object.values(NewsletterStatus).map((s) => ({
          label: s,
          value: s,
        })),
      },
      {
        name: 'source',
        label: 'Signup Source',
        type: 'select',
        options: Object.values(NewsletterSource).map((s) => ({
          label: s,
          value: s,
        })),
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const clauses: any[] = [];

    if (query.status) {
      clauses.push({ status: query.status as NewsletterStatus });
    }

    if (query.source) {
      clauses.push({ source: query.source as NewsletterSource });
    }

    const dateRange = this.buildDateRangeFilter(
      query.fromDate,
      query.toDate ?? query.lastDate,
    );
    if (dateRange) {
      clauses.push({ subscribedAt: dateRange });
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      clauses.push({
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { customerId: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const sortBy = query.sortBy || 'subscribedAt';
    const sortOrder = query.sortOrder || query.order || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    return {
      where,
      orderBy,
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const counts = await prisma.newsletterSubscriber.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const total = counts.reduce((sum, c) => sum + c._count.id, 0);
    const active =
      counts.find((c) => c.status === NewsletterStatus.SUBSCRIBED)?._count.id ??
      0;
    const inactive =
      counts.find((c) => c.status === NewsletterStatus.UNSUBSCRIBED)?._count
        .id ?? 0;

    return {
      totalSubscribers: {
        label: 'Total Subscribers',
        value: total,
        type: 'number',
      },
      activeSubscribers: {
        label: 'Active Subscribers',
        value: active,
        type: 'number',
      },
      unsubscribedCount: {
        label: 'Unsubscribed Users',
        value: inactive,
        type: 'number',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      id: r.id,
      email: r.email,
      customerId: r.customerId ?? 'N/A',
      customerName: r.customer?.name ?? 'N/A',
      source: r.source,
      status: r.status,
      subscribedAt: r.subscribedAt,
      unsubscribedAt: r.unsubscribedAt,
      createdAt: r.createdAt,
    }));
  }
}
