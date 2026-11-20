import { BadRequestException, Injectable } from '@nestjs/common';
import {
  InventoryReservationKind,
  InventoryReservationStatus,
  Prisma,
  OrderStatus,
  OnlinePaymentStatus,
} from '@prisma/client';
import { RedisService } from 'src/redis/redis.service';

type ReservationLine = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

@Injectable()
export class InventoryReservationService {
  constructor(private readonly redisService: RedisService) {}

  private async invalidateProductCache(productId: string) {
    try {
      await Promise.all([
        this.redisService.del([`product:${productId}`, `web_product:${productId}`]),
        this.redisService.clearCacheByPrefix('web_product:featured'),
        this.redisService.clearCacheByPrefix('web_product:deals'),
        this.redisService.clearCacheByPrefix('web_product:recommended'),
        this.redisService.clearCacheByPrefix('web_product:trending'),
        this.redisService.clearCacheByPrefix('web_product:related'),
      ]);
    } catch (err) {
      // Ignored
    }
  }
  private async isWarehouseFranchise(
    db: any,
    franchiseId: string | null,
  ): Promise<boolean> {
    if (!franchiseId) return false;
    const franchise = await db.franchise.findUnique({
      where: { id: franchiseId },
      select: { code: true },
    });
    return franchise?.code === 'CENTRAL_WAREHOUSE';
  }

