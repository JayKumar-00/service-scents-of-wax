import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ReturnCondition,
  ReturnSourceType,
  ReturnStatus,
  ReturnInventoryKind,
  ReturnConflictInventoryStatus,
  ReturnType,
  DefectiveSource,
  ReturnMovementType,
  WarehouseDisposition,
} from '@prisma/client';

@Injectable()
export class ReturnInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records receipt of customer returns (Customer -> ReturnInventory)
   * Logs CUSTOMER_TO_RETURN ledger.
   */
  async recordCustomerToReturn(
    tx: any,
    request: any,
    user: any,
    receivedFranchiseId: string | null,
  ): Promise<void> {
    if (!receivedFranchiseId) {
      throw new BadRequestException(
        'Franchise ID is required to receive returns.',
      );
    }

    for (const item of request.items) {
      const qty = item.requestedQty;
      if (qty <= 0) continue;

      // Increment ReturnInventory (associated with franchise)
      await tx.returnInventory.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          franchiseId: receivedFranchiseId,
          quantity: qty,
          sourceType: request.sourceType,
          sourceId: request.id,
          kind: ReturnInventoryKind.RETURN,
          status: ReturnConflictInventoryStatus.PENDING_QC,
        },
      });

      // Log movement: CUSTOMER_TO_RETURN
      await tx.inventoryMovement.create({
        data: {
          returnRequestId: request.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: qty,
          type: 'CUSTOMER_TO_RETURN',
        },
      });

      await tx.returnInventoryMovement.create({
        data: {
          returnRequestId: request.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: qty,
          movementType: ReturnMovementType.CUSTOMER_TO_RETURN,
        },
      });
    }
  }

  /**
   * Records receipt of franchise stock returns at warehouse (Franchise -> ReturnInventory)
   * Logs FRANCHISE_TO_RETURN ledger.
   */
  async recordFranchiseToReturn(
    tx: any,
    request: any,
    user: any,
  ): Promise<void> {
    for (const item of request.items) {
      const qty = item.requestedQty;
      if (qty <= 0) continue;

      // Decrement the corresponding items from the sending franchise's DefectiveInventory
      const defectiveRec = await tx.defectiveInventory.findFirst({
        where: {
          franchiseId: request.franchiseId,
          productId: item.productId,
          variantId: item.variantId ?? null,
        },
      });

      if (defectiveRec) {
        if (defectiveRec.quantity <= qty) {
          await tx.defectiveInventory.delete({
            where: { id: defectiveRec.id },
          });
        } else {
          await tx.defectiveInventory.update({
            where: { id: defectiveRec.id },
            data: {
              quantity: { decrement: qty },
            },
          });
        }
      }

      // Increment ReturnInventory (associated with franchise return to warehouse)
      await tx.returnInventory.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          franchiseId: request.franchiseId,
          quantity: qty,
          sourceType: request.sourceType,
          sourceId: request.id,
          kind: ReturnInventoryKind.RETURN,
          status: ReturnConflictInventoryStatus.PENDING_QC,
        },
      });

      // Log movement: FRANCHISE_TO_RETURN
      await tx.inventoryMovement.create({
        data: {
          returnRequestId: request.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: qty,
          type: 'FRANCHISE_TO_RETURN',
        },
      });

      await tx.returnInventoryMovement.create({
        data: {
          returnRequestId: request.id,
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: qty,
          movementType: ReturnMovementType.FRANCHISE_TO_RETURN,
        },
      });
    }
  }

  /**
   * Validates and deducts exchange items from franchise stock if not already done.
   * Logs FRANCHISE_TO_CUSTOMER ledger.
   */
  async validateAndDeductExchangeItems(tx: any, request: any): Promise<void> {
    if (
      request.returnType !== ReturnType.EXCHANGE &&
      request.returnType !== ReturnType.SAME_PRODUCT_EXCHANGE
    )
      return;

    // Check if we already have FRANCHISE_TO_CUSTOMER movements for this request
    const existingMovement = await tx.inventoryMovement.findFirst({
      where: {
        returnRequestId: request.id,
        type: 'FRANCHISE_TO_CUSTOMER',
      },
    });

    // If it was already deducted at creation (POS Exchange), do nothing
    if (existingMovement) {
      return;
    }

    // Otherwise, validate and deduct now
    if (!request.exchangeItems || request.exchangeItems.length === 0) {
      throw new BadRequestException(
        'Exchange items are required to create an exchange order.',
      );
    }

    const franchiseId = request.franchiseId;
    if (!franchiseId) {
      throw new BadRequestException(
        'No franchise linked to this return request.',
      );
    }

    for (const exItem of request.exchangeItems) {
      const vId = exItem.variantId || '';
      const fsStock = await tx.franchiseStock.findUnique({
        where: {
          franchiseId_productId_variantId: {
            franchiseId,
            productId: exItem.productId,
            variantId: vId,
          },
        },
      });

      const availableStock =
        (fsStock?.quantity ?? 0) - (fsStock?.reserved ?? 0);
      if (availableStock < exItem.quantity) {
        throw new BadRequestException(
          `Insufficient stock for replacement product (ID: ${exItem.productId}) at this franchise. Available: ${availableStock}, Required: ${exItem.quantity}`,
        );
      }

      // Decrement FranchiseStock
      await tx.franchiseStock.update({
        where: {
          franchiseId_productId_variantId: {
            franchiseId,
            productId: exItem.productId,
            variantId: vId,
          },
        },
        data: {
          quantity: { decrement: exItem.quantity },
        },
      });

      // Log movement: FRANCHISE_TO_CUSTOMER
      await tx.inventoryMovement.create({
        data: {
          returnRequestId: request.id,
          productId: exItem.productId,
          variantId: exItem.variantId ?? null,
          quantity: exItem.quantity,
          type: 'FRANCHISE_TO_CUSTOMER',
        },
      });

      await tx.returnInventoryMovement.create({
        data: {
          returnRequestId: request.id,
          productId: exItem.productId,
          variantId: exItem.variantId ?? null,
          quantity: exItem.quantity,
          movementType: ReturnMovementType.FRANCHISE_TO_CUSTOMER,
        },
      });
    }
  }

  /**
   * Main entry point to process inventory adjustments upon QC assessment completion.
   * Runs inside a transaction context (tx).
   */
  async processQcInventoryMovement(
    tx: any,
    request: {
      id: string;
      sourceType: ReturnSourceType;
      franchiseId: string | null;
      customerId?: string | null;
    },
    item: {
      productId: string;
      variantId: string | null;
      approvedQty: number | null;
      receivedQty: number | null;
      requestedQty: number;
      condition: ReturnCondition | null;
      warehouseDisposition?: WarehouseDisposition | null;
    },
    targetStatus?: ReturnStatus,
  ): Promise<void> {
    const qtyToProcess =
      item.approvedQty ?? item.receivedQty ?? item.requestedQty;
    if (qtyToProcess <= 0) {
      return;
    }

    const condition = item.condition ?? ReturnCondition.GOOD;
    const franchiseId = request.franchiseId;

    if (!franchiseId) {
      throw new BadRequestException(
        'Franchise ID is required to process return inventory movement.',
      );
    }

    // 1. Decrement ReturnInventory (RETURN kind, PENDING_QC status) that was received
    const retInvRecord = await tx.returnInventory.findFirst({
      where: {
        sourceType: request.sourceType,
        sourceId: request.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        kind: ReturnInventoryKind.RETURN,
        status: ReturnConflictInventoryStatus.PENDING_QC,
      },
    });

    if (retInvRecord) {
      if (retInvRecord.quantity <= qtyToProcess) {
        await tx.returnInventory.delete({
          where: { id: retInvRecord.id },
        });
      } else {
        await tx.returnInventory.update({
          where: { id: retInvRecord.id },
          data: {
            quantity: { decrement: qtyToProcess },
          },
        });
      }
    }

    // Check if warehouse QC processing is needed
    if (targetStatus === ReturnStatus.WAREHOUSE_QC) {
      const warehouseDisp =
        item.warehouseDisposition ?? WarehouseDisposition.RESTOCK;

      let ledgerMovementType: any;
      let returnMovementType: ReturnMovementType;

      if (warehouseDisp === WarehouseDisposition.RESTOCK) {
        ledgerMovementType = 'RETURN_TO_WAREHOUSE';
        returnMovementType = ReturnMovementType.RETURN_TO_WAREHOUSE;

        // Franchise Stock Return -> Warehouse Stock++
        await tx.warehouseStock.upsert({
          where: {
            productId: item.productId,
          },
          create: {
            productId: item.productId,
            quantity: qtyToProcess,
          },
          update: {
            quantity: { increment: qtyToProcess },
          },
        });

        // Sync Product and ProductVariant base stocks
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: qtyToProcess },
          },
        });

        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: qtyToProcess },
            },
          });
        }
      } else {
        // REPAIR, SCRAP, FRANCHISE_CLAIM -> increment central DefectiveInventory
        ledgerMovementType = 'RETURN_TO_DEFECTIVE';
        returnMovementType = ReturnMovementType.RETURN_TO_DEFECTIVE;

        const warehouseFranchise = await tx.franchise.findFirst({
          where: { code: 'CENTRAL_WAREHOUSE' },
        });
        const targetFranchiseId = warehouseFranchise?.id;
        if (!targetFranchiseId) {
          throw new BadRequestException(
            'Central warehouse franchise not found.',
          );
        }

        const existingDefective = await tx.defectiveInventory.findFirst({
          where: {
            franchiseId: targetFranchiseId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            source: DefectiveSource.FRANCHISE_STOCK,
          },
        });

        if (existingDefective) {
          await tx.defectiveInventory.update({
            where: { id: existingDefective.id },
            data: { quantity: { increment: qtyToProcess } },
          });
        } else {
          await tx.defectiveInventory.create({
            data: {
              franchiseId: targetFranchiseId,
              productId: item.productId,
              variantId: item.variantId ?? null,
              quantity: qtyToProcess,
              source: DefectiveSource.FRANCHISE_STOCK,
            },
          });
        }
      }

      // Log the movement ledger entry in both legacy and new auditing tables
      await tx.inventoryMovement.create({
        data: {
          returnRequestId: request.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: qtyToProcess,
          type: ledgerMovementType,
        },
      });

      await tx.returnInventoryMovement.create({
        data: {
          returnRequestId: request.id,
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: qtyToProcess,
          movementType: returnMovementType,
        },
      });

      return;
    }

    // Determine target ledger movement type (Franchise QC)
    let ledgerMovementType: any;
    let returnMovementType: ReturnMovementType;

    if (condition === ReturnCondition.GOOD) {
      ledgerMovementType =
        request.sourceType === ReturnSourceType.CUSTOMER_ORDER
          ? 'RETURN_TO_FRANCHISE'
          : 'RETURN_TO_WAREHOUSE';
      returnMovementType =
        request.sourceType === ReturnSourceType.CUSTOMER_ORDER
          ? ReturnMovementType.RETURN_TO_FRANCHISE
          : ReturnMovementType.RETURN_TO_WAREHOUSE;
    } else if (condition === ReturnCondition.DEFECTIVE) {
      ledgerMovementType = 'RETURN_TO_DEFECTIVE';
      returnMovementType = ReturnMovementType.RETURN_TO_DEFECTIVE;
    } else {
      ledgerMovementType = 'RETURN_TO_BLOCKED';
      returnMovementType = ReturnMovementType.RETURN_TO_BLOCKED;
    }

    // 2. Isolate defective/blocked items in their dedicated tables
    if (condition === ReturnCondition.DEFECTIVE) {
      const existingDefective = await tx.defectiveInventory.findFirst({
        where: {
          franchiseId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          source:
            request.sourceType === ReturnSourceType.CUSTOMER_ORDER
              ? DefectiveSource.CUSTOMER_RETURN
              : DefectiveSource.FRANCHISE_STOCK,
        },
      });

      if (existingDefective) {
        await tx.defectiveInventory.update({
          where: { id: existingDefective.id },
          data: { quantity: { increment: qtyToProcess } },
        });
      } else {
        await tx.defectiveInventory.create({
          data: {
            franchiseId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: qtyToProcess,
            source:
              request.sourceType === ReturnSourceType.CUSTOMER_ORDER
                ? DefectiveSource.CUSTOMER_RETURN
                : DefectiveSource.FRANCHISE_STOCK,
          },
        });
      }
    } else if (condition === ReturnCondition.CONFLICT) {
      const existingBlocked = await tx.blockedInventory.findFirst({
        where: {
          franchiseId,
          productId: item.productId,
          variantId: item.variantId ?? null,
        },
      });

      if (existingBlocked) {
        await tx.blockedInventory.update({
          where: { id: existingBlocked.id },
          data: { quantity: { increment: qtyToProcess } },
        });
      } else {
        await tx.blockedInventory.create({
          data: {
            franchiseId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: qtyToProcess,
          },
        });
      }
    }

    // Log the movement ledger entry in both legacy and new auditing tables
    await tx.inventoryMovement.create({
      data: {
        returnRequestId: request.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: qtyToProcess,
        type: ledgerMovementType,
      },
    });

    await tx.returnInventoryMovement.create({
      data: {
        returnRequestId: request.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: qtyToProcess,
        movementType: returnMovementType,
      },
    });

    // 3. Perform Stock++ adjustments for GOOD condition items
    if (condition === ReturnCondition.GOOD) {
      if (request.sourceType === ReturnSourceType.CUSTOMER_ORDER) {
        // Customer Order Return -> Franchise Stock++
        const vId = item.variantId || '';
        await tx.franchiseStock.upsert({
          where: {
            franchiseId_productId_variantId: {
              franchiseId,
              productId: item.productId,
              variantId: vId,
            },
          },
          create: {
            franchiseId,
            productId: item.productId,
            variantId: vId,
            quantity: qtyToProcess,
          },
          update: {
            quantity: { increment: qtyToProcess },
          },
        });
      } else if (request.sourceType === ReturnSourceType.STOCK_REQUEST) {
        // Franchise Stock Return -> Warehouse Stock++
        await tx.warehouseStock.upsert({
          where: {
            productId: item.productId,
          },
          create: {
            productId: item.productId,
            quantity: qtyToProcess,
          },
          update: {
            quantity: { increment: qtyToProcess },
          },
        });

        // Sync Product and ProductVariant base stocks
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: qtyToProcess },
          },
        });

        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: qtyToProcess },
            },
          });
        }
      }
    }
  }
}
