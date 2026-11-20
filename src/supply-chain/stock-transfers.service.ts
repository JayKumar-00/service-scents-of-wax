import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';
import {
  Prisma,
  Role,
  StockingNodeType,
  StockTransfer,
  StockTransferStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import {
  franchiseCanMutate,
  franchiseHasReadAccess,
} from '../common/franchise-roles';
import { DomainEventsService } from './domain-events.service';
import { StockTransferQueryDto } from './dto/stock-transfer-query.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { OrderType } from 'src/common/dto/query.dto';
import { IMeta } from 'src/common/interceptors/envelope.interface';

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEvents: DomainEventsService,
    private readonly audit: AuditService,
  ) { }
  private readonly stockTransferLineInclude = {
    product: { select: { id: true, name: true, slug: true } },
    variant: {
      select: {
        id: true,
        sku: true,
        attributeSummary: true,
        imageUrl: true,
      },
    },
  } as const;

  private buildTransportLaneSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'status']);

  async list(
    user: JwtUser,
    query: StockTransferQueryDto,
  ): Promise<{ data: StockTransfer[]; meta: IMeta }> {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
        OR: [
          {
            name: { contains: search, mode: 'insensitive' },
          },
          // {
          //   franchise: {
          //     name: { contains: search, mode: 'insensitive' },
          //   },
          // },
        ],
      }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.status) {
      clauses.push({ status: q.status });
    }

    if (query.fromNodeId) {
      clauses.push({ fromNodeId: q.fromNodeId });
    }

    if (query.toNodeId) {
      clauses.push({ toNodeId: q.toNodeId });
    }

    const allowedFranchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (
      user.role !== Role.SUPERADMIN &&
      franchiseHasReadAccess(user.role) &&
      allowedFranchiseId
    ) {
      clauses.push({ franchiseId: allowedFranchiseId });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildTransportLaneSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.stockTransfer as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        fromNode: true,
        toNode: true,
        lines: {
          include: this.stockTransferLineInclude,
        },
      },
    });

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;

    // if (user.role === Role.SUPERADMIN) {
    //   return this.prisma.stockTransfer.findMany({
    //     orderBy: { createdAt: 'desc' },
    //     take: 200,
    //     include: {
    //       fromNode: true,
    //       toNode: true,
    //       lines: {
    //         include: {
    //           product: { select: { id: true, name: true, slug: true } },
    //         },
    //       },
    //     },
    //   });
    // }
    // if (franchiseHasReadAccess(user.role) && user.franchiseId) {
    //   const node = await this.prisma.stockingNode.findFirst({
    //     where: { franchiseId: user.franchiseId },
    //   });
    //   if (!node) return [];
    //   return this.prisma.stockTransfer.findMany({
    //     where: {
    //       OR: [{ fromNodeId: node.id }, { toNodeId: node.id }],
    //     },
    //     orderBy: { createdAt: 'desc' },
    //     take: 100,
    //     include: {
    //       fromNode: true,
    //       toNode: true,
    //       lines: {
    //         include: {
    //           product: { select: { id: true, name: true, slug: true } },
    //         },
    //       },
    //     },
    //   });
    // }
    // return [];
  }

  async createDraft(
    user: JwtUser,
    body: {
      fromNodeId: string;
      toNodeId: string;
      note?: string;
      lines: { productId: string; variantId?: string; quantity: number }[];
    },
    ip: string,
  ) {
    if (user.role !== Role.SUPERADMIN) throw new ForbiddenException();
    if (body.fromNodeId === body.toNodeId)
      throw new BadRequestException('Nodes must differ');
    if (!body.lines?.length) throw new BadRequestException('At least one line');

    const uniqueProductIds = Array.from(
      new Set(body.lines.map((line) => line.productId)),
    );

    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueProductIds } },
      select: {
        id: true,
        variants: {
          select: {
            id: true,
            productId: true,
            isActive: true,
          },
        },
      },
    });

    if (products.length !== uniqueProductIds.length) {
      throw new BadRequestException('One or more products are missing');
    }

    const productById = new Map(
      products.map((product) => [product.id, product]),
    );

    const resolvedLines = body.lines.map((line) => {
      const product = productById.get(line.productId);

      if (!product) {
        throw new BadRequestException('One or more products are missing');
      }

      const variantId = line.variantId?.trim();
      const hasVariants = product.variants.length > 0;

      if (hasVariants && !variantId) {
        throw new BadRequestException('Please pass variantId');
      }

      let resolvedVariantId: string | null = null;

      if (variantId) {
        const variant = product.variants.find(
          (item) => item.id === variantId && item.isActive,
        );

        if (!variant) {
          throw new BadRequestException(
            `Variant ${variantId} does not belong to product ${line.productId}`,
          );
        }

        resolvedVariantId = variant.id;
      }

      return {
        productId: line.productId,
        variantId: resolvedVariantId,
        quantity: line.quantity,
      };
    });

    const t = await this.prisma.stockTransfer.create({
      data: {
        fromNodeId: body.fromNodeId,
        toNodeId: body.toNodeId,
        status: StockTransferStatus.DRAFT,
        note: body.note?.trim() || null,
        createdByUserId: user.sub,
        lines: {
          create: resolvedLines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantityRequested: l.quantity,
          })),
        },
      },
      include: {
        lines: { include: this.stockTransferLineInclude },
        fromNode: true,
        toNode: true,
      },
    });
    await this.domainEvents.emit(
      'inventory.transfer.draft_created',
      {
        transferId: t.id,
        fromNodeId: body.fromNodeId,
        toNodeId: body.toNodeId,
      },
      { refType: 'STOCK_TRANSFER', refId: t.id },
    );

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'STOCK_TRANSFER_CREATE',
        resource: 'STOCK_TRANSFER',
        resourceId: t.id,
        metadata: { fromNodeId: body.fromNodeId, toNodeId: body.toNodeId },
        ip
      }),
      'STOCK_TRANSFER_CREATE',
    );

    return t;
  }

  private async deductFromNode(
    tx: Prisma.TransactionClient,
    node: { id: string; type: StockingNodeType; franchiseId: string | null },
    productId: string,
    qty: number,
    user?: JwtUser,
    ip?: string,
  ) {
    if (node.type === StockingNodeType.CENTRAL_DC) {
      const ws = await tx.warehouseStock.findUnique({ where: { productId } });
      if (!ws || ws.quantity < qty)
        throw new BadRequestException('Insufficient DC stock');
      await tx.warehouseStock.update({
        where: { productId },
        data: { quantity: { decrement: qty } },
      });
      return;
    }
    if (node.type === StockingNodeType.REGIONAL_HUB) {
      const hi = await tx.hubInventory.findUnique({
        where: {
          stockingNodeId_productId: { stockingNodeId: node.id, productId },
        },
      });
      if (!hi || hi.quantity < qty)
        throw new BadRequestException('Insufficient hub stock');
      await tx.hubInventory.update({
        where: {
          stockingNodeId_productId: { stockingNodeId: node.id, productId },
        },
        data: { quantity: { decrement: qty } },
      });
      return;
    }
    if (node.type === StockingNodeType.STORE && node.franchiseId) {
      const vId = '';
      const fs = await tx.franchiseStock.findUnique({
        where: {
          franchiseId_productId_variantId: {
            franchiseId: node.franchiseId,
            productId,
            variantId: vId,
          },
        },
      });
      if (!fs || fs.quantity < qty)
        throw new BadRequestException('Insufficient store stock');
      await tx.franchiseStock.update({
        where: {
          franchiseId_productId_variantId: {
            franchiseId: node.franchiseId,
            productId,
            variantId: vId,
          },
        },
        data: { quantity: { decrement: qty } },
      });

      if (user) {
        fireAndForget(
          this.audit.log({
            userId: user.sub,
            action: 'franchise_stock.update',
            resource: 'FranchiseStock',
            resourceId: `${node.franchiseId}:${productId}:${vId}`,
            metadata: {
              franchiseId: node.franchiseId,
              productId,
              variantId: vId,
              actionType: 'DECREMENT',
              changeQuantity: qty,
              reason: 'Stock transfer deduct',
            },
            ip,
          }),
        );
      }
      return;
    }
    throw new BadRequestException('Unsupported source node');
  }

  private async addToNode(
    tx: Prisma.TransactionClient,
    node: { id: string; type: StockingNodeType; franchiseId: string | null },
    productId: string,
    qty: number,
    user?: JwtUser,
    ip?: string,
  ) {
    if (node.type === StockingNodeType.CENTRAL_DC) {
      await tx.warehouseStock.upsert({
        where: { productId },
        create: { productId, quantity: qty, lowStockThreshold: 5 },
        update: { quantity: { increment: qty } },
      });
      return;
    }
    if (node.type === StockingNodeType.REGIONAL_HUB) {
      await tx.hubInventory.upsert({
        where: {
          stockingNodeId_productId: { stockingNodeId: node.id, productId },
        },
        create: { stockingNodeId: node.id, productId, quantity: qty },
        update: { quantity: { increment: qty } },
      });
      return;
    }
    if (node.type === StockingNodeType.STORE && node.franchiseId) {
      const vId = '';
      await tx.franchiseStock.upsert({
        where: {
          franchiseId_productId_variantId: {
            franchiseId: node.franchiseId,
            productId,
            variantId: vId,
          },
        },
        create: {
          franchiseId: node.franchiseId,
          productId,
          variantId: vId,
          quantity: qty,
          lowStockThreshold: 5,
        },
        update: { quantity: { increment: qty } },
      });

      if (user) {
        fireAndForget(
          this.audit.log({
            userId: user.sub,
            action: 'franchise_stock.update',
            resource: 'FranchiseStock',
            resourceId: `${node.franchiseId}:${productId}`,
            metadata: {
              franchiseId: node.franchiseId,
              productId,
              actionType: 'INCREMENT',
              changeQuantity: qty,
              reason: 'Stock transfer add',
            },
            ip,
          }),
        );
      }
      return;
    }
    throw new BadRequestException('Unsupported destination node');
  }

  async setTransferStatus(
    user: JwtUser,
    transferId: string,
    status: StockTransferStatus,
    ip: string,
  ) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        lines: { include: this.stockTransferLineInclude },
        fromNode: true,
        toNode: true,
      },
    });

    if (!transfer) throw new NotFoundException('Transfer not found');

    if (status === StockTransferStatus.IN_TRANSIT) {
      if (transfer.status !== StockTransferStatus.APPROVED) {
        throw new BadRequestException('Approve before ship');
      }

      const updated = await this.prisma.stockTransfer.update({
        where: { id: transferId },
        data: { status },
        include: {
          lines: { include: this.stockTransferLineInclude },
          fromNode: true,
          toNode: true,
        },
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'stock_request_status.update',
          resource: 'StockTransfer',
          resourceId: updated.id,
          metadata: {
            from: {
              transferId,
              status: transfer.status
            },
            to: {
              transferId,
              status: updated.status
            }
          },
          ip,
        }),
        'stock_request.approve',
      );

      await this.domainEvents.emit(
        'inventory.transfer.in_transit',
        { transferId },
        { refType: 'STOCK_TRANSFER', refId: transferId },
      );

      return updated;
    }

    if (status === StockTransferStatus.DRAFT) {
      if (transfer.status !== StockTransferStatus.APPROVED) {
        throw new BadRequestException('Approve before ship');
      }

      const updated = await this.prisma.stockTransfer.update({
        where: { id: transferId },
        data: { status },
        include: {
          lines: { include: this.stockTransferLineInclude },
          fromNode: true,
          toNode: true,
        },
      });


      await this.domainEvents.emit(
        'inventory.transfer.in_draft',
        { transferId },
        { refType: 'STOCK_TRANSFER', refId: transferId },
      );

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'stock_request_status.update',
          resource: 'StockTransfer',
          resourceId: updated.id,
          metadata: {
            from: {
              transferId,
              status: transfer.status
            },
            to: {
              transferId,
              status: updated.status
            }
          },
          ip,
        }),
        'stock_request.approve',
      );

      return updated;
    }

    if (status === StockTransferStatus.APPROVED) {
      await this.prisma.$transaction(async (tx) => {
        for (const line of transfer.lines) {
          await this.deductFromNode(
            tx,
            transfer.fromNode,
            line.productId,
            line.quantityRequested,
            user,
          );
          await tx.stockTransferLine.update({
            where: { id: line.id },
            data: { quantityShipped: line.quantityRequested },
          });
        }
        await tx.stockTransfer.update({
          where: { id: transferId },
          data: { status: StockTransferStatus.APPROVED },
        });
      });

      await this.domainEvents.emit(
        'inventory.transfer.approved',
        { transferId },
        { refType: 'STOCK_TRANSFER', refId: transferId },
      );

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'stock_request_status.update',
          resource: 'StockTransfer',
          resourceId: transferId,
          metadata: {
            from: {
              transferId,
              status: transfer.status
            },
            to: {
              transferId,
              status: status
            }
          },
          ip,
        }),
        'stock_request.approve',
      );

      return this.prisma.stockTransfer.findUnique({
        where: { id: transferId },
        include: {
          lines: { include: this.stockTransferLineInclude },
          fromNode: true,
          toNode: true,
        },
      });
    }

    if (status === StockTransferStatus.RECEIVED) {
      return this.receive(transferId, user, ip);
    }
  }

  async approve(id: string, user: JwtUser) {
    if (user.role !== Role.SUPERADMIN) throw new ForbiddenException();
    const t = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        lines: { include: this.stockTransferLineInclude },
        fromNode: true,
        toNode: true,
      },
    });
    if (!t) throw new NotFoundException('Transfer not found');
    if (t.status !== StockTransferStatus.DRAFT)
      throw new BadRequestException('Not in DRAFT');
    await this.prisma.$transaction(async (tx) => {
      for (const line of t.lines) {
        await this.deductFromNode(
          tx,
          t.fromNode,
          line.productId,
          line.quantityRequested,
          user,
        );
        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: { quantityShipped: line.quantityRequested },
        });
      }
      await tx.stockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.APPROVED },
      });
    });
    await this.domainEvents.emit(
      'inventory.transfer.approved',
      { transferId: id },
      { refType: 'STOCK_TRANSFER', refId: id },
    );
    const result = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        lines: { include: this.stockTransferLineInclude },
        fromNode: true,
        toNode: true,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'STOCK_TRANSFER_APPROVE',
        resource: 'STOCK_TRANSFER',
        resourceId: id,
        metadata: {
          fromNodeId: result?.fromNodeId,
          toNodeId: result?.toNodeId,
        },
      }),
      'STOCK_TRANSFER_APPROVE',
    );

    return result;
  }

  async ship(id: string, user: JwtUser) {
    if (user.role !== Role.SUPERADMIN) throw new ForbiddenException();
    const t = await this.prisma.stockTransfer.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Transfer not found');
    if (t.status !== StockTransferStatus.APPROVED)
      throw new BadRequestException('Approve before ship');
    const updated = await this.prisma.stockTransfer.update({
      where: { id },
      data: { status: StockTransferStatus.IN_TRANSIT },
      include: {
        lines: { include: this.stockTransferLineInclude },
        fromNode: true,
        toNode: true,
      },
    });
    await this.domainEvents.emit(
      'inventory.transfer.in_transit',
      { transferId: id },
      { refType: 'STOCK_TRANSFER', refId: id },
    );

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'STOCK_TRANSFER_SHIP_UPDATE',
        resource: 'STOCK_TRANSFER',
        resourceId: id,
        metadata: {
          fromNodeId: updated.fromNodeId,
          toNodeId: updated.toNodeId,
        },
      }),
      'STOCK_TRANSFER_SHIP_UPDATE',
    );

    return updated;
  }

  async receive(id: string, user: JwtUser, ip?: string) {
    const t = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        lines: { include: this.stockTransferLineInclude },
        fromNode: true,
        toNode: true,
      },
    });
    if (!t) throw new NotFoundException('Transfer not found');
    if (t.status !== StockTransferStatus.IN_TRANSIT)
      throw new BadRequestException('Not in transit');
    if (user.role === Role.SUPERADMIN) {
      // ok
    } else if (
      franchiseCanMutate(user.role) &&
      (user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId === t.toNode.franchiseId
        : user.franchiseId === t.toNode.franchiseId)
    ) {
      // ok
    } else {
      throw new ForbiddenException();
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of t.lines) {
        const qty = line.quantityShipped ?? line.quantityRequested;
        await this.addToNode(tx, t.toNode, line.productId, qty, user);
        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: { quantityReceived: qty },
        });
      }
      await tx.stockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.RECEIVED },
      });
    });
    await this.domainEvents.emit(
      'inventory.transfer.received',
      { transferId: id, toNodeId: t.toNodeId },
      { refType: 'STOCK_TRANSFER', refId: id, stockingNodeId: t.toNodeId },
    );

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'stock_request_status.update',
        resource: 'StockTransfer',
        resourceId: id,
        metadata: {
          from: {
            transferId: id,
            status: t.status
          },
          to: {
            transferId: id,
            status: StockTransferStatus.RECEIVED
          }
        },
        ip,
      }),
      'stock_request.approve',
    );

    return this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        lines: { include: this.stockTransferLineInclude },
        fromNode: true,
        toNode: true,
      },
    });
  }
}
