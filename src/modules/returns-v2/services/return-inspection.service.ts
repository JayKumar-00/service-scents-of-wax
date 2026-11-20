import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReturnInventoryService } from './return-inventory.service';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { JwtUser } from '../../../auth/types/jwt-user.type';
import {
  InspectionResult,
  ReturnStatus,
  ReturnCondition,
  ReturnType,
  ReturnSourceType,
  WarehouseDisposition,
} from '@prisma/client';

@Injectable()
export class ReturnInspectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: ReturnInventoryService,
  ) {}

  /**
   * Completes the QC/Inspection process.
   * Assessment results are written to items and inventory movements are generated.
   * Runs inside a transaction context (tx).
   */
  async completeInspection(
    tx: any,
    request: any,
    dto: UpdateStatusDto,
    user: JwtUser,
  ): Promise<void> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'Detailed items assessment is required to complete inspection.',
      );
    }

    // 1. Process each item assessment
    for (const itemUpdate of dto.items) {
      const dbItem = request.items.find((i: any) => i.id === itemUpdate.id);
      if (!dbItem) {
        throw new NotFoundException(
          `Item with ID ${itemUpdate.id} not found in this return request.`,
        );
      }

      const receivedQty = itemUpdate.receivedQty ?? dbItem.requestedQty;
      const approvedQty = itemUpdate.approvedQty ?? receivedQty;
      const condition = itemUpdate.condition ?? ReturnCondition.GOOD;
      const warehouseDisposition = itemUpdate.warehouseDisposition ?? null;

      // Update the ReturnItem in DB
      await tx.returnItem.update({
        where: { id: itemUpdate.id },
        data: {
          receivedQty,
          approvedQty,
          condition,
          warehouseDisposition,
          remarks: itemUpdate.remarks ?? dbItem.remarks,
        },
      });

      // Execute appropriate inventory movements
      await this.inventoryService.processQcInventoryMovement(
        tx,
        request,
        {
          productId: dbItem.productId,
          variantId: dbItem.variantId,
          requestedQty: dbItem.requestedQty,
          receivedQty,
          approvedQty,
          condition,
          warehouseDisposition,
        },
        dto.status,
      );
    }

    // 2. Map status to InspectionResult
    let result: InspectionResult;
    if (dto.status === ReturnStatus.QC_PASSED) {
      result = InspectionResult.PASSED;
    } else if (dto.status === ReturnStatus.QC_FAILED) {
      result = InspectionResult.FAILED;
    } else if (dto.status === ReturnStatus.QC_CONFLICT) {
      result = InspectionResult.CONFLICT;
    } else {
      // WAREHOUSE_QC status maps to PASSED for general inspection result
      result = InspectionResult.PASSED;
    }

    // 3. Create ReturnInspection record
    await tx.returnInspection.create({
      data: {
        returnRequestId: request.id,
        inspectedById: user.sub,
        result,
        remarks: dto.remarks ?? null,
        images: dto.images ?? [],
        inspectedAt: new Date(),
      },
    });

    const updateData: any = {
      inspectedAt: new Date(),
    };

    if (dto.status === ReturnStatus.QC_PASSED) {
      updateData.disposition = 'RESTOCK_FRANCHISE';
    } else if (dto.status === ReturnStatus.QC_CONFLICT) {
      updateData.disposition = 'BLOCKED';
    } else if (dto.status === ReturnStatus.QC_FAILED) {
      updateData.disposition = 'RETURN_TO_WAREHOUSE';

      // Automatically create a new child ReturnRequest with sourceType = STOCK_REQUEST
      const childItemsData = dto.items
        .filter(
          (itemUpdate) => itemUpdate.condition === ReturnCondition.DEFECTIVE,
        )
        .map((itemUpdate) => {
          const dbItem = request.items.find((i: any) => i.id === itemUpdate.id);
          return {
            productId: dbItem.productId,
            variantId: dbItem.variantId ?? null,
            requestedQty: itemUpdate.receivedQty ?? dbItem.requestedQty,
            remarks: itemUpdate.remarks ?? dbItem.remarks,
          };
        });

      if (childItemsData.length > 0) {
        const childReturnNumber = `RET-FR-${Date.now().toString(36).toUpperCase()}-${Math.floor(
          Math.random() * 1000,
        )}`;
        const childRequest = await tx.returnRequest.create({
          data: {
            returnNumber: childReturnNumber,
            sourceType: ReturnSourceType.STOCK_REQUEST,
            returnType: ReturnType.RETURN,
            status: ReturnStatus.APPROVED,
            requestedById: user.sub,
            requestedByUserId: user.sub,
            franchiseId: request.franchiseId,
            parentReturnId: request.id,
            warehouseId: 'CENTRAL_WAREHOUSE',
            reason: 'Defective customer return auto-routed to warehouse',
            remarks: dto.remarks ?? null,
            items: {
              create: childItemsData,
            },
          },
        });
        updateData.warehouseReturnRequestId = childRequest.id;
      }
    } else if (dto.status === ReturnStatus.WAREHOUSE_QC) {
      const overallWarehouseDisp =
        dto.items.find((i) => i.warehouseDisposition)?.warehouseDisposition ||
        null;
      if (overallWarehouseDisp) {
        updateData.warehouseDisposition = overallWarehouseDisp;
      }
    }

    // 4. Update request inspectedAt and disposition metadata
    await tx.returnRequest.update({
      where: { id: request.id },
      data: updateData,
    });
  }
}
