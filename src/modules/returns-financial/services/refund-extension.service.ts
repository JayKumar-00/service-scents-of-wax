import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { ProcessRefundDto, FailRefundDto } from '../dto/process-refund.dto';
import {
  InvoiceType,
  ReturnStatus,
  RefundStatus,
  RefundMethod,
  InvoiceStatus,
  InvoicePaymentStatus,
  PaymentModeEnum,
  OnlinePaymentStatus,
  Role,
  ReturnType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { RazorpayService } from 'src/financial/payment/razorpay.service';
import { CreditNoteService } from './credit-note.service';
import { QueryDto } from 'src/common/dto/query.dto';
import { UploadsService } from 'src/uploads/uploads.service';

@Injectable()
export class RefundExtensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly creditNoteService: CreditNoteService,
    private readonly uploadsService: UploadsService,
  ) {}

  private getImageUrl(file: string): string {
    if (!file) return '';
    if (file.startsWith('http://') || file.startsWith('https://')) {
      return file;
    }
    const prefix = process.env.AWS_PREFIX_URL;
    if (prefix) {
      const cleanPrefix = prefix.replace(/\/+$/, '');
      const cleanFile = file.replace(/^\/+/, '');
      return `${cleanPrefix}/${cleanFile}`;
    }
    return this.uploadsService.getObjectUrl(file);
  }

  async createRefund(dto: CreateRefundDto, user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch Return Request with items and order items included
      const returnRequest = await tx.returnRequest.findUnique({
        where: { id: dto.returnId },
        include: {
          items: true,
          order: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!returnRequest) {
        throw new NotFoundException(
          `Return request ${dto.returnId} not found.`,
        );
      }

      if (!returnRequest.orderId || !returnRequest.order) {
        throw new BadRequestException(
          'Return request does not belong to a valid order.',
        );
      }

      if (
        returnRequest.status !== ReturnStatus.QC_PASSED &&
        returnRequest.status !== ReturnStatus.CREDIT_NOTE_GENERATED
      ) {
        throw new BadRequestException(
          `Return request is not in the correct status for refund processing. Current status: ${returnRequest.status}`,
        );
      }

      // Automatically use the refund preference stored on ReturnRequest if available,
      // otherwise fall back to the method provided in the DTO.
      let method = dto.method;
      if (returnRequest.refundReceivingSource) {
        if (
          returnRequest.refundReceivingSource === 'LOYALTY_POINTS' ||
          returnRequest.refundReceivingSource === 'REWARDS'
        ) {
          method = RefundMethod.REWARDS;
        } else if (returnRequest.refundReceivingSource === 'ORIGINAL_SOURCE') {
          method = RefundMethod.ORIGINAL_SOURCE;
        } else if (returnRequest.refundReceivingSource === 'UPI') {
          method = RefundMethod.UPI;
        } else if (returnRequest.refundReceivingSource === 'BANK_TRANSFER') {
          method = RefundMethod.BANK_TRANSFER;
        } else {
          method = returnRequest.refundReceivingSource as any;
        }
      }

      if (!method) {
        throw new BadRequestException('Refund method is required.');
      }

      // 2. Fetch original Payment Invoice
      const originalInvoice = await tx.invoice.findFirst({
        where: {
          orderId: returnRequest.orderId,
          type: InvoiceType.PAYMENT,
          isDeleted: false,
        },
      });

      if (!originalInvoice) {
        throw new NotFoundException(
          `Original invoice for return request ${dto.returnId} not found.`,
        );
      }

      // Validate relationship hierarchy: ReturnRequest belongs to Order belongs to Invoice
      if (returnRequest.orderId !== originalInvoice.orderId) {
        throw new BadRequestException(
          'Relationship mismatch: ReturnRequest order does not match Invoice order.',
        );
      }

      const isOnlinePrepaid =
        returnRequest.order.paymentMode === PaymentModeEnum.ONLINE &&
        returnRequest.order.onlinePaymentStatus === OnlinePaymentStatus.PAID;
      if (isOnlinePrepaid && !returnRequest.order.paymentReference) {
        throw new BadRequestException(
          'Prepaid order does not have a valid payment reference.',
        );
      }

      // 3. Find or Create Credit Note
      let creditNote = await tx.invoice.findFirst({
        where: {
          returnRequestId: returnRequest.id,
          type: InvoiceType.CREDIT_NOTE,
          isDeleted: false,
        },
      });

      if (!creditNote) {
        creditNote = await this.creditNoteService.createCreditNote(
          originalInvoice.invoiceNumber,
          {
            returnRequestId: returnRequest.id,
            remarks:
              dto.remarks ?? 'Automatically generated during refund creation.',
          },
          user,
          tx,
        );
      }

      // Calculate expectedRefundAmount from return items approvedQty and order pricing
      let calculatedExpectedRefundAmount = 0;
      let hasApprovedItems = false;

      for (const retItem of returnRequest.items) {
        const approvedQty =
          retItem.approvedQty ??
          retItem.receivedQty ??
          retItem.requestedQty ??
          0;
        if (approvedQty <= 0) continue;
        hasApprovedItems = true;

        const originalItem = returnRequest.order?.items.find(
          (oi: any) =>
            oi.productId === retItem.productId &&
            oi.variantId === retItem.variantId,
        );

        if (!originalItem) {
          throw new BadRequestException(
            `Returned item Product ID ${retItem.productId} not found in the original order.`,
          );
        }

        // Validate remaining refundable quantity (clamp/over-refunding check)
        const otherReturnItems = await tx.returnItem.findMany({
          where: {
            returnRequest: {
              orderId: returnRequest.orderId,
              status: { not: ReturnStatus.REJECTED },
              id: { not: returnRequest.id },
            },
            productId: retItem.productId,
            variantId: retItem.variantId ?? null,
          },
          include: {
            returnRequest: true,
          },
        });

        let refundedQty = 0;
        let exchangeQty = 0;

        for (const otherItem of otherReturnItems) {
          const qty =
            otherItem.approvedQty ??
            otherItem.receivedQty ??
            otherItem.requestedQty;
          const status = otherItem.returnRequest.status;
          const rType = otherItem.returnRequest.returnType;

          if (
            status !== ReturnStatus.REQUESTED &&
            status !== ReturnStatus.REJECTED
          ) {
            if (
              rType === ReturnType.REFUND &&
              (status === ReturnStatus.REFUND_PROCESSED ||
                status === ReturnStatus.CLOSED)
            ) {
              refundedQty += qty;
            } else if (
              (rType === ReturnType.EXCHANGE ||
                rType === ReturnType.SAME_PRODUCT_EXCHANGE) &&
              (status === ReturnStatus.EXCHANGE_ORDER_CREATED ||
                status === ReturnStatus.EXCHANGE_ORDER_DELIVERED ||
                status === ReturnStatus.CLOSED)
            ) {
              exchangeQty += qty;
            }
          }
        }

        const maxRefundableQty =
          originalItem.quantity - refundedQty - exchangeQty;
        if (approvedQty > maxRefundableQty) {
          throw new BadRequestException(
            `Cannot refund more units than originally ordered minus already refunded and exchanged units. Product: ${originalItem.productName || 'Product'}. Ordered: ${originalItem.quantity}, Refunded: ${refundedQty}, Exchanged: ${exchangeQty}, Approved in this request: ${approvedQty}. Max refundable: ${maxRefundableQty}`,
          );
        }

        const originalNetUnitPrice =
          Number(originalItem.finalAmount) / originalItem.quantity;
        calculatedExpectedRefundAmount += approvedQty * originalNetUnitPrice;
      }

      if (!hasApprovedItems) {
        throw new BadRequestException(
          'No approved items with positive quantity found for refund calculation.',
        );
      }

      const expectedRefundAmount = new Prisma.Decimal(
        calculatedExpectedRefundAmount,
      ).toDecimalPlaces(2);
      let processedRefundAmount = expectedRefundAmount;
      let overrideAmount = null;
      let overrideReason = null;
      let overriddenBy = null;
      let overriddenAt = null;

      if (dto.overrideAmount !== undefined && dto.overrideAmount !== null) {
        if (user.role !== Role.SUPERADMIN) {
          throw new ForbiddenException(
            'Only SUPERADMIN is allowed to override the refund amount.',
          );
        }
        if (!dto.overrideReason || !dto.overrideReason.trim()) {
          throw new BadRequestException(
            'overrideReason is mandatory when overrideAmount is provided.',
          );
        }
        overrideAmount = new Prisma.Decimal(dto.overrideAmount).toDecimalPlaces(
          2,
        );
        overrideReason = dto.overrideReason;
        overriddenBy = user.sub;
        overriddenAt = new Date();
        processedRefundAmount = overrideAmount;
      }

      // 4. Validate total refunds do not exceed original payment amount
      const existingRefunds = await tx.refund.findMany({
        where: {
          invoiceId: originalInvoice.id,
          status: {
            in: [
              RefundStatus.PENDING,
              RefundStatus.PROCESSING,
              RefundStatus.PROCESSED,
            ],
          },
        },
      });

      const totalRefunded = existingRefunds.reduce(
        (sum: Prisma.Decimal, rf: any) => sum.add(rf.amount),
        new Prisma.Decimal(0),
      );

      const remainingAmount = originalInvoice.grandTotal.sub(totalRefunded);

      if (processedRefundAmount.gt(remainingAmount)) {
        throw new BadRequestException(
          `Refund amount (₹${processedRefundAmount}) exceeds the remaining refundable amount (₹${remainingAmount}).`,
        );
      }

      // 5. COD vs Prepaid check
      const isCodOrder =
        returnRequest.order?.paymentMode === PaymentModeEnum.COD;
      if (isCodOrder && method === RefundMethod.ORIGINAL_SOURCE) {
        throw new BadRequestException(
          'ORIGINAL_SOURCE is not selectable for COD orders.',
        );
      }

      if (
        isOnlinePrepaid &&
        method !== RefundMethod.ORIGINAL_SOURCE &&
        method !== RefundMethod.REWARDS
      ) {
        throw new BadRequestException(
          'Direct UPI or bank-transfer refunds for prepaid orders are not currently supported. Please select ORIGINAL_SOURCE or REWARDS.',
        );
      }

      // 6. Generate Refund Number
      const refundNumber = await this.generateUniqueRefundNumber(tx);

      // 7. Create Refund
      const refund = await tx.refund.create({
        data: {
          refundNumber,
          returnId: returnRequest.id,
          invoiceId: originalInvoice.id,
          creditNoteId: creditNote.id,
          amount: processedRefundAmount,
          method: method,
          status: RefundStatus.PENDING,
          paymentReferenceId: returnRequest.order.paymentReference ?? null,
          remarks: dto.remarks ?? null,
          expectedRefundAmount,
          processedRefundAmount,
          overrideAmount,
          overrideReason,
          overriddenBy,
          overriddenAt,
        },
        include: {
          returnRequest: {
            include: {
              media: true,
              order: {
                include: {
                  customer: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          email: true,
                        },
                      },
                    },
                  },
                  retailCustomer: true,
                },
              },
            },
          },
          invoice: true,
        },
      });

      // 7b. Write Audit Log entry internally for full operational traceability
      await tx.auditLog.create({
        data: {
          userId: user.sub,
          action: 'refund.created',
          resource: 'Refund',
          resourceId: refund.id,
          metadata: {
            paymentReferenceUsed: returnRequest.order.paymentReference ?? null,
            invoiceUsed: originalInvoice.invoiceNumber,
            creditNoteUsed: creditNote.invoiceNumber,
            refundCalculationSnapshot: {
              expectedRefundAmount: expectedRefundAmount.toNumber(),
              processedRefundAmount: processedRefundAmount.toNumber(),
              overrideAmount: overrideAmount ? overrideAmount.toNumber() : null,
              overrideReason,
            },
            pricingSnapshot: returnRequest.items.map((item: any) => {
              const originalItem = returnRequest.order?.items.find(
                (oi: any) =>
                  oi.productId === item.productId &&
                  oi.variantId === item.variantId,
              );
              return {
                productId: item.productId,
                variantId: item.variantId,
                approvedQty: item.approvedQty ?? 0,
                originalNetUnitPrice: originalItem
                  ? Number(originalItem.finalAmount) / originalItem.quantity
                  : 0,
              };
            }),
            processedBy: user.sub,
            processedAt: new Date().toISOString(),
          },
        },
      });

      // 8. Update ReturnRequest status to REFUND_PROCESSED
      await tx.returnRequest.update({
        where: { id: returnRequest.id },
        data: { status: ReturnStatus.REFUND_PROCESSED },
      });

      return this.enrichRefundResponse(refund);
    });
  }

  async processRefund(id: string, dto: ProcessRefundDto, user?: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id },
        include: {
          invoice: true,
          returnRequest: {
            include: {
              order: true,
              media: true,
            },
          },
        },
      });

      if (!refund) {
        throw new NotFoundException(`Refund ${id} not found.`);
      }

      if (refund.status === RefundStatus.PROCESSED) {
        throw new BadRequestException('Refund is already processed.');
      }

      const returnRequest = refund.returnRequest;
      if (!returnRequest) {
        throw new NotFoundException(
          `Return request associated with refund ${id} not found.`,
        );
      }

      if (!returnRequest.order) {
        throw new BadRequestException(
          'No order associated with this return request.',
        );
      }

      const originalInvoice = await tx.invoice.findUnique({
        where: { id: refund.invoiceId },
      });

      if (!originalInvoice) {
        throw new NotFoundException(
          `Original invoice ${refund.invoiceId} not found.`,
        );
      }

      // Check relationships: ReturnRequest -> Order -> Invoice
      if (returnRequest.orderId !== originalInvoice.orderId) {
        throw new BadRequestException(
          'Relationship mismatch: ReturnRequest order does not match Invoice order.',
        );
      }

      let conversionRate = null;
      let loyaltyPointsCredited = null;
      let refundReferenceId = null;

      if (refund.method === RefundMethod.REWARDS) {
        const customerId = returnRequest.order?.customerId;
        if (!customerId) {
          throw new BadRequestException(
            'No customer profile associated with the order to credit loyalty points.',
          );
        }

        conversionRate = 10;
        loyaltyPointsCredited = Math.round(
          refund.amount.toNumber() * conversionRate,
        );

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

        // 2. Create LoyaltyTransaction of type REFUND
        await tx.loyaltyTransaction.create({
          data: {
            customerId,
            points: loyaltyPointsCredited,
            type: 'REFUND',
            description: `Refund credited as loyalty points for Return #${returnRequest.returnNumber}`,
            referenceId: refund.id,
          },
        });

        refundReferenceId = `TXN-REWARDS-${randomBytes(4).toString('hex').toUpperCase()}`;
      } else if (refund.method === RefundMethod.ORIGINAL_SOURCE) {
        const isOnlinePrepaid =
          returnRequest.order?.paymentMode === PaymentModeEnum.ONLINE &&
          returnRequest.order?.onlinePaymentStatus === OnlinePaymentStatus.PAID;
        if (isOnlinePrepaid) {
          const paymentId = returnRequest.order.paymentReference;
          if (!paymentId) {
            throw new BadRequestException(
              'No payment reference found on the order to process Razorpay refund.',
            );
          }

          // Trigger Razorpay refund API
          const rpRefund = await this.razorpayService.refundPayment({
            paymentId,
            amount: refund.amount.toNumber(),
          });

          if (!rpRefund || !rpRefund.id) {
            throw new BadRequestException(
              'Failed to trigger Razorpay refund API.',
            );
          }
          refundReferenceId = rpRefund.id;
        } else {
          refundReferenceId = `TXN-ORIG-${randomBytes(4).toString('hex').toUpperCase()}`;
        }
      } else {
        refundReferenceId = `TXN-REF-${randomBytes(4).toString('hex').toUpperCase()}`;
      }

      // Update Refund status to PROCESSED
      const updatedRefund = await tx.refund.update({
        where: { id },
        data: {
          status: RefundStatus.PROCESSED,
          refundReferenceId: refundReferenceId ?? null,
          processedAt: new Date(),
          remarks: dto.remarks ?? refund.remarks,
          conversionRate: conversionRate
            ? new Prisma.Decimal(conversionRate)
            : null,
          loyaltyPointsCredited: loyaltyPointsCredited ?? null,
          processedByUserId: user?.sub ?? null,
        },
        include: {
          returnRequest: {
            include: {
              media: true,
              order: {
                include: {
                  customer: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          email: true,
                        },
                      },
                    },
                  },
                  retailCustomer: true,
                },
              },
            },
          },
          invoice: true,
        },
      });

      // Generate REFUND_RECEIPT document
      const originalInvoiceRecord = await tx.invoice.findUnique({
        where: { id: refund.invoiceId },
      });

      if (!originalInvoiceRecord) {
        throw new NotFoundException(
          `Original invoice ${refund.invoiceId} not found.`,
        );
      }

      const receiptNumber = await this.generateUniqueDocNumber('GFRR', tx);

      const refundReceipt = await tx.invoice.create({
        data: {
          invoiceNumber: receiptNumber,
          type: InvoiceType.REFUND_RECEIPT,
          parentInvoice: originalInvoiceRecord.id
            ? { connect: { id: originalInvoiceRecord.id } }
            : undefined,
          order: originalInvoiceRecord.orderId
            ? { connect: { id: originalInvoiceRecord.orderId } }
            : undefined,
          stockRequest: originalInvoiceRecord.stockRequestId
            ? { connect: { id: originalInvoiceRecord.stockRequestId } }
            : undefined,
          buyerName: originalInvoiceRecord.buyerName,
          buyerPhone: originalInvoiceRecord.buyerPhone,
          buyerEmail: originalInvoiceRecord.buyerEmail,
          storeName: originalInvoiceRecord.storeName,
          latitude: originalInvoiceRecord.latitude,
          longitude: originalInvoiceRecord.longitude,
          billingAddress: originalInvoiceRecord.billingAddress ?? undefined,
          shippingAddress: originalInvoiceRecord.shippingAddress ?? undefined,
          pickupAddress: originalInvoiceRecord.pickupAddress ?? undefined,
          length: originalInvoiceRecord.length,
          breadth: originalInvoiceRecord.breadth,
          height: originalInvoiceRecord.height,
          weight: originalInvoiceRecord.weight,
          sellerGstin: originalInvoiceRecord.sellerGstin,
          buyerGstin: originalInvoiceRecord.buyerGstin,
          placeOfSupply: originalInvoiceRecord.placeOfSupply,
          shipmentPaymentMode: originalInvoiceRecord.shipmentPaymentMode,
          items: [
            {
              refundNumber: refund.refundNumber,
              refundAmount: refund.amount.toNumber(),
              refundMethod: refund.method,
              refundReferenceId: refundReferenceId || '',
              processedAt: new Date().toISOString(),
            },
          ],
          subtotal: refund.amount,
          gst: 0,
          grandTotal: refund.amount,
          paymentStatus: InvoicePaymentStatus.PAID,
          status: InvoiceStatus.DELIVERED,
          returnRequest: refund.returnId
            ? { connect: { id: refund.returnId } }
            : undefined,
        },
      });

      // 7b. Write Audit Log entry internally for full operational traceability of processing
      await tx.auditLog.create({
        data: {
          userId: user?.sub ?? 'SYSTEM',
          action: 'refund.processed',
          resource: 'Refund',
          resourceId: refund.id,
          metadata: {
            paymentReferenceUsed: returnRequest.order?.paymentReference ?? null,
            invoiceUsed: originalInvoiceRecord.invoiceNumber,
            creditNoteUsed: refund.creditNoteId,
            refundReferenceId: refundReferenceId,
            processedBy: user?.sub ?? 'SYSTEM',
            processedAt: new Date().toISOString(),
          },
        },
      });

      // Transition Return Request status to CLOSED
      await tx.returnRequest.update({
        where: { id: refund.returnId },
        data: { status: ReturnStatus.CLOSED },
      });

      return {
        refund: this.enrichRefundResponse(updatedRefund),
        receipt: refundReceipt,
      };
    });
  }

  async failRefund(id: string, dto: FailRefundDto) {
    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id },
      });

      if (!refund) {
        throw new NotFoundException(`Refund ${id} not found.`);
      }

      if (refund.status === RefundStatus.PROCESSED) {
        throw new BadRequestException(
          'Cannot fail a refund that is already processed.',
        );
      }

      const updatedRefund = await tx.refund.update({
        where: { id },
        data: {
          status: RefundStatus.FAILED,
          remarks: dto.remarks,
        },
      });

      // Revert Return Request status to CREDIT_NOTE_GENERATED so admin can retry
      await tx.returnRequest.update({
        where: { id: refund.returnId },
        data: { status: ReturnStatus.CREDIT_NOTE_GENERATED },
      });

      return updatedRefund;
    });
  }

  async listRefunds(query?: QueryDto, user?: JwtUser) {
    const where: Prisma.RefundWhereInput = {};

    if (
      user &&
      (user.role === Role.FRANCHISE_OWNER || user.role === Role.FRANCHISE_STAFF)
    ) {
      const userFranchiseId = user.franchiseId || user.franchiseOwnerId;
      if (!userFranchiseId) {
        throw new ForbiddenException(
          'Franchise user is not associated with any franchise.',
        );
      }
      where.returnRequest = {
        franchiseId: userFranchiseId,
      };
    }

    if (query) {
      if (query.returnNumber || query.orderNumber) {
        if (!where.returnRequest) {
          where.returnRequest = {};
        }

        if (query.returnNumber) {
          where.returnRequest.returnNumber = {
            contains: query.returnNumber,
            mode: 'insensitive',
          };
        }

        if (query.orderNumber) {
          where.returnRequest.order = {
            orderNumber: {
              contains: query.orderNumber,
              mode: 'insensitive',
            },
          };
        }
      }
    }

    const refunds = await this.prisma.refund.findMany({
      where,
      include: {
        returnRequest: {
          include: {
            media: true,
            order: {
              include: {
                customer: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                      },
                    },
                  },
                },
                retailCustomer: true,
              },
            },
          },
        },
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return refunds.map((r) => this.enrichRefundResponse(r));
  }

  async getRefund(id: string, user?: JwtUser) {
    const refund = await this.prisma.refund.findFirst({
      where: {
        OR: [
          { id },
          { refundNumber: id },
          { returnRequest: { returnNumber: id } },
        ],
      },
      include: {
        returnRequest: {
          include: {
            media: true,
            order: {
              include: {
                customer: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                      },
                    },
                  },
                },
                retailCustomer: true,
              },
            },
          },
        },
        invoice: true,
      },
    });

    if (!refund) {
      throw new NotFoundException(
        `Refund with ID, Refund Number, or Return Number "${id}" not found.`,
      );
    }

    if (
      user &&
      (user.role === Role.FRANCHISE_OWNER || user.role === Role.FRANCHISE_STAFF)
    ) {
      const userFranchiseId = user.franchiseId || user.franchiseOwnerId;
      if (!userFranchiseId) {
        throw new ForbiddenException(
          'Franchise user is not associated with any franchise.',
        );
      }
      if (refund.returnRequest?.franchiseId !== userFranchiseId) {
        throw new ForbiddenException(
          'You do not have permission to access this refund.',
        );
      }
    }

    return this.enrichRefundResponse(refund);
  }

  private enrichRefundResponse(refund: any) {
    if (!refund) return null;

    let parsedImages: string[] = [];
    if (refund.returnRequest?.images) {
      try {
        const parsed =
          typeof refund.returnRequest.images === 'string'
            ? JSON.parse(refund.returnRequest.images)
            : refund.returnRequest.images;
        if (Array.isArray(parsed)) {
          parsedImages = parsed;
        }
      } catch (e) {
        console.error('Failed to parse return images in refund:', e);
      }
    }

    const mediaFiles: string[] = [];
    if (
      refund.returnRequest?.media &&
      Array.isArray(refund.returnRequest.media)
    ) {
      for (const mediaItem of refund.returnRequest.media) {
        if (mediaItem.files && Array.isArray(mediaItem.files)) {
          mediaFiles.push(...mediaItem.files);
        }
      }
    }

    const allFiles = Array.from(new Set([...parsedImages, ...mediaFiles]));
    const images = allFiles.map((file: string) => this.getImageUrl(file));
    const customerEvidanceImages = parsedImages.map((file: string) =>
      this.getImageUrl(file),
    );

    return {
      id: refund.id,
      refundNumber: refund.refundNumber,
      returnId: refund.returnId,
      returnNumber: refund.returnRequest?.returnNumber ?? null,
      invoiceId: refund.invoiceId,
      creditNoteId: refund.creditNoteId,
      amount: refund.amount ? Number(refund.amount) : 0,
      method: refund.method,
      status: refund.status,
      paymentReferenceId: refund.paymentReferenceId,
      refundReferenceId: refund.refundReferenceId,
      remarks: refund.remarks,
      processedAt: refund.processedAt,
      conversionRate: refund.conversionRate
        ? Number(refund.conversionRate)
        : null,
      loyaltyPointsCredited: refund.loyaltyPointsCredited,
      processedByUserId: refund.processedByUserId,
      expectedRefundAmount: refund.expectedRefundAmount
        ? Number(refund.expectedRefundAmount)
        : 0,
      processedRefundAmount: refund.processedRefundAmount
        ? Number(refund.processedRefundAmount)
        : 0,
      overrideAmount: refund.overrideAmount
        ? Number(refund.overrideAmount)
        : null,
      overrideReason: refund.overrideReason,
      overriddenBy: refund.overriddenBy,
      overriddenAt: refund.overriddenAt,
      isOverridden:
        refund.overrideAmount !== null && refund.overrideAmount !== undefined,
      refundReceivingSource:
        refund.returnRequest?.refundReceivingSource ?? null,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
      customerName:
        refund.invoice?.buyerName ??
        refund.returnRequest?.order?.customer?.name ??
        refund.returnRequest?.order?.retailCustomer?.name ??
        refund.returnRequest?.order?.billingSnapshot?.customer?.name ??
        refund.returnRequest?.order?.billingSnapshot?.buyerName ??
        null,
      customerEmail:
        refund.invoice?.buyerEmail ??
        refund.returnRequest?.order?.customer?.user?.email ??
        refund.returnRequest?.order?.customer?.altEmail ??
        refund.returnRequest?.order?.retailCustomer?.email ??
        refund.returnRequest?.order?.billingSnapshot?.customer?.email ??
        refund.returnRequest?.order?.billingSnapshot?.buyerEmail ??
        null,
      customerPhone:
        refund.invoice?.buyerPhone ??
        refund.returnRequest?.order?.customer?.phone ??
        refund.returnRequest?.order?.retailCustomer?.phoneNorm ??
        refund.returnRequest?.order?.billingSnapshot?.customer?.phone ??
        refund.returnRequest?.order?.billingSnapshot?.buyerPhone ??
        null,
      franchiseId: refund.returnRequest?.franchiseId ?? null,
      images,
      customerEvidanceImages,
      media: refund.returnRequest?.media
        ? refund.returnRequest.media.map((mediaItem: any) => ({
            ...mediaItem,
            files:
              mediaItem?.files?.map((file: string) => this.getImageUrl(file)) ||
              [],
          }))
        : [],
    };
  }

  async getRefundReceipt(refundId: string, user?: JwtUser) {
    const refund = await this.getRefund(refundId, user);
    if (!refund) {
      throw new NotFoundException(`Refund ${refundId} not found.`);
    }

    const receipt = await this.prisma.invoice.findFirst({
      where: {
        returnRequestId: refund.returnId,
        type: InvoiceType.REFUND_RECEIPT,
        isDeleted: false,
      },
    });

    if (!receipt) {
      throw new NotFoundException(
        `Refund Receipt for Refund ID ${refundId} not found.`,
      );
    }

    return receipt;
  }

  private async generateUniqueRefundNumber(tx: any): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    let isUnique = false;
    let rfNumber = '';
    while (!isUnique) {
      const randomStr = randomBytes(3).toString('hex').toUpperCase();
      rfNumber = `GFRF-${dateStr}-${randomStr}`;

      const count = await tx.refund.count({
        where: { refundNumber: rfNumber },
      });
      if (count === 0) {
        isUnique = true;
      }
    }
    return rfNumber;
  }

  private async generateUniqueDocNumber(
    prefix: string,
    tx: any,
  ): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    let isUnique = false;
    let docNumber = '';
    while (!isUnique) {
      const randomStr = randomBytes(3).toString('hex').toUpperCase();
      docNumber = `${prefix}-${dateStr}-${randomStr}`;

      const count = await tx.invoice.count({
        where: { invoiceNumber: docNumber },
      });
      if (count === 0) {
        isUnique = true;
      }
    }
    return docNumber;
  }
}
