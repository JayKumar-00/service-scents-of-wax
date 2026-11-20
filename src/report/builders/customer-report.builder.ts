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
import { CustomerStatus } from '@prisma/client';
import { CustomerReportFieldEnum } from '../enums/customer-report-field.enum';

@Injectable()
export class CustomerReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'customers';
  }

  getTitle(): string {
    return 'Customers Report';
  }

  getPrimaryEntity(): string {
    return 'Customer';
  }

  getRelatedEntities(): string[] {
    return ['User', 'Order'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: CustomerReportFieldEnum.NAME,
        label: 'Name',
        field: 'name',
        type: 'string',
        category: 'Profile Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { name: true },
      },
      {
        key: CustomerReportFieldEnum.PHONE,
        label: 'Phone',
        field: 'phone',
        type: 'string',
        category: 'Profile Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { phone: true },
      },
      {
        key: CustomerReportFieldEnum.EMAIL,
        label: 'Email',
        field: 'email',
        type: 'string',
        category: 'Profile Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { user: { select: { email: true } } },
      },
      {
        key: CustomerReportFieldEnum.GENDER,
        label: 'Gender',
        field: 'gender',
        type: 'string',
        category: 'Profile Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { gender: true },
      },
      {
        key: CustomerReportFieldEnum.STATUS,
        label: 'Status',
        field: 'status',
        type: 'status',
        category: 'Profile Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: CustomerReportFieldEnum.CREATED_AT,
        label: 'Registered On',
        field: 'createdAt',
        type: 'date',
        category: 'Profile Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { createdAt: true },
      },
      {
        key: CustomerReportFieldEnum.TOTAL_ORDERS,
        label: 'Total Orders',
        field: 'totalOrders',
        type: 'number',
        category: 'Activity',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { _count: { select: { orders: true } } },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: Object.values(CustomerStatus).map((status) => ({
          label: status,
          value: status,
        })),
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const clauses: any[] = [];

    // Filter by status
    if (query.status) {
      clauses.push({ status: query.status as CustomerStatus });
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
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
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
        user: { select: { email: true } },
        _count: { select: { orders: true } },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [counts, newCustomers] = await Promise.all([
      prisma.customer.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.customer.count({
        where: {
          ...where,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const totalCustomers = counts.reduce((acc, c) => acc + c._count._all, 0);
    const activeCustomers =
      counts.find((c) => c.status === CustomerStatus.ACTIVE)?._count._all ?? 0;

    return {
      totalCustomers: {
        label: 'Total Customers',
        value: totalCustomers,
        type: 'number',
      },
      activeCustomers: {
        label: 'Active Customers',
        value: activeCustomers,
        type: 'number',
      },
      newCustomers: {
        label: 'New Customers',
        value: newCustomers,
        type: 'number',
        description: 'Registered in last 30 days',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      name: r.name ?? 'N/A',
      phone: r.phone ?? 'N/A',
      email: r.user?.email ?? 'N/A',
      gender: r.gender ?? 'NOT_SPECIFIED',
      status: r.status,
      totalOrders: r._count?.orders ?? 0,
      createdAt: r.createdAt,
    }));
  }
}
