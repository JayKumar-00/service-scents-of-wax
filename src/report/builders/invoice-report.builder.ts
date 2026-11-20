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
import { InvoiceStatus, Role } from '@prisma/client';
import { InvoiceReportFieldEnum } from '../enums/invoice-report-field.enum';

@Injectable()
export class InvoiceReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'invoices';
  }

  getTitle(): string {
    return 'Invoices Report';
  }

  getPrimaryEntity(): string {
    return 'Invoice';
  }

  getRelatedEntities(): string[] {
    return ['Order', 'StockRequest'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: InvoiceReportFieldEnum.INVOICE_NUMBER,
        label: 'Invoice Number',
        field: 'invoiceNumber',
        type: 'string',
        category: 'Invoice Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { invoiceNumber: true },
      },
      {
        key: InvoiceReportFieldEnum.TYPE,
        label: 'Type',
        field: 'type',
        type: 'string',
        category: 'Invoice Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { type: true },
      },
      {
        key: InvoiceReportFieldEnum.GRAND_TOTAL,
        label: 'Grand Total',
        field: 'grandTotal',
        type: 'currency',
        category: 'Invoice Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { grandTotal: true },
      },
      {
        key: InvoiceReportFieldEnum.STATUS,
        label: 'Status',
        field: 'status',
        type: 'status',
        category: 'Invoice Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: InvoiceReportFieldEnum.ISSUED_AT,
        label: 'Issued At',
        field: 'issuedAt',
        type: 'date',
        category: 'Invoice Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { issuedAt: true },
      },
      {
        key: InvoiceReportFieldEnum.BUYER_NAME,
        label: 'Buyer Name',
        field: 'buyerName',
        type: 'string',
        category: 'Buyer Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { buyerName: true },
      },
      {
        key: InvoiceReportFieldEnum.BUYER_PHONE,
        label: 'Buyer Phone',
        field: 'buyerPhone',
        type: 'string',
        category: 'Buyer Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { buyerPhone: true },
      },
      {
        key: InvoiceReportFieldEnum.BUYER_EMAIL,
        label: 'Buyer Email',
        field: 'buyerEmail',
        type: 'string',
        category: 'Buyer Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { buyerEmail: true },
      },
      {
        key: InvoiceReportFieldEnum.STORE_NAME,
        label: 'Store Name',
        field: 'storeName',
        type: 'string',
        category: 'Metadata',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { storeName: true },
      },
      {
        key: InvoiceReportFieldEnum.ORDER_NUMBER,
        label: 'Order Number',
        field: 'orderNumber',
        type: 'string',
        category: 'Metadata',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: { order: { select: { orderNumber: true } } },
      },
      {
        key: InvoiceReportFieldEnum.STOCK_REQUEST_ID,
        label: 'Stock Request ID',
        field: 'stockRequestId',
        type: 'string',
        category: 'Metadata',
        default: false,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: { stockRequest: { select: { id: true } } },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: Object.values(InvoiceStatus).map((status) => ({
          label: status,
          value: status,
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
        clauses.push({
          OR: [
            { order: { franchiseId: userFranchiseId } },
            { stockRequest: { franchiseId: userFranchiseId } },
          ],
        });
      }
    }

    // Status filter
    if (query.status) {
      clauses.push({ status: query.status as InvoiceStatus });
    }

    // Date filters
    const dateRange = this.buildDateRangeFilter(
      query.fromDate,
      query.toDate ?? query.lastDate,
    );
    if (dateRange) {
      clauses.push({ issuedAt: dateRange });
    }

    // Search filter
    if (query.search?.trim()) {
      const search = query.search.trim();
      clauses.push({
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { buyerName: { contains: search, mode: 'insensitive' } },
          { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    // Sort logic
    const sortBy = query.sortBy || 'issuedAt';
    const sortOrder = query.sortOrder || query.order || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    return {
      where,
      orderBy,
      include: {
        order: { select: { orderNumber: true } },
        stockRequest: { select: { id: true } },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const [counts, revenueAgg] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: {
          ...where,
          status: { not: InvoiceStatus.CANCELLED },
        },
        _sum: { grandTotal: true },
      }),
    ]);

    const totalInvoices = counts.reduce((acc, c) => acc + c._count._all, 0);
    const paymentInvoices =
      counts.find((c) => c.type === 'PAYMENT')?._count._all ?? 0;
    const shipmentInvoices =
      counts.find((c) => c.type === 'SHIPMENT')?._count._all ?? 0;
    const revenue = Number(revenueAgg._sum.grandTotal ?? 0);

    return {
      totalInvoices: {
        label: 'Total Invoices',
        value: totalInvoices,
        type: 'number',
      },
      paymentInvoices: {
        label: 'Payment Invoices',
        value: paymentInvoices,
        type: 'number',
      },
      shipmentInvoices: {
        label: 'Shipment Invoices',
        value: shipmentInvoices,
        type: 'number',
      },
      grandTotalSum: {
        label: 'Total Value',
        value: revenue.toFixed(2),
        type: 'currency',
        description: 'Sum of invoice totals (excludes cancelled)',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      type: r.type,
      buyerName: r.buyerName ?? 'N/A',
      buyerPhone: r.buyerPhone ?? 'N/A',
      buyerEmail: r.buyerEmail ?? 'N/A',
      storeName: r.storeName ?? 'N/A',
      grandTotal: Number(r.grandTotal || 0).toFixed(2),
      status: r.status,
      issuedAt: r.issuedAt,
      orderNumber: r.order?.orderNumber ?? 'N/A',
      stockRequestId: r.stockRequest?.id ?? 'N/A',
    }));
  }
}
