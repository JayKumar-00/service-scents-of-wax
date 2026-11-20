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
import { OrderSettlementStatus, SettlementType, Role } from '@prisma/client';
import { SettlementReportFieldEnum } from '../enums/settlement-report-field.enum';

@Injectable()
export class SettlementReportBuilder extends BaseReportBuilder {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  getModuleName(): string {
    return 'settlements';
  }

  getTitle(): string {
    return 'Order Settlements Report';
  }

  getPrimaryEntity(): string {
    return 'OrderSettlement';
  }

  getRelatedEntities(): string[] {
    return ['Order', 'Franchise', 'Customer'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: SettlementReportFieldEnum.ID,
        label: 'ID',
        field: 'id',
        type: 'string',
        category: 'Settlement Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { id: true },
      },
      {
        key: SettlementReportFieldEnum.TYPE,
        label: 'Type',
        field: 'type',
        type: 'string',
        category: 'Settlement Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { type: true },
      },
      {
        key: SettlementReportFieldEnum.AMOUNT,
        label: 'Amount',
        field: 'amount',
        type: 'currency',
        category: 'Settlement Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { amount: true },
      },
      {
        key: SettlementReportFieldEnum.STATUS,
        label: 'Status',
        field: 'status',
        type: 'status',
        category: 'Settlement Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: SettlementReportFieldEnum.ERROR_REASON,
        label: 'Error Reason',
        field: 'errorReason',
        type: 'string',
        category: 'Settlement Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { errorReason: true },
      },
      {
        key: SettlementReportFieldEnum.CREDIT_TRANSACTION_ID,
        label: 'Credit Transaction ID',
        field: 'creditTransactionId',
        type: 'string',
        category: 'Settlement Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { creditTransactionId: true },
      },
      {
        key: SettlementReportFieldEnum.AFFILIATE_CUSTOMER_ID,
        label: 'Affiliate Customer ID',
        field: 'affiliateCustomerId',
        type: 'string',
        category: 'Settlement Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { affiliateCustomerId: true },
      },
      {
        key: SettlementReportFieldEnum.PROCESSED_AT,
        label: 'Processed At',
        field: 'processedAt',
        type: 'date',
        category: 'Settlement Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { processedAt: true },
      },
      {
        key: SettlementReportFieldEnum.CREATED_AT,
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Settlement Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { createdAt: true },
      },
      {
        key: SettlementReportFieldEnum.ORDER_ID,
        label: 'Order ID',
        field: 'orderId',
        type: 'string',
        category: 'Order Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { orderId: true },
      },
      {
        key: SettlementReportFieldEnum.ORDER_NUMBER,
        label: 'Order Number',
        field: 'orderNumber',
        type: 'string',
        category: 'Order Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { order: { select: { orderNumber: true } } },
      },
      {
        key: SettlementReportFieldEnum.FRANCHISE_NAME,
        label: 'Franchise Name',
        field: 'franchiseName',
        type: 'string',
        category: 'Franchise Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { order: { select: { franchise: { select: { name: true } } } } },
      },
      {
        key: SettlementReportFieldEnum.FRANCHISE_CODE,
        label: 'Franchise Code',
        field: 'franchiseCode',
        type: 'string',
        category: 'Franchise Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { order: { select: { franchise: { select: { code: true } } } } },
      },
      {
        key: SettlementReportFieldEnum.AFFILIATE_NAME,
        label: 'Affiliate Name',
        field: 'affiliateName',
        type: 'string',
        category: 'Affiliate Info',
        default: false,
        sortable: false,
        filterable: false,
        exportable: true,
        dbSelect: { affiliateCustomerId: true },
      },
      {
        key: SettlementReportFieldEnum.AFFILIATE_EMAIL,
        label: 'Affiliate Email',
        field: 'affiliateEmail',
        type: 'string',
        category: 'Affiliate Info',
        default: false,
        sortable: false,
        filterable: false,
        exportable: true,
        dbSelect: { affiliateCustomerId: true },
      },
      {
        key: SettlementReportFieldEnum.CUSTOMER_NAME,
        label: 'Customer Name',
        field: 'customerName',
        type: 'string',
        category: 'Customer Info',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
        dbSelect: { order: { select: { customer: { select: { name: true } } } } },
      },
      {
        key: SettlementReportFieldEnum.CUSTOMER_EMAIL,
        label: 'Customer Email',
        field: 'customerEmail',
        type: 'string',
        category: 'Customer Info',
        default: false,
        sortable: false,
        filterable: false,
        exportable: true,
        dbSelect: { order: { select: { customer: { select: { user: { select: { email: true } } } } } } },
      },
      {
        key: SettlementReportFieldEnum.CUSTOMER_PHONE,
        label: 'Customer Phone',
        field: 'customerPhone',
        type: 'string',
        category: 'Customer Info',
        default: false,
        sortable: false,
        filterable: false,
        exportable: true,
        dbSelect: { order: { select: { customer: { select: { phone: true } } } } },
      },
      {
        key: SettlementReportFieldEnum.PRODUCT_NAMES,
        label: 'Product Names',
        field: 'productNames',
        type: 'string',
        category: 'Order Details',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
        dbSelect: { order: { select: { items: { select: { productName: true, quantity: true } } } } },
      },
      {
        key: SettlementReportFieldEnum.FRANCHISE_CONTACT,
        label: 'Franchise Contact',
        field: 'franchiseContact',
        type: 'string',
        category: 'Franchise Info',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
        dbSelect: { order: { select: { franchise: { select: { ownerPhone: true } } } } },
      },
      {
        key: SettlementReportFieldEnum.STORE_NAME,
        label: 'Store Name',
        field: 'storeName',
        type: 'string',
        category: 'Franchise Info',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
        dbSelect: { order: { select: { franchise: { select: { name: true, businessName: true } } } } },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: Object.values(OrderSettlementStatus).map((status) => ({
          label: status,
          value: status,
        })),
      },
      {
        name: 'type',
        label: 'Settlement Type',
        type: 'select',
        options: Object.values(SettlementType).map((type) => ({
          label: type,
          value: type,
        })),
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
        clauses.push({ order: { franchiseId: userFranchiseId } });
      }
    }

