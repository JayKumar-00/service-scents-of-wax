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
import { ProductStatus } from '@prisma/client';
import { ProductReportFieldEnum } from '../enums/product-report-field.enum';

@Injectable()
export class ProductReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'products';
  }

  getTitle(): string {
    return 'Products Report';
  }

  getPrimaryEntity(): string {
    return 'Product';
  }

  getRelatedEntities(): string[] {
    return ['Category', 'Brand', 'ProductVariant'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: ProductReportFieldEnum.SKU,
        label: 'SKU',
        field: 'sku',
        type: 'string',
        category: 'Product Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { variants: { select: { sku: true }, take: 1 } },
      },
      {
        key: ProductReportFieldEnum.NAME,
        label: 'Name',
        field: 'name',
        type: 'string',
        category: 'Product Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { name: true },
      },
      {
        key: ProductReportFieldEnum.PRICE,
        label: 'Price',
        field: 'price',
        type: 'currency',
        category: 'Product Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { price: true },
      },
      {
        key: ProductReportFieldEnum.STATUS,
        label: 'Status',
        field: 'status',
        type: 'status',
        category: 'Product Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: ProductReportFieldEnum.CREATED_AT,
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Product Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { createdAt: true },
      },
      {
        key: ProductReportFieldEnum.CATEGORY_NAME,
        label: 'Category',
        field: 'categoryName',
        type: 'string',
        category: 'Categorization',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { category: { select: { name: true } } },
      },
      {
        key: ProductReportFieldEnum.BRAND_NAME,
        label: 'Brand',
        field: 'brandName',
        type: 'string',
        category: 'Categorization',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { brandRef: { select: { name: true } } },
      },
      {
        key: ProductReportFieldEnum.STOCK,
        label: 'Stock',
        field: 'stock',
        type: 'number',
        category: 'Stock Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { stock: true },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: Object.values(ProductStatus).map((status) => ({
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
      clauses.push({ status: query.status as ProductStatus });
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
          { slug: { contains: search, mode: 'insensitive' } },
          {
            variants: {
              some: { sku: { contains: search, mode: 'insensitive' } },
            },
          },
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
        category: { select: { name: true } },
        brandRef: { select: { name: true } },
        variants: { select: { sku: true }, take: 1 },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const [counts, lowStock, outOfStock] = await Promise.all([
      prisma.product.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.product.count({
        where: {
          ...where,
          stock: { lte: 5, gt: 0 },
        },
      }),
      prisma.product.count({
        where: {
          ...where,
          stock: { lte: 0 },
        },
      }),
    ]);

    const totalProducts = counts.reduce((acc, c) => acc + c._count._all, 0);
    const activeProducts =
      counts.find((c) => c.status === ProductStatus.ACTIVE)?._count._all ?? 0;

    return {
      totalProducts: {
        label: 'Total Products',
        value: totalProducts,
        type: 'number',
      },
      activeProducts: {
        label: 'Active Products',
        value: activeProducts,
        type: 'number',
      },
      lowStock: {
        label: 'Low Stock',
        value: lowStock,
        type: 'number',
        description: 'Stock level 1 - 5 units',
      },
      outOfStock: {
        label: 'Out Of Stock',
        value: outOfStock,
        type: 'number',
        description: 'Stock level 0 units',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      sku: r.variants?.[0]?.sku ?? 'N/A',
      name: r.name,
      price: Number(r.price || 0).toFixed(2),
      stock: r.stock ?? 0,
      status: r.status,
      categoryName: r.category?.name ?? 'N/A',
      brandName: r.brandRef?.name ?? 'N/A',
      createdAt: r.createdAt,
    }));
  }
}
