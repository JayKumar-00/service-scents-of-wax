import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentForEnum } from '../enums/payment.enum';
import { CreditService } from 'src/financial/credit/credit.service';
import { OrdersService } from 'src/orders/orders.service';
import { BrevoService } from 'src/notification/services/brevo.service';
import { StockRequestPaymentTemplate } from 'src/notification/templates/stock-request.template';
import {
  NotificationChannel,
  NotificationType,
  Role,
  StockRequestPaymentMode,
  StockRequestPaymentStatus,
} from '@prisma/client';

@Injectable()
export class PaymentProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    @Inject(forwardRef(() => OrdersService))
    private readonly orderService: OrdersService,
    private readonly brevoService: BrevoService,
  ) {}

  async handle(job: Job<any>) {
    const { financialEventId } = job.data;

    const event = await this.prisma.financialEvent.findUnique({
      where: { id: financialEventId },
    });

    if (!event) throw new BadRequestException('Financial event not found');

    if (event.processed) return;

    const metadata: any = event.metadata;
    let paymentEmail: {
      to: string;
      htmlContent: string;
      subject: string;
    } | null = null;

    await this.prisma.$transaction(async (tx) => {
      if (event.type === PaymentForEnum.CREDITS) {
        await this.creditService.processCreditPayment(
          tx,
          metadata.accountId,
          Number(event.amount),
          event.razorpayPaymentId!,
        );

        await tx.ledgerEntry.create({
          data: {
            eventId: event.id,
            actorType: 'FRANCHISE',
            actorId: metadata.franchiseId,
            direction: 'CREDIT',
            amount: event.amount,
            status: 'POSTED',
          },
        });
      }

      if (event.type === PaymentForEnum.PRODUCTS) {
        await this.orderService.markOrderPaid(
          tx,
          metadata.orderId,
          event.razorpayPaymentId!,
        );

        await tx.ledgerEntry.create({
          data: {
            eventId: event.id,
            actorType: 'CUSTOMER',
            actorId: metadata.userId,
            direction: 'CREDIT',
            amount: event.amount,
            status: 'POSTED',
          },
        });
      }

      if (event.type === PaymentForEnum.STOCK_REQUESTS) {
        console.log('Processing stock request payment for event:', event.id);
        const stockRequest = await tx.stockRequest.findUnique({
          where: { id: metadata.stockRequestId },
          include: {
            franchise: true,
          },
        });

        if (!stockRequest) {
          throw new BadRequestException('Stock request not found');
        }

        const billingTotal = Number(stockRequest.billingTotal || event.amount);
        const alreadyPaid = Number(stockRequest.paidAmount || 0);
        const totalPaidNow = Number(event.amount);
        const newPaidAmount = alreadyPaid + totalPaidNow;

        await tx.stockRequest.update({
          where: { id: stockRequest.id },
          data: {
            paymentMode: StockRequestPaymentMode.DIRECT,
            creditDuration: null,
            paymentNote: `Razorpay order created: ${event.razorpayOrderId}, payment captured: ${event.razorpayPaymentId}`,
            paidAmount: newPaidAmount,
            remainingAmount: Math.max(billingTotal - newPaidAmount, 0),
            isFullyPaid: newPaidAmount >= billingTotal,
            paymentStatus:
              newPaidAmount >= billingTotal
                ? StockRequestPaymentStatus.PAID
                : StockRequestPaymentStatus.PARTIALLY_PAID,
            paymentReference: event.razorpayPaymentId,
            paymentReceivedAt: new Date(),
          },
        });

        await tx.ledgerEntry.create({
          data: {
            eventId: event.id,
            actorType: 'FRANCHISE',
            actorId: metadata.franchiseId,
            direction: 'CREDIT',
            amount: event.amount,
            status: 'POSTED',
          },
        });

        const ownerUser = await tx.user.findFirst({
          where: {
            franchiseId: metadata.franchiseId,
            role: Role.FRANCHISE_OWNER,
          },
          select: {
            id: true,
            email: true,
          },
        });

        if (ownerUser) {
          const paymentStatus =
            newPaidAmount >= billingTotal
              ? StockRequestPaymentStatus.PAID
              : StockRequestPaymentStatus.PARTIALLY_PAID;

          await tx.notification.create({
            data: {
              userId: ownerUser.id,
              title:
                paymentStatus === StockRequestPaymentStatus.PAID
                  ? 'Stock Request Payment Verified'
                  : 'Stock Request Payment Partially Verified',
              body:
                paymentStatus === StockRequestPaymentStatus.PAID
                  ? `Your stock request payment has been verified successfully. The request is fully paid.`
                  : `Your stock request payment has been verified successfully, but the request is still partially paid.`,
              type: NotificationType.FRANCHISE_STOCK_REQUEST,
              channel: NotificationChannel.IN_APP,
              metadata: {
                stockRequestId: stockRequest.id,
                franchiseId: metadata.franchiseId,
                franchiseCode: stockRequest.franchise.code,
                businessName:
                  stockRequest.franchise.businessName ||
                  stockRequest.franchise.name ||
                  'N/A',
                ownerName:
                  stockRequest.franchise.ownerFullName ||
                  stockRequest.franchise.name ||
                  'N/A',
                paymentReference: event.razorpayPaymentId ?? undefined,
                paidAmount: newPaidAmount,
                remainingAmount: Math.max(billingTotal - newPaidAmount, 0),
                paymentStatus,
              },
            },
          });

          paymentEmail = {
            to: ownerUser.email,
            subject:
              paymentStatus === StockRequestPaymentStatus.PAID
                ? 'STOCK REQUEST PAYMENT VERIFIED'
                : 'STOCK REQUEST PAYMENT PARTIALLY VERIFIED',
            htmlContent: StockRequestPaymentTemplate.build({
              stockRequestId: stockRequest.id,
              franchiseCode: stockRequest.franchise.code,
              businessName:
                stockRequest.franchise.businessName ||
                stockRequest.franchise.name ||
                'N/A',
              ownerName:
                stockRequest.franchise.ownerFullName ||
                stockRequest.franchise.name ||
                'N/A',
              totalAmount: billingTotal,
              cashAmount: 0,
              deductedAmount: Number(event.amount),
              remainingAmount: Math.max(billingTotal - newPaidAmount, 0),
              paymentStatus,
              paymentReference: event.razorpayPaymentId ?? undefined,
              title:
                paymentStatus === StockRequestPaymentStatus.PAID
                  ? 'Stock Request Payment Verified'
                  : 'Stock Request Payment Partially Verified',
              intro:
                paymentStatus === StockRequestPaymentStatus.PAID
                  ? 'Your stock request payment has been verified successfully.'
                  : 'Your stock request payment has been verified successfully, but the request is still partially paid.',
            }),
          };

          // Notify SuperAdmin via in-app notification
          const adminUser = await tx.user.findFirst({
            where: { role: Role.SUPERADMIN },
            select: { id: true },
          });

          if (adminUser) {
            await tx.notification.create({
              data: {
                userId: adminUser.id,
                title:
                  paymentStatus === StockRequestPaymentStatus.PAID
                    ? 'Stock Request Payment Received'
                    : 'Stock Request Partial Payment Received',
                body:
                  paymentStatus === StockRequestPaymentStatus.PAID
                    ? `Stock request ${stockRequest.id} has been fully paid by franchise ${stockRequest.franchise.name} (${stockRequest.franchise.code}).`
                    : `Stock request ${stockRequest.id} has received a partial payment from franchise ${stockRequest.franchise.name} (${stockRequest.franchise.code}).`,
                type: NotificationType.FRANCHISE_STOCK_REQUEST,
                channel: NotificationChannel.IN_APP,
                metadata: {
                  stockRequestId: stockRequest.id,
                  franchiseId: metadata.franchiseId,
                  franchiseCode: stockRequest.franchise.code,
                  ownerName:
                    stockRequest.franchise.ownerFullName ||
                    stockRequest.franchise.name ||
                    'N/A',
                  paidAmount: newPaidAmount,
                  remainingAmount: Math.max(billingTotal - newPaidAmount, 0),
                  paymentStatus,
                  paymentReference: event.razorpayPaymentId ?? undefined,
                },
              },
            });
          }
        }
      }

      await tx.financialEvent.update({
        where: { id: event.id },
        data: { processed: true },
      });
    });

    if (event.type === PaymentForEnum.PRODUCTS) {
      try {
        await this.orderService.generateInvoiceForOrderId(metadata.orderId);
      } catch (err: any) {
        console.error(
          `Failed to generate invoice for order ${metadata.orderId} after processing payment: ${err.message}`,
        );
      }
    }

    if (paymentEmail) {
      await this.brevoService.sendEmail(paymentEmail);
    }
  }
}
