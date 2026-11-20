import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from '../audit/audit.service';
import { AdjustWarehouseStockDto } from './dto/adjust-warehouse-stock.dto';
import { WarehouseBulkDto } from './dto/warehouse-bulk.dto';
import { WarehouseDeltaDto } from './dto/warehouse-delta.dto';
import { WarehouseThresholdDto } from './dto/warehouse-threshold.dto';
import {
  WarehouseQueryDto,
  WarehouseWithoutPaginationQueryDto,
} from './dto/warehouse-query.dto';
import { normalizePositiveInteger } from 'src/common/utils/pagination.util';
import { Prisma } from '@prisma/client';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@Injectable()
export class WarehouseService {
  private readonly warehouseStockProductSelect = {
    select: {
      id: true,
      name: true,
      slug: true,
      stock: true,
      category: { select: { name: true } },
      variants: {
        select: {
          id: true,
          sku: true,
          price: true,
          stock: true,
          attributeSummary: true,
          imageUrl: true,
        },
      },
    },
  } as const;

  private mapWarehouseStock(item: any) {
    if (!item || !item.product) return item;

    const product = item.product;
    if (product.variants && product.variants.length > 0) {
      const totalVariantsStock = product.variants.reduce(
        (sum: number, v: any) => sum + (v.stock ?? 0),
        0,
      );
      product.stock = totalVariantsStock;
      item.quantity = totalVariantsStock;
    } else {
      product.stock = item.quantity;
    }
    return item;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) { }

  async inventory(query: WarehouseQueryDto) {
    const clauses: Prisma.ProductWhereInput[] = [{ deletedAt: null }];

    const search = query.search?.trim();
    if (search) {
      clauses.push({
        name: { contains: search, mode: 'insensitive' },
      });
    }

    if (query.productId) {
      clauses.push({
        id: query.productId,
      });
    }

    const where = clauses.length > 1 ? { AND: clauses } : (clauses[0] ?? {});

    const currentPage = normalizePositiveInteger(query.page, 1);
    const pageLimit = normalizePositiveInteger(query.limit, 10);
    const skip = (currentPage - 1) * pageLimit;

    const total = await this.prisma.product.count({ where });
    const totalPages = total > 0 ? Math.ceil(total / pageLimit) : 0;

    const paged = await this.prisma.product.findMany({
      where,
      orderBy: { name: query.order },
      include: {
        warehouseStocks: true,
        category: { select: { name: true } },
        variants: {
          select: {
            id: true,
            sku: true,
            price: true,
            stock: true,
            attributeSummary: true,
            imageUrl: true,
          },
        },
      },
      skip,
      take: pageLimit,
    });

    const mappedData = paged.map((product) => {
      const quantity =
        product.variants && product.variants.length > 0
          ? product.variants.reduce(
            (sum: number, v: any) => sum + (v.stock ?? 0),
            0,
          )
          : (product.warehouseStocks?.quantity ?? product.stock ?? 0);

      const lowStockThreshold = product.warehouseStocks?.lowStockThreshold ?? 5;
      const reserved = product.warehouseStocks?.reserved ?? 0;

      return {
        productId: product.id,
        quantity,
        lowStockThreshold,
        reserved,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          stock: quantity,
          category: product.category,
          variants: product.variants,
        },
      };
    });

