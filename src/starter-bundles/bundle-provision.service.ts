import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/audit/audit.service';
import { DomainEventsService } from 'src/supply-chain/domain-events.service';
import { RedisService } from 'src/redis/redis.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { 
  BundleAssignmentStatus, 
  StarterBundleStatus, 
  StockRequestStatus, 
  StockRequestPaymentStatus, 
  StockRequestType,
  DeliveryStatus, 
  InventoryReservationKind, 
  InventoryReservationStatus,
  Prisma 
} from '@prisma/client';

@Injectable()
export class BundleProvisionService {
  private readonly logger = new Logger(BundleProvisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    private readonly redisService: RedisService,
  ) {}

  async provisionBundle(assignmentId: string, actorUserId?: string, ip?: string): Promise<void> {
    const assignment = await this.prisma.franchiseBundleAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        bundle: {
          include: {
            items: true,
          },
        },
        franchise: true,
      },
    });

    if (!assignment) {
      this.logger.error(`Bundle assignment ${assignmentId} not found.`);
      return;
    }

    // If already fully provisioned (not partial) or currently processing, skip
    if (assignment.status === BundleAssignmentStatus.PROVISIONED && !assignment.isPartial) {
      this.logger.log(`Bundle ${assignment.bundle.code} is already fully provisioned for franchise ${assignment.franchise.code}.`);
      return;
    }

    if (assignment.status === BundleAssignmentStatus.PROCESSING) {
      this.logger.warn(`Bundle assignment ${assignmentId} is already being processed.`);
      return;
    }

    // Set to PROCESSING
    await this.prisma.franchiseBundleAssignment.update({
      where: { id: assignmentId },
      data: {
        status: BundleAssignmentStatus.PROCESSING,
        failureReason: null,
      },
    });

    try {
      const prevItems = (assignment.provisionedItems as any[]) || [];
      const updatedProvisionedItems = [...prevItems];
      let isPartial = false;
      let totalItemsAttempted = 0;
      let totalItemsSucceeded = 0;
      const shortfallDetails: string[] = [];

      let firstStockRequestId: string | null = assignment.stockRequestId;
      let firstInboundDeliveryId: string | null = assignment.inboundDeliveryId;

      for (const item of assignment.bundle.items) {
        totalItemsAttempted++;

        // Find how much was already provisioned
        const alreadyQty = prevItems
          .filter((p) => p.productId === item.productId && p.variantId === item.variantId)
          .reduce((sum, p) => sum + p.quantity, 0);

        const remainingQty = item.quantity - alreadyQty;
        if (remainingQty <= 0) {
          totalItemsSucceeded++;
          continue;
        }

        // Validate warehouse stock
        const ws = await this.prisma.warehouseStock.findUnique({
          where: { productId: item.productId },
        });

        const availableGlobal = ws ? Math.max(0, ws.quantity - ws.reserved) : 0;
        let availableStock = availableGlobal;

        let targetVariant: any = null;
        if (item.variantId) {
          targetVariant = await this.prisma.productVariant.findUnique({
            where: { id: item.variantId },
            select: {
              stock: true,
              wholesalePrice: true,
              price: true,
              gstTax: true,
            },
          });
          const availableVariant = targetVariant ? Math.max(0, targetVariant.stock) : 0;
          availableStock = Math.min(availableGlobal, availableVariant);
        }

        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            name: true,
            wholesalePrice: true,
            price: true,
            defaultGstRatePercent: true,
            gstTax: true,
          },
        });

        const productName = product?.name || item.productId;

        if (availableStock <= 0) {
          isPartial = true;
          const msg = `Shortfall for product '${productName}' (ID: ${item.productId}). Available: 0, Needed: ${remainingQty}.`;
          shortfallDetails.push(msg);
          this.logger.warn(msg);
          continue;
        }

        const provisionQty = Math.min(remainingQty, availableStock);
        if (provisionQty < remainingQty) {
          isPartial = true;
          const msg = `Partial shortfall for product '${productName}' (ID: ${item.productId}). Available: ${availableStock}, Needed: ${remainingQty}, Provisioned: ${provisionQty}.`;
          shortfallDetails.push(msg);
          this.logger.warn(msg);
        }

        // Deduct/reserve and create StockRequest + InboundDelivery in transaction
        const result = await this.prisma.$transaction(async (tx) => {
          const unitPrice = targetVariant
            ? (targetVariant.wholesalePrice ?? new Prisma.Decimal(0))
            : (product?.wholesalePrice ?? new Prisma.Decimal(0));

          const gstRate = targetVariant
            ? new Prisma.Decimal(targetVariant.gstTax ?? 0)
            : (product?.defaultGstRatePercent ?? new Prisma.Decimal(product?.gstTax ?? 0));

          const up = new Prisma.Decimal(unitPrice);
          const gr = new Prisma.Decimal(gstRate);
          const qty = new Prisma.Decimal(provisionQty);

          const billingSubtotal = up.mul(qty);
          const billingTax = up.mul(qty).mul(gr).div(new Prisma.Decimal(100));
          const billingTotal = up.mul(qty).mul(new Prisma.Decimal(100).add(gr)).div(new Prisma.Decimal(100));

          const isDefaultBundle = Boolean(assignment.bundle?.isDefault);

          const initialPaymentStatus = isDefaultBundle
            ? StockRequestPaymentStatus.WAIVED
            : StockRequestPaymentStatus.UNPAID;

          // 1. Create StockRequest
          const sr = await tx.stockRequest.create({
            data: {
              franchiseId: assignment.franchiseId,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: provisionQty,
              approvedQuantity: provisionQty,
              status: StockRequestStatus.APPROVED,
              paymentStatus: initialPaymentStatus,
              note: `Starter Bundle: ${assignment.bundle.name} (${assignment.bundle.code})`,
              reviewedById: actorUserId || null,
              reviewedAt: new Date(),
              type: StockRequestType.BUNDLE,
              unitPriceAtApproval: unitPrice,
              gstRatePercent: gstRate,
              billingSubtotal,
              billingTax,
              billingTotal,
            },
          });

          // 2. Reserve central stock
          let targetWs = await tx.warehouseStock.findUnique({
            where: { productId: item.productId },
          });
          if (!targetWs) {
            targetWs = await tx.warehouseStock.create({
              data: {
                productId: item.productId,
                quantity: 0,
                reserved: 0,
                lowStockThreshold: 5,
              },
            });
          }
          await tx.warehouseStock.update({
            where: { productId: item.productId },
            data: { reserved: { increment: provisionQty } },
          });

          await tx.inventoryReservation.create({
            data: {
              kind: InventoryReservationKind.CENTRAL_STOCK_REQUEST,
              status: InventoryReservationStatus.ACTIVE,
              productId: item.productId,
              quantity: provisionQty,
              stockRequestId: sr.id,
              note: `Reserved for starter bundle provisioning: assignment ${assignment.id}`,
            },
          });

          // Decrease the base product stock and variant stock immediately to reflect available stock
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { decrement: provisionQty } },
            });
          }

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: provisionQty } },
          });

          // Invalidate cache since we decremented product and variant stock
          fireAndForget(this.redisService.del([`product:${item.productId}`]), 'cache_invalidate');

          // 3. Create InboundDelivery
          const delivery = await tx.inboundDelivery.create({
            data: {
              franchiseId: assignment.franchiseId,
              stockRequestId: sr.id,
              status: DeliveryStatus.SCHEDULED,
              stockApplied: false,
              carrier: 'Central warehouse',
              trackingCode: `SB-${sr.id.slice(-6).toUpperCase()}`,
              asnPayload: {
                bundleId: assignment.bundle.id,
                bundleCode: assignment.bundle.code,
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: provisionQty,
              } as Prisma.InputJsonValue,
            },
          });

          return { stockRequestId: sr.id, inboundDeliveryId: delivery.id };
        });

        if (!firstStockRequestId) firstStockRequestId = result.stockRequestId;
        if (!firstInboundDeliveryId) firstInboundDeliveryId = result.inboundDeliveryId;

        // Append to tracked items
        updatedProvisionedItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: provisionQty,
          stockRequestId: result.stockRequestId,
          inboundDeliveryId: result.inboundDeliveryId,
          provisionedAt: new Date(),
        });

        totalItemsSucceeded++;
      }

      const finalStatus = totalItemsSucceeded > 0 ? BundleAssignmentStatus.PROVISIONED : BundleAssignmentStatus.FAILED;

      const finalReason = isPartial
        ? `PARTIAL: Stock shortfall on one or more items (${shortfallDetails.join('; ')}). Succeeded for ${totalItemsSucceeded}/${totalItemsAttempted} items.`
        : (finalStatus === BundleAssignmentStatus.FAILED
            ? `FAILED: Stock shortfall in central warehouse (${shortfallDetails.length > 0 ? shortfallDetails.join('; ') : 'No stock available for any bundle items'}).`
            : null);

      await this.prisma.franchiseBundleAssignment.update({
        where: { id: assignmentId },
        data: {
          status: finalStatus,
          isPartial,
          stockRequestId: firstStockRequestId,
          inboundDeliveryId: firstInboundDeliveryId,
          provisionedItems: updatedProvisionedItems as Prisma.InputJsonValue,
          failureReason: finalReason,
          provisionedAt: finalStatus === BundleAssignmentStatus.PROVISIONED ? new Date() : null,
        },
      });

      // Audit logs and events
      if (finalStatus === BundleAssignmentStatus.PROVISIONED) {
        await this.audit.log({
          userId: actorUserId || 'system',
          action: 'starter_bundle.provision',
          resource: 'FranchiseBundleAssignment',
          resourceId: assignmentId,
          metadata: { 
            franchiseId: assignment.franchiseId, 
            bundleId: assignment.bundleId, 
            isPartial,
            firstStockRequestId,
            firstInboundDeliveryId
          },
          ip: ip || null,
        });

        await this.domainEvents.emit('STARTER_BUNDLE_PROVISIONED', {
          assignmentId,
          franchiseId: assignment.franchiseId,
          bundleId: assignment.bundleId,
          isPartial,
          stockRequestId: firstStockRequestId,
          inboundDeliveryId: firstInboundDeliveryId,
        });
      } else {
        await this.audit.log({
          userId: actorUserId || 'system',
          action: 'starter_bundle.failed',
          resource: 'FranchiseBundleAssignment',
          resourceId: assignmentId,
          metadata: { 
            franchiseId: assignment.franchiseId, 
            bundleId: assignment.bundleId,
            reason: finalReason
          },
          ip: ip || null,
        });

        await this.domainEvents.emit('STARTER_BUNDLE_FAILED', {
          assignmentId,
          franchiseId: assignment.franchiseId,
          bundleId: assignment.bundleId,
          reason: finalReason,
        });
      }

    } catch (err: any) {
      this.logger.error(`Error provisioning starter bundle ${assignmentId}: ${err.message}`, err.stack);

      await this.prisma.franchiseBundleAssignment.update({
        where: { id: assignmentId },
        data: {
          status: BundleAssignmentStatus.FAILED,
          failureReason: `ERROR: ${err.message}`,
        },
      });

      await this.audit.log({
        userId: actorUserId || 'system',
        action: 'starter_bundle.failed',
        resource: 'FranchiseBundleAssignment',
        resourceId: assignmentId,
        metadata: { 
          franchiseId: assignment.franchiseId, 
          bundleId: assignment.bundleId,
          error: err.message
        },
        ip: ip || null,
      });

      await this.domainEvents.emit('STARTER_BUNDLE_FAILED', {
        assignmentId,
        franchiseId: assignment.franchiseId,
        bundleId: assignment.bundleId,
        reason: err.message,
      });
    }
  }
}
