import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateGrnDto } from './dto/create-grn.dto';
import { PostGrnDto } from './dto/post-grn.dto';
import { Prisma, GrnStatus } from '@prisma/client';
import { GrnQueryDto } from './dto/grn-query.dto';
import { paginatePrisma, buildSearchFilter } from '../../common/utils/pagination.util';
import { OrderType } from '../../common/dto/query.dto';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@Injectable()
export class GrnService {
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

  async create(dto: CreateGrnDto, user?: JwtUser) {
    const warehouseNodeId = await this.resolveWarehouseNodeId(dto.warehouseNodeId);

    // Ensure header and lines are created atomically to avoid loose records
    const result = await this.prisma.$transaction(async (tx) => {
      const grnNumber = dto.grnNumber || `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const grn = await tx.goodsReceiptNote.create({
        data: {
          grnNumber,
          purchaseOrderId: dto.purchaseOrderId,
          asnId: dto.asnId,
          supplierId: dto.supplierId,
          warehouseNodeId,
          status: 'DRAFT',
        },
      });

      if (dto.asnId) {
        await tx.asn.update({
          where: { id: dto.asnId },
          data: { status: 'IN_TRANSIT' },
        });
      }

      if (dto.lines?.length) {
        const resolvedLines = await Promise.all(
          dto.lines.map(async (line) => {
            let poLineId = line.purchaseOrderLineId;
            if (!poLineId) {
              const poLine = await tx.purchaseOrderLine.findFirst({
                where: {
                  purchaseOrderId: dto.purchaseOrderId,
                  productId: line.productId,
                  variantId: line.variantId || null,
                },
                select: { id: true },
              });
              if (!poLine) {
                throw new BadRequestException(
                  `No matching purchase order line found for product ID ${line.productId} and variant ID ${line.variantId || 'none'}`
                );
              }
              poLineId = poLine.id;
            }
            return {
              grnId: grn.id,
              purchaseOrderLineId: poLineId,
              productId: line.productId,
              variantId: line.variantId || null,
              receivedQty: line.receivedQty,
              acceptedQty: line.acceptedQty,
              damagedQty: line.damagedQty,
              rejectedQty: line.rejectedQty,
            };
          })
        );

        await tx.grnLine.createMany({
          data: resolvedLines,
        });
      }

      const createdGrn = await tx.goodsReceiptNote.findUnique({
        where: { id: grn.id },
        include: { lines: true },
      });

      await this.audit.log({
        userId: user?.sub || 'system',
        action: 'CREATE_GRN',
        resource: 'GoodsReceiptNote',
        resourceId: grn.id,
        metadata: { grnNumber: grn.grnNumber },
      });

      return createdGrn;
    });

    return result;
  }

  async list(query: GrnQueryDto) {
    const clauses: Record<string, any>[] = [];

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.supplierId) {
      clauses.push({ supplierId: query.supplierId });
    }

    if (query.purchaseOrderId) {
      clauses.push({ purchaseOrderId: query.purchaseOrderId });
    }

    if (query.search) {
      const searchFilter = buildSearchFilter(query.search, [
        'grnNumber',
        'purchaseOrder.poNumber',
        'supplier.name',
      ]);
      if (Object.keys(searchFilter).length > 0) {
        clauses.push(searchFilter);
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const allowedSortFields = ['createdAt', 'grnNumber', 'status', 'postedAt'];
    const sortField = allowedSortFields.includes(query.sortBy || '')
      ? (query.sortBy as string)
      : 'createdAt';
    const direction = query.order || OrderType.DESC;
    const orderBy: Record<string, OrderType> = { [sortField]: direction };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const paged = await paginatePrisma<any>({
      model: this.prisma.goodsReceiptNote as any,
      where,
      orderBy,
      page,
      limit,
      include: { purchaseOrder: true, supplier: true, lines: true },
    });

    return {
      data: paged.data || [],
      meta: paged.meta,
    };
  }

  async get(id: string) {
    const grn = await this.prisma.goodsReceiptNote.findUnique({ where: { id } });
    if (!grn) {
      throw new NotFoundException('GRN not found');
    }
    return grn;
  }

  async post(id: string, dto?: PostGrnDto, userId: string = 'system') {
    return this.prisma.$transaction(async (tx) => {
      const grn = await tx.goodsReceiptNote.findUnique({
        where: { id },
        include: {
          lines: {
            include: {
              purchaseOrderLine: true,
            },
          },
          purchaseOrder: true,
        },
      });

      if (!grn) {
        throw new NotFoundException('GRN not found');
      }

      if (grn.status === 'POSTED') {
        throw new BadRequestException('GRN already posted');
      }

      const currentProductIds = new Set(grn.lines.map((line: { productId: string }) => line.productId));
      for (const line of grn.lines) {
        if (line.acceptedQty + line.damagedQty + line.rejectedQty !== line.receivedQty) {
          throw new BadRequestException(
            `Line ${line.id} does not satisfy accepted + damaged + rejected = received`,
          );
        }
      }

      // Update PO line received quantities
      for (const line of grn.lines) {
        if (line.purchaseOrderLineId) {
          await tx.purchaseOrderLine.update({
            where: { id: line.purchaseOrderLineId },
            data: { receivedQty: { increment: line.receivedQty } },
          });
        }
      }

      // Update product variant stock and base price if variantId exists, or parent product base price
      for (const line of grn.lines) {
        const unitCost = (line as any).purchaseOrderLine?.unitCost;
        if (line.variantId) {
          await tx.productVariant.update({
            where: { id: line.variantId },
            data: {
              stock: { increment: line.acceptedQty },
              ...(unitCost ? { basePrice: unitCost } : {}),
            },
          });
        } else {
          await tx.product.update({
            where: { id: line.productId },
            data: {
              ...(unitCost ? { basePrice: unitCost } : {}),
            },
          });
        }
      }

      // Update parent product stock and synchronize with variant stocks
      for (const productId of currentProductIds) {
        const lineQty = grn.lines
          .filter((line: { productId: string }) => line.productId === productId)
          .reduce((sum: number, line: { acceptedQty: number }) => sum + line.acceptedQty, 0);

        let warehouseStock = await tx.warehouseStock.findUnique({
          where: { productId },
        });

        if (!warehouseStock) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          const fallbackQty = product?.stock ?? 0;
          warehouseStock = await tx.warehouseStock.create({
            data: {
              productId,
              quantity: fallbackQty,
              lowStockThreshold: 5,
              reserved: 0,
            },
          });
        }

        await tx.warehouseStock.update({
          where: { productId },
          data: { quantity: { increment: lineQty } },
        });

        // Synchronize parent product stock
        const productVariants = await tx.productVariant.findMany({
          where: { productId },
        });

        if (productVariants.length > 0) {
          const totalStock = productVariants.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0);
          await tx.product.update({
            where: { id: productId },
            data: { stock: totalStock },
          });
        } else {
          await tx.product.update({
            where: { id: productId },
            data: { stock: { increment: lineQty } },
          });
        }

        const firstLine = grn.lines.find((l: any) => l.productId === productId);
        const unitCostVal = (firstLine as any)?.purchaseOrderLine?.unitCost ?? new Prisma.Decimal(0);

        await tx.inventoryLedgerEntry.create({
          data: {
            grnId: grn.id,
            productId,
            transactionType: 'PURCHASE',
            quantity: lineQty,
            unitCost: unitCostVal,
            runningBalance: (warehouseStock.quantity ?? 0) + lineQty,
            referenceType: 'GoodsReceiptNote',
            referenceId: grn.id,
            note: `GRN posted for ${grn.grnNumber}`,
          },
        });

        await tx.inventoryValuationSnapshot.create({
          data: {
            productId,
            warehouseNodeId: grn.warehouseNodeId ?? undefined,
            onHandQty: (warehouseStock.quantity ?? 0) + lineQty,
            weightedAvgCost: unitCostVal,
            landedCost: unitCostVal,
            inventoryValue: new Prisma.Decimal(lineQty * Number(unitCostVal)),
            sourceRefType: 'GoodsReceiptNote',
            sourceRefId: grn.id,
          },
        });
      }

      // Update Purchase Order status based on total received quantities
      if (grn.purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: grn.purchaseOrderId },
          include: { lines: true },
        });

        if (po) {
          const allLinesReceived = po.lines.every((l: any) => l.receivedQty >= l.orderedQty);
          const anyItemsReceived = po.lines.some((l: any) => l.receivedQty > 0);

          let newStatus: string | undefined = undefined;
          if (allLinesReceived) {
            newStatus = 'RECEIVED';
          } else if (anyItemsReceived) {
            newStatus = 'PARTIALLY_RECEIVED';
          }

          if (newStatus && po.status !== newStatus) {
            await tx.purchaseOrder.update({
              where: { id: po.id },
              data: { status: newStatus as any },
            });
          }
        }
      }

      // Trigger QC inspections for each GRN line
      for (const line of grn.lines) {
        const inspection = await tx.qualityInspection.create({
          data: {
            grnId: grn.id,
            grnLineId: line.id,
            status: 'PENDING',
            notes: `Auto-generated QC inspection for line ${line.id} of GRN ${grn.grnNumber}`,
          },
        });

        await this.audit.log({
          userId: 'system',
          action: 'CREATE_QC_INSPECTION',
          resource: 'QualityInspection',
          resourceId: inspection.id,
          metadata: { grnId: grn.id, grnLineId: line.id },
        });
      }

      if (grn.asnId) {
        await tx.asn.update({
          where: { id: grn.asnId },
          data: { status: 'IN_TRANSIT' },
        });
      }

      const postedGrn = await tx.goodsReceiptNote.update({
        where: { id },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedByUserId: 'system',
        },
      });

      await this.audit.log({
        userId,
        action: 'POST_GRN',
        resource: 'GoodsReceiptNote',
        resourceId: postedGrn.id,
        metadata: { grnNumber: postedGrn.grnNumber, ...(dto?.reference ? { reference: dto.reference } : {}) },
      });

      return postedGrn;
    });
  }

  async updateStatus(id: string, status: GrnStatus, userId: string = 'system') {
    if (status === 'POSTED') {
      return this.post(id, undefined, userId);
    }

    return this.prisma.$transaction(async (tx) => {
      const grn = await tx.goodsReceiptNote.findUnique({
        where: { id },
      });
      if (!grn) {
        throw new NotFoundException('GRN not found');
      }

      const updatedGrn = await tx.goodsReceiptNote.update({
        where: { id },
        data: { status },
      });

      await this.audit.log({
        userId,
        action: 'UPDATE_GRN_STATUS',
        resource: 'GoodsReceiptNote',
        resourceId: updatedGrn.id,
        metadata: { status: updatedGrn.status },
      });

      return updatedGrn;
    });
  }
}
