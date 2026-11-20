import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderChannel, OrderStatus, OnlinePaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../../financial/payment/razorpay.service';

@Injectable()
export class OrderRefundCron {
  private readonly logger = new Logger(OrderRefundCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Cron('0 */15 * * * *') // Run every 15 minutes
  async processCancelledOrderRefunds() {
    this.logger.log('Starting order refund check for cancelled orders...');
    try {
      // Find all online orders that are CANCELLED and PAID but not yet refunded
      const orders = await this.prisma.order.findMany({
        where: {
          channel: OrderChannel.ONLINE,
          status: OrderStatus.CANCELLED,
          onlinePaymentStatus: OnlinePaymentStatus.PAID,
          paymentReference: {
            not: null,
          },
        },
      });

      // Filter out orders that have already been refunded in our database
      const eligibleOrders = orders.filter(
        (order) =>
          order.paymentReference &&
          !order.paymentReference.trim().startsWith('REFUNDED:'),
      );

      if (eligibleOrders.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${eligibleOrders.length} cancelled paid orders pending refund processing.`,
      );

      for (const order of eligibleOrders) {
        const paymentId = order.paymentReference!;
        this.logger.log(
          `Processing refund for order #${order.orderNumber} (payment ID: ${paymentId})...`,
        );

        try {
          // 1. Fetch payment status from Razorpay to check if it's already refunded
          const payment = await this.razorpayService.fetchTransaction(paymentId);
          if (
            payment &&
            (payment.refund_status === 'full' ||
              payment.status === 'refunded' ||
              Number(payment.amount_refunded_rupees || 0) >= Number(payment.amount_rupees || 0))
          ) {
            this.logger.log(
              `Order #${order.orderNumber} payment was already refunded on Razorpay. Updating DB reference.`,
            );
            await this.prisma.order.update({
              where: { id: order.id },
              data: {
                paymentReference: `REFUNDED:already:${paymentId}`,
              },
            });
            continue;
          }

          const refundAmount = Number(order.total);
          if (isNaN(refundAmount) || refundAmount <= 0) {
            this.logger.error(
              `Invalid total amount (${order.total}) for order #${order.orderNumber}. Skipping automated refund.`,
            );
            continue;
          }

          // 2. Perform the refund
          this.logger.log(
            `Initiating refund on Razorpay for payment ${paymentId} (amount: ${refundAmount})...`,
          );
          const refund = await this.razorpayService.refundPayment({
            paymentId,
            amount: refundAmount,
          });

          const refundId = refund?.id || 'unknown';

          // 3. Update the order reference to prevent duplicate refunds
          await this.prisma.order.update({
            where: { id: order.id },
            data: {
              paymentReference: `REFUNDED:${refundId}:${paymentId}`,
            },
          });

          this.logger.log(
            `Successfully processed refund for order #${order.orderNumber} (Refund ID: ${refundId})`,
          );
        } catch (err: any) {
          // Check if error response shows already fully refunded
          const errorMessage = err?.message || err?.toString() || '';
          const responseBody = err?.getResponse ? JSON.stringify(err.getResponse()) : '';

          if (
            errorMessage.includes('already been fully refunded') ||
            responseBody.includes('already been fully refunded')
          ) {
            this.logger.log(
              `Razorpay reported payment ${paymentId} is already fully refunded. Marking in DB.`,
            );
            await this.prisma.order.update({
              where: { id: order.id },
              data: {
                paymentReference: `REFUNDED:already:${paymentId}`,
              },
            });
          } else {
            this.logger.error(
              `Failed to process refund for order #${order.orderNumber}: ${errorMessage} - Response: ${responseBody}`,
            );
          }
        }
      }
    } catch (e: any) {
      this.logger.error(`Error in OrderRefundCron: ${e.message}`);
    }
  }
}