    return {
      data: mappedData,
      meta: {
        count: total,
        totalPages,
        page: currentPage,
        limit: pageLimit,
      },
    };
  }

  async allInventory(query: WarehouseWithoutPaginationQueryDto) {
    const clauses: Prisma.ProductWhereInput[] = [{ deletedAt: null }];

    const search = query.search?.trim();
    if (search) {
      clauses.push({
        name: { contains: search, mode: 'insensitive' },
      });
    }

    if (query.productId) {
      clauses.push({
        id: query.productId,
      });
    }

    const where = clauses.length > 1 ? { AND: clauses } : (clauses[0] ?? {});

    const paged = await this.prisma.product.findMany({
      where,
      orderBy: { name: query.order },
      include: {
        warehouseStocks: true,
        category: { select: { name: true } },
        variants: {
          select: {
            id: true,
            sku: true,
            price: true,
            stock: true,
            attributeSummary: true,
            imageUrl: true,
          },
        },
      },
    });

    const mappedData = paged.map((product) => {
      const quantity =
        product.variants && product.variants.length > 0
          ? product.variants.reduce(
            (sum: number, v: any) => sum + (v.stock ?? 0),
            0,
          )
          : (product.warehouseStocks?.quantity ?? product.stock ?? 0);

      const lowStockThreshold = product.warehouseStocks?.lowStockThreshold ?? 5;
      const reserved = product.warehouseStocks?.reserved ?? 0;

      return {
        productId: product.id,
        quantity,
        lowStockThreshold,
        reserved,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          stock: quantity,
          category: product.category,
          variants: product.variants,
        },
      };
    });

    return {
      data: mappedData,
    };
  }

  async adjust(
    user: JwtUser,
    dto: AdjustWarehouseStockDto,
    ip: string,
  ) {

    const existing = await this.prisma.warehouseStock.findUnique({
      where: { productId: dto.productId },
    });

    const isCreate = !existing;

    if (dto.variantId) {
      await this.prisma.productVariant.update({
        where: { id: dto.variantId },
        data: { stock: dto.quantity },
      });

      const variants = await this.prisma.productVariant.findMany({
        where: { productId: dto.productId },
      });
      const totalStock = variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);

      // Update Product.stock to ensure consistency
      await this.prisma.product.update({
        where: { id: dto.productId },
        data: { stock: totalStock },
      });

      const updated = await this.prisma.warehouseStock.upsert({
        where: { productId: dto.productId },
        create: {
          productId: dto.productId,
          quantity: totalStock,
          lowStockThreshold: 5,
        },
        update: { quantity: totalStock },
        include: { product: this.warehouseStockProductSelect },
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: isCreate ? 'warehouse_stock_adjust.create' : 'warehouse_stock_adjust.update',
          resource: 'WarehouseStock',
          resourceId: dto.productId,
          metadata: isCreate ? {
            role: user.role,
            ...dto,
          } : {
            from: Object.fromEntries(
              Object.keys(dto).map(key => [key, existing[key as keyof typeof existing]])
            ),
            to: Object.fromEntries(
              Object.keys(dto).map(key => [key, updated[key as keyof typeof updated]])
            ),
            ip: ip,
          }
        }),
        'warehouse.stock.adjust',
      );

      return this.mapWarehouseStock(updated);
    } else {
      // Update Product.stock to ensure consistency
      await this.prisma.product.update({
        where: { id: dto.productId },
        data: { stock: dto.quantity },
      });

      const updated = await this.prisma.warehouseStock.upsert({
        where: { productId: dto.productId },
        create: {
          productId: dto.productId,
          quantity: dto.quantity,
          lowStockThreshold: 5,
        },
        update: { quantity: dto.quantity },
        include: { product: this.warehouseStockProductSelect },
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'warehouse.stock.adjust',
          resource: 'WarehouseStock',
          resourceId: dto.productId,
          metadata: { quantity: dto.quantity, reason: dto.reason ?? null },
          ip: ip,
        }),
        'warehouse.stock.adjust',
      );
      return this.mapWarehouseStock(updated);
    }
  }

  async applyDelta(
    user: JwtUser,
    dto: WarehouseDeltaDto,
    ip: string,
  ) {

    const existing = await this.prisma.warehouseStock.findUnique({
      where: { productId: dto.productId },
    });

    const isCreate = !existing;

    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      });

      if (!variant) {
        throw new BadRequestException('Variant not found');
      }

      const current = variant.stock ?? 0;
      const next = current + dto.delta;
      if (next < 0) {
        throw new BadRequestException('Resulting quantity cannot be negative');
      }

      await this.prisma.productVariant.update({
        where: { id: dto.variantId },
        data: { stock: next },
      });

      const variants = await this.prisma.productVariant.findMany({
        where: { productId: dto.productId },
      });
      const totalStock = variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);

      // Update Product.stock to ensure consistency
      await this.prisma.product.update({
        where: { id: dto.productId },
        data: { stock: totalStock },
      });

      const updated = await this.prisma.warehouseStock.upsert({
        where: { productId: dto.productId },
        create: {
          productId: dto.productId,
          quantity: totalStock,
          lowStockThreshold: 5,
        },
        update: { quantity: totalStock },
        include: { product: this.warehouseStockProductSelect },
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: isCreate ? 'warehouse_stock_delta.create' : 'warehouse_stock_delta.update',
          resource: 'WarehouseStock',
          resourceId: dto.productId,
          metadata: isCreate ? {
            role: user.role,
            ...dto,
          } : {
            from: Object.fromEntries(
              Object.keys(dto).map(key => [key, existing[key as keyof typeof existing]])
            ),
            to: Object.fromEntries(
              Object.keys(dto).map(key => [key, updated[key as keyof typeof updated]])
            ),
            ip: ip,
          }
        }),
        'warehouse.stock.delta',
      );

      return this.mapWarehouseStock(updated);
    } else {
      const ws = await this.prisma.warehouseStock.findUnique({
        where: { productId: dto.productId },
      });

      if (!ws) {
        throw new BadRequestException(
          'Product does not exist in warehouse stock. Use adjust endpoint to set initial quantity.',
        );
      }

      const current = ws?.quantity ?? 0;
      const next = current + dto.delta;
      if (next < 0) {
        throw new BadRequestException('Resulting quantity cannot be negative');
      }

      // Update Product.stock to ensure consistency
      await this.prisma.product.update({
        where: { id: dto.productId },
        data: { stock: next },
      });

      const updated = await this.prisma.warehouseStock.upsert({
        where: { productId: dto.productId },
        create: {
          productId: dto.productId,
          quantity: next,
          lowStockThreshold: 5,
        },
        update: { quantity: next },
        include: { product: this.warehouseStockProductSelect },
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'warehouse_stock_delta.update',
          resource: 'WarehouseStock',
          resourceId: ws.productId,
          metadata: {
            role: user.role,
            from: Object.fromEntries(
              Object.keys(ws).map(key => [key, ws[key as keyof typeof ws]])
            ),
            to: Object.fromEntries(
              Object.keys(updated).map(key => [key, updated[key as keyof typeof updated]])
            ),
          },
          ip: ip,
        }),
        'warehouse.stock.delta',
      );
      return this.mapWarehouseStock(updated);
    }
  }

  async setThreshold(
    user: JwtUser,
    dto: WarehouseThresholdDto,
    ip: string,
  ) {

    const ws = await this.prisma.warehouseStock.findUnique({
      where: { productId: dto.productId },
    });
    if (!ws) {
      throw new BadRequestException(
        'Product does not exist in warehouse stock. Use adjust endpoint to set initial quantity.',
      );
    }

    const updated = await this.prisma.warehouseStock.update({
      where: { productId: dto.productId },
      data: { lowStockThreshold: dto.lowStockThreshold },
      include: { product: this.warehouseStockProductSelect },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'warehouse_threshold_set_update',
        resource: 'WarehouseStock',
        resourceId: dto.productId,
        metadata: {
          role: user.role,
          from: Object.fromEntries(
            Object.keys(ws).map(key => [key, ws[key as keyof typeof ws]])
          ),
          to: Object.fromEntries(
            Object.keys(updated).map(key => [key, updated[key as keyof typeof updated]])
          ),
        },
        ip: ip,
      }),
      'warehouse.threshold.set',
    );

    return this.mapWarehouseStock(updated);
  }

  async bulkSet(
    user: JwtUser,
    dto: WarehouseBulkDto,
    ip: string,
  ) {

    const results: any[] = [];
    for (const line of dto.items) {
      const updated = await this.prisma.warehouseStock.upsert({
        where: { productId: line.productId },
        create: {
          productId: line.productId,
          quantity: line.quantity,
          lowStockThreshold: 5,
        },
        update: { quantity: line.quantity },
        include: { product: this.warehouseStockProductSelect },
      });
      results.push(this.mapWarehouseStock(updated));
    }

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'warehouse_stock_bulkset_update',
        resource: 'WarehouseStock',
        resourceId: null,
        metadata: { count: dto.items.length },
        ip: ip,
      }),
      'warehouse.stock.bulk',
    );
    return results;
  }
}