  async reserveForOrder(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      requestId: string;
      proposalId?: string | null;
      franchiseId: string;
      items: ReservationLine[];
      expiresAt: Date;
      note?: string | null;
    },
  ) {
    const productIds = input.items.map((item) => item.productId);
    const db = tx as any;

    const isWarehouse = await this.isWarehouseFranchise(db, input.franchiseId);

    if (isWarehouse) {
      let stocks: any[] = await db.warehouseStock.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, quantity: true, reserved: true },
      });

      const existingProductIds = new Set(stocks.map((s: any) => s.productId));
      const missingProductIds = productIds.filter((id) => !existingProductIds.has(id));

      if (missingProductIds.length > 0) {
        const productsWithStock = await db.product.findMany({
          where: { id: { in: missingProductIds } },
          select: {
            id: true,
            stock: true,
            variants: { select: { stock: true } },
          },
        });

        for (const p of productsWithStock) {
          const hasVariants = p.variants && p.variants.length > 0;
          let expectedStock = hasVariants
            ? p.variants.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0)
            : (p.stock ?? 0);

          if (expectedStock > 2147483647) {
            expectedStock = 999999;
          }

          const newStock = await db.warehouseStock.upsert({
            where: { productId: p.id },
            create: {
              productId: p.id,
              quantity: expectedStock,
              lowStockThreshold: 5,
              reserved: 0,
            },
            update: {},
            select: { productId: true, quantity: true, reserved: true },
          });

          stocks.push(newStock);
        }
      }

      const stockMap = new Map(
        stocks.map((stock: any) => [stock.productId, stock] as const),
      );

      for (const line of input.items) {
        const stock = stockMap.get(line.productId);
        const available = (stock?.quantity ?? 0) - (stock?.reserved ?? 0);
        if (!stock || available < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${line.productId} in central warehouse`,
          );
        }
      }

      for (const line of input.items) {
        await db.warehouseStock.update({
          where: { productId: line.productId },
          data: { reserved: { increment: line.quantity } },
        });
      }
    } else {
      const stocks: any[] = await db.franchiseStock.findMany({
        where: {
          franchiseId: input.franchiseId,
          productId: { in: productIds },
        },
        select: {
          franchiseId: true,
          productId: true,
          quantity: true,
          reserved: true,
        },
      });

      const stockMap = new Map(
        stocks.map((stock: any) => [stock.productId, stock] as const),
      );

      for (const line of input.items) {
        const stock = stockMap.get(line.productId);
        const available = (stock?.quantity ?? 0) - (stock?.reserved ?? 0);
        if (!stock || available < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${line.productId}`,
          );
        }
      }

      for (const line of input.items) {
        const vId = line.variantId || '';
        const fs = await db.franchiseStock.findFirst({
          where: {
            franchiseId: input.franchiseId,
            productId: line.productId,
            variantId: vId,
          },
        });
        const targetVId = fs ? vId : '';
        await db.franchiseStock.update({
          where: {
            franchiseId_productId_variantId: {
              franchiseId: input.franchiseId,
              productId: line.productId,
              variantId: targetVId,
            },
          },
          data: { reserved: { increment: line.quantity } },
        });
      }
    }

    await db.inventoryReservation.createMany({
      data: input.items.map((line) => {
        let noteValue = input.note ?? 'Reserved for accepted franchise order';
        if (line.variantId) {
          noteValue = `__variantId:${line.variantId}__ ${noteValue}`;
        }
        return {
          kind: InventoryReservationKind.OUTLET_ONLINE_ORDER,
          status: InventoryReservationStatus.ACTIVE,
          productId: line.productId,
          quantity: line.quantity,
          franchiseId: input.franchiseId,
          orderId: input.orderId,
          orderRequestId: input.requestId,
          proposalId: input.proposalId ?? undefined,
          expiresAt: input.expiresAt,
          note: noteValue,
        };
      }),
    });

    for (const item of input.items) {
      await this.invalidateProductCache(item.productId);
    }

    return db.inventoryReservation.findMany({
      where: {
        orderId: input.orderId,
        orderRequestId: input.requestId,
        proposalId: input.proposalId ?? undefined,
        status: InventoryReservationStatus.ACTIVE,
      },
    });
  }

  async consumeOrderReservations(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const db = tx as any;
    const reservations: any[] = await db.inventoryReservation.findMany({
      where: {
        orderId,
        status: InventoryReservationStatus.ACTIVE,
      },
    });

    for (const reservation of reservations) {
      const isWarehouse = await this.isWarehouseFranchise(
        db,
        reservation.franchiseId,
      );

      if (isWarehouse) {
        const stock = await db.warehouseStock.findUnique({
          where: { productId: reservation.productId },
          select: { quantity: true, reserved: true },
        });

        if (!stock || stock.reserved < reservation.quantity) {
          throw new BadRequestException(
            `Warehouse reservation is out of sync for product ${reservation.productId}`,
          );
        }

        await db.warehouseStock.update({
          where: { productId: reservation.productId },
          data: {
            quantity: { decrement: reservation.quantity },
            reserved: { decrement: reservation.quantity },
          },
        });
      } else {
        let vId = '';
        if (reservation.note && reservation.note.includes('__variantId:')) {
          const match = reservation.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
          if (match && match[1]) vId = match[1];
        }
        const fs = await db.franchiseStock.findFirst({
          where: {
            franchiseId: reservation.franchiseId!,
            productId: reservation.productId,
            variantId: vId,
          },
        });
        const targetVId = fs ? vId : '';
        const stock = fs || await db.franchiseStock.findFirst({
          where: {
            franchiseId: reservation.franchiseId!,
            productId: reservation.productId,
          },
        });

        if (!stock || stock.reserved < reservation.quantity) {
          throw new BadRequestException(
            `Reservation is out of sync for product ${reservation.productId}`,
          );
        }

        await db.franchiseStock.update({
          where: {
            franchiseId_productId_variantId: {
              franchiseId: reservation.franchiseId!,
              productId: reservation.productId,
              variantId: stock.variantId ?? targetVId,
            },
          },
          data: {
            quantity: { decrement: reservation.quantity },
            reserved: { decrement: reservation.quantity },
          },
        });
      }

      await db.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: InventoryReservationStatus.CONSUMED,
          consumedAt: new Date(),
          note: reservation.note ?? 'Consumed by paid order',
        },
      });
      await this.invalidateProductCache(reservation.productId);
    }
  }

  async releaseOrderReservations(
    tx: Prisma.TransactionClient,
    orderId: string,
    note = 'Released from cancelled or expired order',
  ) {
    const db = tx as any;
    const reservations: any[] = await db.inventoryReservation.findMany({
      where: {
        orderId,
        status: InventoryReservationStatus.ACTIVE,
      },
    });

    for (const reservation of reservations) {
      const isWarehouse = await this.isWarehouseFranchise(
        db,
        reservation.franchiseId,
      );

      if (isWarehouse) {
        const stock = await db.warehouseStock.findUnique({
          where: { productId: reservation.productId },
          select: { reserved: true },
        });

        if (!stock || stock.reserved < reservation.quantity) {
          throw new BadRequestException(
            `Warehouse reservation is out of sync for product ${reservation.productId}`,
          );
        }

        await db.warehouseStock.update({
          where: { productId: reservation.productId },
          data: { reserved: { decrement: reservation.quantity } },
        });
      } else {
        let vId = '';
        if (reservation.note && reservation.note.includes('__variantId:')) {
          const match = reservation.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
          if (match && match[1]) vId = match[1];
        }
        const fs = await db.franchiseStock.findFirst({
          where: {
            franchiseId: reservation.franchiseId!,
            productId: reservation.productId,
            variantId: vId,
          },
        });
        const stock = fs || await db.franchiseStock.findFirst({
          where: {
            franchiseId: reservation.franchiseId!,
            productId: reservation.productId,
          },
        });

        if (!stock || stock.reserved < reservation.quantity) {
          throw new BadRequestException(
            `Reservation is out of sync for product ${reservation.productId}`,
          );
        }

        await db.franchiseStock.update({
          where: {
            franchiseId_productId_variantId: {
              franchiseId: reservation.franchiseId!,
              productId: reservation.productId,
              variantId: stock.variantId ?? '',
            },
          },
          data: {
            reserved: { decrement: reservation.quantity },
          },
        });
      }

      await db.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: InventoryReservationStatus.RELEASED,
          releasedAt: new Date(),
          note,
        },
      });
      await this.invalidateProductCache(reservation.productId);
    }
  }

  async releaseProposalReservations(
    tx: Prisma.TransactionClient,
    proposalId: string,
    note = 'Released because proposal expired or was cancelled',
  ) {
    const db = tx as any;
    const reservations: any[] = await db.inventoryReservation.findMany({
      where: {
        proposalId,
        status: InventoryReservationStatus.ACTIVE,
      },
    });

    for (const reservation of reservations) {
      const isWarehouse = await this.isWarehouseFranchise(
        db,
        reservation.franchiseId,
      );

      if (isWarehouse) {
        const stock = await tx.warehouseStock.findUnique({
          where: { productId: reservation.productId },
          select: { reserved: true },
        });

        if (!stock || stock.reserved < reservation.quantity) {
          continue;
        }

        await tx.warehouseStock.update({
          where: { productId: reservation.productId },
          data: { reserved: { decrement: reservation.quantity } },
        });
      } else {
        let vId = '';
        if (reservation.note && reservation.note.includes('__variantId:')) {
          const match = reservation.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
          if (match && match[1]) vId = match[1];
        }
        const fs = await tx.franchiseStock.findFirst({
          where: {
            franchiseId: reservation.franchiseId!,
            productId: reservation.productId,
            variantId: vId,
          },
        });
        const stock = fs || await tx.franchiseStock.findFirst({
          where: {
            franchiseId: reservation.franchiseId!,
            productId: reservation.productId,
          },
        });

        if (!stock || stock.reserved < reservation.quantity) {
          continue;
        }

        await tx.franchiseStock.update({
          where: {
            franchiseId_productId_variantId: {
              franchiseId: reservation.franchiseId!,
              productId: reservation.productId,
              variantId: stock.variantId ?? '',
            },
          },
          data: {
            reserved: { decrement: reservation.quantity },
          },
        });
      }

      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: InventoryReservationStatus.RELEASED,
          releasedAt: new Date(),
          note,
        },
      });
      await this.invalidateProductCache(reservation.productId);
    }
  }

  async consumeOrReleaseExpiredReservations(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const db = tx as any;
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true, onlinePaymentStatus: true },
    });
    if (!order) {
      return;
    }

    if (order.onlinePaymentStatus === OnlinePaymentStatus.PAID) {
      await this.consumeOrderReservations(tx, orderId);
      return;
    }

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.RETURNED
    ) {
      await this.releaseOrderReservations(tx, orderId);
    }
  }

  async releaseRequestReservations(
    tx: Prisma.TransactionClient,
    orderRequestId: string,
    note = 'Released because allocation request failed or moved',
  ) {
    const db = tx as any;
    const reservations: any[] = await db.inventoryReservation.findMany({
      where: {
        orderRequestId,
        status: InventoryReservationStatus.ACTIVE,
      },
    });

    for (const reservation of reservations) {
      const isWarehouse = await this.isWarehouseFranchise(
        db,
        reservation.franchiseId,
      );

      if (isWarehouse) {
        const stock = await db.warehouseStock.findUnique({
          where: { productId: reservation.productId },
          select: { reserved: true },
        });

        if (!stock || stock.reserved < reservation.quantity) {
          continue;
        }

        await db.warehouseStock.update({
          where: { productId: reservation.productId },
          data: { reserved: { decrement: reservation.quantity } },
        });
      } else {
        let vId = '';
        if (reservation.note && reservation.note.includes('__variantId:')) {
          const match = reservation.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
          if (match && match[1]) vId = match[1];
        }
        const fs = await db.franchiseStock.findFirst({
          where: {
            franchiseId: reservation.franchiseId!,
            productId: reservation.productId,
            variantId: vId,
          },
        });
        const stock = fs || await db.franchiseStock.findFirst({
          where: {
            franchiseId: reservation.franchiseId!,
            productId: reservation.productId,
          },
        });

        if (!stock || stock.reserved < reservation.quantity) {
          continue;
        }

        await db.franchiseStock.update({
          where: {
            franchiseId_productId_variantId: {
              franchiseId: reservation.franchiseId!,
              productId: reservation.productId,
              variantId: stock.variantId ?? '',
            },
          },
          data: {
            reserved: { decrement: reservation.quantity },
          },
        });
      }

      await db.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: InventoryReservationStatus.RELEASED,
          releasedAt: new Date(),
          note,
        },
      });
      await this.invalidateProductCache(reservation.productId);
    }
  }

  async releaseConsumedOrderReservations(
    tx: Prisma.TransactionClient,
    orderId: string,
    note = 'Released from cancelled confirmed order',
  ) {
    const db = tx as any;
    const reservations: any[] = await db.inventoryReservation.findMany({
      where: {
        orderId,
        status: InventoryReservationStatus.CONSUMED,
      },
    });

    for (const reservation of reservations) {
      const isWarehouse = await this.isWarehouseFranchise(
        db,
        reservation.franchiseId,
      );

      if (isWarehouse) {
        await db.warehouseStock.update({
          where: { productId: reservation.productId },
          data: { quantity: { increment: reservation.quantity } },
        });
      } else {
        let vId = '';
        if (reservation.note && reservation.note.includes('__variantId:')) {
          const match = reservation.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
          if (match && match[1]) vId = match[1];
        }
        const fs = await db.franchiseStock.findFirst({
          where: {
            franchiseId: reservation.franchiseId!,
            productId: reservation.productId,
            variantId: vId,
          },
        });
        const targetVId = fs ? vId : '';
        await db.franchiseStock.update({
          where: {
            franchiseId_productId_variantId: {
              franchiseId: reservation.franchiseId!,
              productId: reservation.productId,
              variantId: targetVId,
            },
          },
          data: { quantity: { increment: reservation.quantity } },
        });
      }

      await db.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: InventoryReservationStatus.RELEASED,
          releasedAt: new Date(),
          note,
        },
      });
      await this.invalidateProductCache(reservation.productId);
    }
  }
}