    // Status filter
    if (query.status) {
      clauses.push({ status: query.status as OrderSettlementStatus });
    }

    // Type filter
    if (query.type) {
      clauses.push({ type: query.type as SettlementType });
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
          { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
          { order: { franchise: { name: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    // Sort logic
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || query.order || 'desc';

    let orderBy: any;
    if (sortBy === 'orderNumber') {
      orderBy = { order: { orderNumber: sortOrder } };
    } else if (sortBy === 'franchiseName') {
      orderBy = { order: { franchise: { name: sortOrder } } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    return {
      where,
      orderBy,
      include: {
        order: {
          include: {
            franchise: { select: { name: true, code: true, businessName: true, ownerPhone: true } },
            customer: {
              include: {
                user: { select: { email: true } },
              },
            },
            items: { select: { productName: true, quantity: true } },
          },
        },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const [counts, franchiseAgg, affiliateAgg] = await Promise.all([
      prisma.orderSettlement.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.orderSettlement.aggregate({
        where: {
          ...where,
          type: SettlementType.FRANCHISE,
          status: OrderSettlementStatus.SETTLED,
        },
        _sum: { amount: true },
      }),
      prisma.orderSettlement.aggregate({
        where: {
          ...where,
          type: SettlementType.AFFILIATE,
          status: OrderSettlementStatus.SETTLED,
        },
        _sum: { amount: true },
      }),
    ]);

    const totalSettlements = counts.reduce((acc, c) => acc + c._count._all, 0);
    const franchiseTotal = Number(franchiseAgg._sum.amount ?? 0);
    const affiliateTotal = Number(affiliateAgg._sum.amount ?? 0);

    return {
      totalSettlements: {
        label: 'Total Settlements',
        value: totalSettlements,
        type: 'number',
      },
      franchiseTotal: {
        label: 'Franchise Settled Total',
        value: franchiseTotal.toFixed(2),
        type: 'currency',
        description: 'Sum of settled franchise amounts',
      },
      affiliateTotal: {
        label: 'Affiliate Settled Total',
        value: affiliateTotal.toFixed(2),
        type: 'currency',
        description: 'Sum of settled affiliate amounts',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    const affiliateCustomerIds = records
      .map((r) => r.affiliateCustomerId)
      .filter((id): id is string => !!id);

    const affiliatesMap = new Map<string, any>();
    if (affiliateCustomerIds.length > 0) {
      const affiliates = await this.prisma.customer.findMany({
        where: { id: { in: affiliateCustomerIds } },
        include: {
          user: { select: { email: true } },
        },
      });
      for (const affiliate of affiliates) {
        affiliatesMap.set(affiliate.id, affiliate);
      }
    }

    return records.map((r) => {
      const affiliate = affiliatesMap.get(r.affiliateCustomerId ?? '');
      return {
        id: r.id,
        type: r.type,
        amount: Number(r.amount || 0).toFixed(2),
        status: r.status,
        errorReason: r.errorReason ?? 'N/A',
        creditTransactionId: r.creditTransactionId ?? 'N/A',
        affiliateCustomerId: r.affiliateCustomerId ?? 'N/A',
        processedAt: r.processedAt,
        createdAt: r.createdAt,
        orderId: r.orderId,
        orderNumber: r.order?.orderNumber ?? 'N/A',
        franchiseName: r.order?.franchise?.name ?? 'N/A',
        franchiseCode: r.order?.franchise?.code ?? 'N/A',
        affiliateName: affiliate?.name ?? 'N/A',
        affiliateEmail: affiliate?.user?.email ?? affiliate?.altEmail ?? 'N/A',
        customerName: r.order?.customer?.name ?? 'N/A',
        customerEmail: r.order?.customer?.user?.email ?? r.order?.customer?.altEmail ?? 'N/A',
        customerPhone: r.order?.customer?.phone ?? 'N/A',
        productNames: (r.order?.items ?? []).map((i: any) => `${i.productName} (x${i.quantity})`).join(', ') || 'N/A',
        franchiseContact: r.order?.franchise?.ownerPhone ?? 'N/A',
        storeName: r.order?.franchise?.businessName ?? r.order?.franchise?.name ?? 'N/A',
      };
    });
  }
}
