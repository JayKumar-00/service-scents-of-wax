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
import { InventoryReportFieldEnum } from '../enums/inventory-report-field.enum';
import { Role } from '@prisma/client';

@Injectable()
export class InventoryReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'inventory';
  }

  getTitle(): string {
    return 'Inventory Report';
  }

  getPrimaryEntity(): string {
    return 'FranchiseStock';
  }

  getRelatedEntities(): string[] {
    return ['Franchise', 'Product', 'ProductVariant'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: InventoryReportFieldEnum.PRODUCT_NAME,
        label: 'Product Name',
        field: 'productName',
        type: 'string',
        category: 'Product Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { product: { select: { name: true } } },
      },
      {
        key: InventoryReportFieldEnum.SKU,
        label: 'SKU',
        field: 'sku',
        type: 'string',
        category: 'Product Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: {
          product: { select: { variants: { select: { sku: true }, take: 1 } } },
        },
      },
      {
        key: InventoryReportFieldEnum.FRANCHISE_NAME,
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
        key: InventoryReportFieldEnum.FRANCHISE_CODE,
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
        key: InventoryReportFieldEnum.QUANTITY,
        label: 'Quantity',
        field: 'quantity',
        type: 'number',
        category: 'Stock Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { quantity: true },
      },
      {
        key: InventoryReportFieldEnum.RESERVED,
        label: 'Reserved',
        field: 'reserved',
        type: 'number',
        category: 'Stock Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { reserved: true },
      },
      {
        key: InventoryReportFieldEnum.LOW_STOCK_THRESHOLD,
        label: 'Threshold',
        field: 'lowStockThreshold',
        type: 'number',
        category: 'Stock Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { lowStockThreshold: true },
      },
      {
        key: InventoryReportFieldEnum.STATUS,
        label: 'Status',
        field: 'status',
        type: 'status',
        category: 'Stock Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { quantity: true, lowStockThreshold: true },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { label: 'In Stock', value: 'IN_STOCK' },
          { label: 'Low Stock', value: 'LOW_STOCK' },
          { label: 'Out of Stock', value: 'OUT_OF_STOCK' },
        ],
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
      if (query.status === 'OUT_OF_STOCK') {
        clauses.push({ quantity: { lte: 0 } });
      } else if (query.status === 'LOW_STOCK') {
        clauses.push({
          quantity: { gt: 0, lte: 5 },
        });
      } else if (query.status === 'IN_STOCK') {
        clauses.push({ quantity: { gt: 5 } });
      }
    }

    // Search filter
    if (query.search?.trim()) {
      const search = query.search.trim();
      clauses.push({
        OR: [
          { product: { name: { contains: search, mode: 'insensitive' } } },
          {
            product: {
              variants: {
                some: { sku: { contains: search, mode: 'insensitive' } },
              },
            },
          },
        ],
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    // Sort logic
    const sortBy = query.sortBy || 'quantity';
    const sortOrder = query.sortOrder || query.order || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    return {
      where,
      orderBy,
      include: {
        franchise: { select: { name: true, code: true } },
        product: {
          select: {
            name: true,
            price: true,
            variants: { select: { sku: true }, take: 1 },
          },
        },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const [aggregates, lowStock, outOfStock] = await Promise.all([
      prisma.franchiseStock.aggregate({
        where,
        _sum: {
          quantity: true,
          reserved: true,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.franchiseStock.count({
        where: {
          ...where,
          quantity: { gt: 0, lte: 5 },
        },
      }),
      prisma.franchiseStock.count({
        where: {
          ...where,
          quantity: { lte: 0 },
        },
      }),
    ]);

    const totalStock = aggregates._sum.quantity ?? 0;
    const totalReserved = aggregates._sum.reserved ?? 0;

    return {
      totalStock: {
        label: 'Total Stock',
        value: totalStock,
        type: 'number',
        description: 'Total units in stock',
      },
      lowStockItems: {
        label: 'Low Stock Items',
        value: lowStock,
        type: 'number',
        description: 'Products running low (<= 5 units)',
      },
      outOfStockItems: {
        label: 'Out Of Stock Items',
        value: outOfStock,
        type: 'number',
        description: 'Products with zero stock',
      },
      reservedStock: {
        label: 'Reserved Stock',
        value: totalReserved,
        type: 'number',
        description: 'Units reserved for orders',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => {
      const status =
        r.quantity <= 0
          ? 'OUT_OF_STOCK'
          : r.quantity <= r.lowStockThreshold
            ? 'LOW_STOCK'
            : 'IN_STOCK';
      return {
        franchiseName: r.franchise?.name ?? 'N/A',
        franchiseCode: r.franchise?.code ?? 'N/A',
        productName: r.product?.name ?? 'N/A',
        sku: r.product?.variants?.[0]?.sku ?? 'N/A',
        quantity: r.quantity,
        reserved: r.reserved,
        lowStockThreshold: r.lowStockThreshold,
        status,
      };
    });
  }
}
