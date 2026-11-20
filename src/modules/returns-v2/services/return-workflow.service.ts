import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { ReturnsWorkflowValidator } from '../validators/returns-workflow.validator';
import { ReturnInspectionService } from './return-inspection.service';
import { ReturnRefundService } from './return-refund.service';
import { ReturnExchangeService } from './return-exchange.service';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { JwtUser } from '../../../auth/types/jwt-user.type';
import {
  ReturnSourceType,
  ReturnType,
  ReturnStatus,
  ReturnMediaType,
  Role,
  RefundReceivingSource,
  PaymentModeEnum,
  OnlinePaymentStatus,
} from '@prisma/client';
import { ReturnReasonEnum } from '../enums/return-reason.enum';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { NotificationType } from 'src/notification/enums/notification-type.enum';

import { ReturnInventoryService } from './return-inventory.service';
import { RazorpayService } from 'src/financial/payment/razorpay.service';

@Injectable()
export class ReturnWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inspectionService: ReturnInspectionService,
    private readonly refundService: ReturnRefundService,
    private readonly exchangeService: ReturnExchangeService,
    private readonly inventoryService: ReturnInventoryService,
    private readonly roleBasedNotificationService: RoleBasedNotificationService,
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * Central transition coordinator for V2 Return requests.
   * Orchestrates database status changes and side effects.
   */
  async handleStatusTransition(
    id: string,
    dto: UpdateStatusDto,
    user: JwtUser,
    ip?: string | null,
  ) {
    if (dto.images) {
      dto.images = dto.images.filter(
        (img) => !img.toLowerCase().includes('proof_image_placeholder.png'),
      );
    }
    const updatedRequest = await this.prisma.$transaction(
      async (tx) => {
        // 1. Lock and load the ReturnRequest
        const request = await tx.returnRequest.findUnique({
          where: { id },
          include: {
            items: true,
            exchangeItems: true,
            order: {
              include: {
                items: true,
              },
            },
          },
        });

        if (!request) {
          throw new NotFoundException(
            `Return request with ID ${id} not found.`,
          );
        }

        // Damage handling restriction: Only SUPERADMIN or ADMIN_STAFF
        const isDamageRelated = request.reason === ReturnReasonEnum.DAMAGE;

        const isOnlineFlow =
          request.sourceType === ReturnSourceType.CUSTOMER_ORDER &&
          request.order?.channel === 'ONLINE';

        if (isOnlineFlow && isDamageRelated) {
          if (user.role !== Role.SUPERADMIN && user.role !== Role.ADMIN_STAFF) {
            throw new ForbiddenException(
              'Only SUPERADMIN or ADMIN_STAFF can handle damage-related online return requests.',
            );
          }
        }

        // 2. Validate the transition using the centralized workflow rules
        ReturnsWorkflowValidator.validateStatusTransition(
          request.status,
          dto.status as ReturnStatus,
          request.sourceType,
          request.returnType,
        );

        // Strict image validation for receiving and QC status changes
        const statusesRequiringImages: ReturnStatus[] = [
          ReturnStatus.RECEIVED_AT_FRANCHISE,
          ReturnStatus.RECEIVED_AT_WAREHOUSE,
          ReturnStatus.QC_PASSED,
          ReturnStatus.QC_FAILED,
          ReturnStatus.QC_CONFLICT,
          ReturnStatus.WAREHOUSE_QC,
        ];

        if (statusesRequiringImages.includes(dto.status as ReturnStatus)) {
          if (!dto.images || dto.images.length === 0) {
            throw new BadRequestException(
              `Image evidence is mandatory when transitioning to status: ${dto.status}`,
            );
          }
        }

        const updateData: any = {
          status: dto.status,
          remarks: dto.remarks ?? request.remarks,
        };

        // Copy Shiprocket tracking variables if provided
        if (dto.courierName !== undefined)
          updateData.courierName = dto.courierName;
        if (dto.awbNumber !== undefined) updateData.awbNumber = dto.awbNumber;
        if (dto.trackingNumber !== undefined)
          updateData.trackingNumber = dto.trackingNumber;
        if (dto.shipmentStatus !== undefined)
          updateData.shipmentStatus = dto.shipmentStatus;
        if (dto.trackingEvents !== undefined)
          updateData.trackingEvents = dto.trackingEvents;

        // 3. Coordinate side effects based on target status
        switch (dto.status) {
          case ReturnStatus.APPROVED:
            updateData.approvedAt = new Date();
            updateData.approvedByUserId = user.sub;
            break;

          case ReturnStatus.PICKUP_COMPLETED:
            if (dto.images && dto.images.length > 0) {
              await tx.returnMedia.create({
                data: {
                  returnRequestId: id,
                  uploadedById: user.sub,
                  type: ReturnMediaType.RECEIVING_PROOF,
                  files: dto.images,
                },
              });
            }
            break;

          case ReturnStatus.RECEIVED_AT_FRANCHISE:
            updateData.receivedAt = new Date();
            updateData.receivedFranchiseId =
              user.franchiseId || request.franchiseId;
            updateData.receivedByUserId = user.sub;

            // Record customer return items as received in ReturnInventory and log CUSTOMER_TO_RETURN ledger
            await this.inventoryService.recordCustomerToReturn(
              tx,
              request,
              user,
              updateData.receivedFranchiseId,
            );

            if (dto.images && dto.images.length > 0) {
              await tx.returnMedia.create({
                data: {
                  returnRequestId: id,
                  uploadedById: user.sub,
                  type: ReturnMediaType.RECEIVING_PROOF,
                  files: dto.images,
                },
              });
            }
            break;

          case ReturnStatus.RECEIVED_AT_WAREHOUSE:
            updateData.receivedAt = new Date();
            updateData.receivedByUserId = user.sub;

            // Record franchise return items as received in ReturnInventory and log FRANCHISE_TO_RETURN ledger
            await this.inventoryService.recordFranchiseToReturn(
              tx,
              request,
              user,
            );

            if (dto.images && dto.images.length > 0) {
              await tx.returnMedia.create({
                data: {
                  returnRequestId: id,
                  uploadedById: user.sub,
                  type: ReturnMediaType.RECEIVING_PROOF,
                  files: dto.images,
                },
              });
            }
            break;

          case ReturnStatus.QC_PASSED:
          case ReturnStatus.QC_FAILED:
          case ReturnStatus.QC_CONFLICT:
          case ReturnStatus.WAREHOUSE_QC:
            updateData.inspectedByUserId = user.sub;
            // Delegates QC items assessment and inventory movements
            await this.inspectionService.completeInspection(
              tx,
              request,
              dto,
              user,
            );

            if (dto.images && dto.images.length > 0) {
              await tx.returnMedia.create({
                data: {
                  returnRequestId: id,
                  uploadedById: user.sub,
                  type: ReturnMediaType.QC_PROOF,
                  files: dto.images,
                },
              });
            }
            break;

          case ReturnStatus.REFUND_PROCESSED:
            if (request.returnType !== ReturnType.REFUND) {
              throw new BadRequestException(
                'Refund can only be processed for return requests with REFUND type.',
              );
            }
            if (!request.order) {
              throw new BadRequestException(
                'No order linked to compute refund.',
              );
            }

            // Compute total refund based on approved item quantities and original prices (including discounts/taxes)
            let refundAmount = 0;
            for (const item of request.items) {
              const originalItem = request.order.items.find(
                (oi: any) =>
                  oi.productId === item.productId &&
                  oi.variantId === item.variantId,
              );
              const approvedQty =
                item.approvedQty ?? item.receivedQty ?? item.requestedQty;
              if (originalItem && approvedQty > 0) {
                const finalAmountPerUnit =
                  Number(originalItem.finalAmount) / originalItem.quantity;
                refundAmount += finalAmountPerUnit * approvedQty;
              }
            }

            if (refundAmount <= 0) {
              throw new BadRequestException(
                'Approved refund amount must be greater than zero.',
              );
            }

            let conversionRate = null;
            let loyaltyPointsCredited = null;
            let referenceNumber = dto.referenceNumber ?? null;

            if (
              request.refundReceivingSource === RefundReceivingSource.REWARDS
            ) {
              const customerId = request.order?.customerId;
              if (!customerId) {
                throw new BadRequestException(
                  'No customer profile associated with the order to credit loyalty points.',
                );
              }
              conversionRate = 10;
              loyaltyPointsCredited = Math.round(refundAmount * conversionRate);

              // 1. Update/create RetentionSnapshot
              const snapshot = await tx.retentionSnapshot.findUnique({
                where: { customerId },
              });

              if (snapshot) {
                await tx.retentionSnapshot.update({
                  where: { customerId },
                  data: {
                    loyaltyPoints: { increment: loyaltyPointsCredited },
                    engagementCount: { increment: 1 },
                  },
                });
              } else {
                await tx.retentionSnapshot.create({
                  data: {
                    customerId,
                    stage: 'REGISTERED',
                    tier: 'BRONZE',
                    loyaltyPoints: loyaltyPointsCredited,
                    engagementCount: 1,
                  },
                });
              }

              // 2. Create LoyaltyTransaction
              await tx.loyaltyTransaction.create({
                data: {
                  customerId,
                  points: loyaltyPointsCredited,
                  type: 'REFUND',
                  description: `Refund credited as loyalty points for Return #${request.returnNumber}`,
                  referenceId: request.id,
                },
              });
            } else if (
              request.refundReceivingSource === RefundReceivingSource.ORIGINAL_SOURCE ||
              !request.refundReceivingSource
            ) {
              const isOnlinePrepaid =
                request.order?.paymentMode === PaymentModeEnum.ONLINE &&
                request.order?.onlinePaymentStatus === OnlinePaymentStatus.PAID;

              if (isOnlinePrepaid) {
                const paymentId = request.order?.paymentReference;
                if (!paymentId) {
                  throw new BadRequestException(
                    'No payment reference found on the order to process Razorpay refund.',
                  );
                }

                // Trigger Razorpay refund API for exact calculated item refund amount
                const rpRefund = await this.razorpayService.refundPayment({
                  paymentId,
                  amount: Number(refundAmount.toFixed(2)),
                });

                if (!rpRefund || !rpRefund.id) {
                  throw new BadRequestException(
                    'Failed to trigger Razorpay refund API.',
                  );
                }
                referenceNumber = rpRefund.id;
              }
            }

            await this.refundService.processRefund(
              tx,
              request.id,
              refundAmount,
              referenceNumber ?? undefined,
              conversionRate ?? undefined,
              loyaltyPointsCredited ?? undefined,
              user.sub,
            );
            break;

          case ReturnStatus.EXCHANGE_ORDER_CREATED:
            if (
              request.returnType !== ReturnType.EXCHANGE &&
              request.returnType !== ReturnType.SAME_PRODUCT_EXCHANGE
            ) {
              throw new BadRequestException(
                'Exchange order can only be created for return requests with EXCHANGE or SAME_PRODUCT_EXCHANGE type.',
              );
            }
            // Validate and deduct replacement items if not already done
            await this.inventoryService.validateAndDeductExchangeItems(
              tx,
              request,
            );

            // Delegates exchange order creation and links exchangeOrderId to request
            await this.exchangeService.createExchangeOrder(tx, request.id);
            break;

          case ReturnStatus.CLOSED:
            updateData.closedAt = new Date();
            updateData.closedByUserId = user.sub;
            break;
        }

        // 4. Perform final update of status and audit logs
        return tx.returnRequest.update({
          where: { id },
          data: updateData,
          include: {
            items: true,
            inspections: true,
            refunds: true,
            order: true,
          },
        });
      },
      {
        timeout: 15000,
      },
    );

    // 5. Log audit trail outside the transaction scope
    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: `return.status_${dto.status.toLowerCase()}`,
        resource: 'ReturnRequest',
        resourceId: updatedRequest.id,
        metadata: {
          returnNumber: updatedRequest.returnNumber,
          fromStatus: updatedRequest.status,
          toStatus: dto.status,
          remarks: dto.remarks,
        },
        ip: ip ?? null,
      }),
      `return.status_${dto.status.toLowerCase()}`,
    );

    if (
      dto.status === ReturnStatus.QC_PASSED &&
      (updatedRequest as any).order?.customerId
    ) {
      void this.roleBasedNotificationService.notifyCustomer(
        (updatedRequest as any).order.customerId,
        'Return QC Passed',
        `Quality check passed for your return request ${updatedRequest.returnNumber}.`,
        NotificationType.ORDER,
        {
          returnRequestId: updatedRequest.id,
          returnNumber: updatedRequest.returnNumber,
          orderNumber: (updatedRequest as any).order.orderNumber,
        },
      );
    }

    return updatedRequest;
  }
}
