import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';
import { paginatePrisma, buildSearchFilter } from '../../common/utils/pagination.util';
import { OrderType } from '../../common/dto/query.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) { }

  private async getCentralDcId(): Promise<string | null> {
    const node = await this.prisma.stockingNode.findFirst({
      where: { type: 'CENTRAL_DC' },
      select: { id: true },
    });
    return node?.id || null;
  }

  private async resolveWarehouseNodeId(nodeIdInput?: string | null): Promise<string | null> {
    if (!nodeIdInput || nodeIdInput === 'DEFAULT') {
      return this.getCentralDcId();
    }

    const node = await this.prisma.stockingNode.findUnique({
      where: { id: nodeIdInput },
      select: { id: true },
    });
    if (node) {
      return node.id;
    }

    const franchiseNode = await this.prisma.stockingNode.findFirst({
      where: { franchiseId: nodeIdInput },
      select: { id: true },
    });
    if (franchiseNode) {
      return franchiseNode.id;
    }

    return this.getCentralDcId();
  }

  async create(dto: CreatePurchaseOrderDto, userId: string = 'system') {
    const warehouseNodeId = await this.resolveWarehouseNodeId(dto.warehouseNodeId);

    // create header and lines in a transaction to avoid loose records
    const result = await this.prisma.$transaction(async (tx) => {
      const poNumber = dto.poNumber || `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: dto.supplierId,
          warehouseNodeId,
          currency: dto.currency ?? 'INR',
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
          notes: dto.notes,
          totalAmount: dto.totalAmount ? String(dto.totalAmount) : null,
          status: 'DRAFT',
        },
      });

      if (dto.lines?.length) {
        await tx.purchaseOrderLine.createMany({
          data: dto.lines.map((l) => ({
            purchaseOrderId: po.id,
            productId: l.productId,
            variantId: l.variantId || null,
            orderedQty: Number(l.orderedQty),
            moq: l.moq ? Number(l.moq) : undefined,
            unitCost: String(l.unitCost),
            gstPercent: l.gstPercent ? String(l.gstPercent) : undefined,
            lineTotal: String(Number(l.orderedQty) * Number(l.unitCost)),
            // basePrice: l.basePrice,
            wholesalePrice: l.wholesalePrice,
            price: l.price,
            mrpPrice: l.mrpPrice,
          })),
        });
      }

      const created = await tx.purchaseOrder.findUnique({ where: { id: po.id }, include: { lines: true } });

      await this.audit.log({
        userId,
        action: 'CREATE_PURCHASE_ORDER',
        resource: 'PurchaseOrder',
        resourceId: po.id,
        metadata: { poNumber: po.poNumber },
      });

      return created;
    });

    return result;
  }

  async list(query: PurchaseOrderQueryDto) {
    const clauses: Record<string, any>[] = [];

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.supplierId) {
      clauses.push({ supplierId: query.supplierId });
    }

    if (query.search) {
      const searchFilter = buildSearchFilter(query.search, [
        'poNumber',
        'notes',
        'supplier.name',
      ]);
      if (Object.keys(searchFilter).length > 0) {
        clauses.push(searchFilter);
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const allowedSortFields = ['createdAt', 'poNumber', 'status', 'expectedDeliveryDate', 'totalAmount'];
    const sortField = allowedSortFields.includes(query.sortBy || '')
      ? (query.sortBy as string)
      : 'createdAt';
    const direction = query.order || OrderType.DESC;
    const orderBy: Record<string, OrderType> = { [sortField]: direction };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const paged = await paginatePrisma<any>({
      model: this.prisma.purchaseOrder as any,
      where,
      orderBy,
      page,
      limit,
      include: { supplier: true, lines: true },
    });

    return {
      data: paged.data || [],
      meta: paged.meta,
    };
  }

  async get(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lines: true },
    });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }
    return po;
  }

  async update(id: string, dto: UpdatePurchaseOrderDto, userId: string = 'system') {
    let warehouseNodeId: string | null | undefined = undefined;
    if (dto.warehouseNodeId !== undefined) {
      warehouseNodeId = await this.resolveWarehouseNodeId(dto.warehouseNodeId);
    }

    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        poNumber: dto.poNumber,
        supplierId: dto.supplierId,
        warehouseNodeId,
        currency: dto.currency,
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
        notes: dto.notes,
        totalAmount: dto.totalAmount ? String(dto.totalAmount) : undefined,
      },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_PURCHASE_ORDER',
      resource: 'PurchaseOrder',
      resourceId: po.id,
      metadata: { poNumber: po.poNumber },
    });

    return po;
  }

  async approve(id: string, userId: string = 'system') {
    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    await this.audit.log({
      userId,
      action: 'APPROVE_PURCHASE_ORDER',
      resource: 'PurchaseOrder',
      resourceId: po.id,
      metadata: { poNumber: po.poNumber },
    });

    return po;
  }

  async deliver(id: string, userId: string = 'system') {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!po) {
        throw new NotFoundException('Purchase order not found');
      }

      if (po.status === 'RECEIVED' || po.status === 'CLOSED') {
        return po;
      }

      for (const line of po.lines) {
        const remainingQty = line.orderedQty - line.receivedQty;
        if (remainingQty <= 0) {
          continue;
        }

        // 1. Update line receivedQty
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { receivedQty: line.orderedQty },
        });

        // 2. Update variant/product stock and basePrice
        if (line.variantId) {
          await tx.productVariant.update({
            where: { id: line.variantId },
            data: {
              stock: { increment: remainingQty },
              basePrice: new Prisma.Decimal(line.unitCost),
            },
          });

          // Recalculate parent product's stock
          const variants = await tx.productVariant.findMany({
            where: { productId: line.productId },
          });
          const totalStock = variants.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0);

          await tx.product.update({
            where: { id: line.productId },
            data: { stock: totalStock },
          });
        } else {
          await tx.product.update({
            where: { id: line.productId },
            data: {
              stock: { increment: remainingQty },
              basePrice: new Prisma.Decimal(line.unitCost),
            },
          });
        }

        // 3. Update WarehouseStock
        let warehouseStock = await tx.warehouseStock.findUnique({
          where: { productId: line.productId },
        });

        if (!warehouseStock) {
          const product = await tx.product.findUnique({ where: { id: line.productId } });
          const fallbackQty = product?.stock ?? 0;
          warehouseStock = await tx.warehouseStock.create({
            data: {
              productId: line.productId,
              quantity: fallbackQty,
              lowStockThreshold: 5,
              reserved: 0,
            },
          });
        }

        await tx.warehouseStock.update({
          where: { productId: line.productId },
          data: { quantity: { increment: remainingQty } },
        });

        // 4. Create ledger entry
        await tx.inventoryLedgerEntry.create({
          data: {
            productId: line.productId,
            transactionType: 'PURCHASE',
            quantity: remainingQty,
            unitCost: new Prisma.Decimal(line.unitCost),
            runningBalance: (warehouseStock.quantity ?? 0) + remainingQty,
            referenceType: 'PurchaseOrder',
            referenceId: po.id,
            note: `Direct PO delivery for ${po.poNumber}`,
          },
        });

        // 5. Create valuation snapshot
        await tx.inventoryValuationSnapshot.create({
          data: {
            productId: line.productId,
            warehouseNodeId: po.warehouseNodeId ?? undefined,
            onHandQty: (warehouseStock.quantity ?? 0) + remainingQty,
            weightedAvgCost: new Prisma.Decimal(line.unitCost),
            landedCost: new Prisma.Decimal(line.unitCost),
            inventoryValue: new Prisma.Decimal(remainingQty * Number(line.unitCost)),
            sourceRefType: 'PurchaseOrder',
            sourceRefId: po.id,
          },
        });
      }

      // Update PO status to RECEIVED
      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'RECEIVED',
        },
      });

      await this.audit.log({
        userId,
        action: 'DELIVER_PURCHASE_ORDER',
        resource: 'PurchaseOrder',
        resourceId: po.id,
        metadata: { poNumber: po.poNumber },
      });

      return updatedPo;
    });
  }

  async updateStatus(id: string, status: PurchaseOrderStatus, userId: string = 'system') {
    if (status === 'APPROVED') {
      return this.approve(id, userId);
    }
    if (status === 'RECEIVED') {
      return this.deliver(id, userId);
    }

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
    });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    const data: Prisma.PurchaseOrderUpdateInput = { status };
    if (status === 'SENT') {
      data.sentAt = new Date();
    }

    const updatedPo = await this.prisma.purchaseOrder.update({
      where: { id },
      data,
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_PURCHASE_ORDER_STATUS',
      resource: 'PurchaseOrder',
      resourceId: updatedPo.id,
      metadata: { poNumber: updatedPo.poNumber, status },
    });

    return updatedPo;
  }
}
