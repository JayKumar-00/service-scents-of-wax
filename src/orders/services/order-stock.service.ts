import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrderStockService {
  async consumeRetailCustomerOrderStock(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      franchiseId: string;
      retailCustomerId: string | null;
      items: Array<{
        productId: string;
        variantId?: string | null;
        quantity: number;
      }>;
    },
  ) {
    if (!order.retailCustomerId) {
      return;
    }

    const stocks = await tx.franchiseStock.findMany({
      where: {
        franchiseId: order.franchiseId,
        productId: { in: order.items.map((item) => item.productId) },
      },
    });

    type FranchiseStockRow = Awaited<typeof stocks>[number];

    for (const line of order.items) {
      const vId = line.variantId || '';
      const stock = stocks.find(
        (s: FranchiseStockRow) => s.productId === line.productId && s.variantId === vId,
      ) || stocks.find((s: FranchiseStockRow) => s.productId === line.productId && s.variantId === '');
      if (!stock || stock.quantity < line.quantity) {
        throw new BadRequestException(
          `Insufficient stock at outlet for product ${line.productId}. Try again or cancel the order.`,
        );
      }
    }

    for (const line of order.items) {
      const vId = line.variantId || '';
      const matchingStock = stocks.find(
        (s: FranchiseStockRow) => s.productId === line.productId && s.variantId === vId,
      );
      const targetVariantId = matchingStock ? vId : '';
      await tx.franchiseStock.update({
        where: {
          franchiseId_productId_variantId: {
            franchiseId: order.franchiseId,
            productId: line.productId,
            variantId: targetVariantId,
          },
        },
        data: {
          quantity: { decrement: line.quantity },
        },
      });
    }
  }
}
