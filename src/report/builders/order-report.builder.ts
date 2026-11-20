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
import { OrderStatus, Role } from '@prisma/client';
import { OrderReportFieldEnum } from '../enums/order-report-field.enum';

@Injectable()
export class OrderReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'orders';
  }

  getTitle(): string {
    return 'Orders Report';
  }

  getPrimaryEntity(): string {
    return 'Order';
  }

  getRelatedEntities(): string[] {
    return ['Customer', 'OrderItem', 'Invoice', 'Franchise'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: OrderReportFieldEnum.ORDER_NUMBER,
        label: 'Order Number',
        field: 'orderNumber',
        type: 'string',
        category: 'Order Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { orderNumber: true },
      },
      {
        key: OrderReportFieldEnum.STATUS,
        label: 'Order Status',
        field: 'status',
        type: 'status',
        category: 'Order Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: OrderReportFieldEnum.CHANNEL,
        label: 'Channel',
        field: 'channel',
        type: 'string',
        category: 'Order Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { channel: true },
      },
      {
        key: OrderReportFieldEnum.TOTAL_AMOUNT,
        label: 'Total Amount',
        field: 'totalAmount',
        type: 'currency',
        category: 'Order Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { total: true },
      },
      {
        key: OrderReportFieldEnum.ITEMS_COUNT,
        label: 'Items Count',
        field: 'itemsCount',
        type: 'number',
        category: 'Order Details',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: { _count: { select: { items: true } } },
      },
      {
        key: OrderReportFieldEnum.CREATED_AT,
        label: 'Created Date',
        field: 'createdAt',
        type: 'date',
        category: 'Order Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { createdAt: true },
      },
      {
        key: OrderReportFieldEnum.CUSTOMER_NAME,
        label: 'Customer Name',
        field: 'customerName',
        type: 'string',
        category: 'Customer Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { customer: { select: { name: true } } },
      },
      {
        key: OrderReportFieldEnum.CUSTOMER_PHONE,
        label: 'Customer Phone',
        field: 'customerPhone',
        type: 'string',
        category: 'Customer Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { customer: { select: { phone: true } } },
      },
      {
        key: OrderReportFieldEnum.CUSTOMER_EMAIL,
        label: 'Customer Email',
        field: 'customerEmail',
        type: 'string',
        category: 'Customer Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: {
          customer: { select: { user: { select: { email: true } } } },
        },
      },
      {
        key: OrderReportFieldEnum.FRANCHISE_NAME,
        label: 'Franchise Name',
        field: 'franchiseName',
        type: 'string',
        category: 'Franchise Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { franchise: { select: { name: true } } },
      },
      {
        key: OrderReportFieldEnum.FRANCHISE_CODE,
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
        key: OrderReportFieldEnum.PAYMENT_MODE,
        label: 'Payment Mode',
        field: 'paymentMode',
        type: 'string',
        category: 'Payment Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { paymentMode: true },
      },
      {
        key: OrderReportFieldEnum.PAYMENT_STATUS,
        label: 'Payment Status',
        field: 'paymentStatus',
        type: 'status',
        category: 'Payment Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { onlinePaymentStatus: true },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: Object.values(OrderStatus).map((status) => ({
          label: status,
          value: status,
        })),
      },
      {
        name: 'channel',
        label: 'Channel',
        type: 'select',
        options: [
          { label: 'Online', value: 'ONLINE' },
          { label: 'POS', value: 'POS' },
        ],
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const userFranchiseId = resolveUserFranchiseId(user);
    const clauses: any[] = [];

    // Franchise scoping
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
      clauses.push({ status: query.status as OrderStatus });
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
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
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
        customer: {
          select: {
            name: true,
            phone: true,
            user: { select: { email: true } },
          },
        },
        franchise: { select: { name: true, code: true } },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const [counts, revenueAgg] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          ...where,
          status: { not: OrderStatus.CANCELLED },
        },
        _sum: { total: true },
      }),
    ]);

    const totalOrders = counts.reduce((acc, c) => acc + c._count._all, 0);
    const pendingOrders =
      counts.find((c) => c.status === OrderStatus.PENDING)?._count._all ?? 0;
    const deliveredOrders =
      counts.find((c) => c.status === OrderStatus.DELIVERED)?._count._all ?? 0;
    const cancelledOrders =
      counts.find((c) => c.status === OrderStatus.CANCELLED)?._count._all ?? 0;
    const revenue = Number(revenueAgg._sum.total ?? 0);

    return {
      totalOrders: {
        label: 'Total Orders',
        value: totalOrders,
        type: 'number',
      },
      pendingOrders: {
        label: 'Pending Orders',
        value: pendingOrders,
        type: 'number',
        description: 'Orders awaiting completion',
      },
      deliveredOrders: {
        label: 'Delivered Orders',
        value: deliveredOrders,
        type: 'number',
        description: 'Successfully completed orders',
      },
      cancelledOrders: {
        label: 'Cancelled Orders',
        value: cancelledOrders,
        type: 'number',
      },
      revenue: {
        label: 'Revenue',
        value: revenue.toFixed(2),
        type: 'currency',
        description: 'Total revenue (excludes cancelled)',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      orderNumber: r.orderNumber,
      customerName: r.customer?.name ?? 'N/A',
      customerPhone: r.customer?.phone ?? 'N/A',
      customerEmail: r.customer?.user?.email ?? 'N/A',
      franchiseName: r.franchise?.name ?? 'N/A',
      franchiseCode: r.franchise?.code ?? 'N/A',
      status: r.status,
      channel: r.channel,
      paymentMode: r.paymentMode,
      paymentStatus: r.onlinePaymentStatus ?? 'UNPAID',
      totalAmount: Number(r.total || 0).toFixed(2),
      itemsCount: r._count?.items ?? 0,
      createdAt: r.createdAt,
    }));
  }
}
