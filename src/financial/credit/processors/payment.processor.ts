import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreditTransactionEnum } from '@prisma/client';

@Injectable()
export class CreditPaymentProcessor {
  private readonly logger = new Logger(CreditPaymentProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(job: any) {
    const { franchiseId, amount, referenceId } = job.data;

    try {
      // 🔐 Idempotency check - prevent duplicate processing
      const existingPayment = await this.prisma.creditTransaction.findFirst({
        where: {
          franchiseId,
          referenceId,
          type: CreditTransactionEnum.PAYMENT,
        },
      });

      if (existingPayment) {
        this.logger.warn(
          `Payment already processed for referenceId: ${referenceId}. Skipping duplicate.`,
        );
        return;
      }

      const account = await this.prisma.creditAccount.findUnique({
        where: { franchiseId },
      });

      if (!account) {
        this.logger.warn(
          `Cannot process payment: credit account not found for franchise ${franchiseId}`,
        );
        return;
      }

      // 🎯 Only log/audit - DO NOT modify balance again
      // Balance was already updated in recordPayment()
      this.logger.log(
        `[PaymentProcessor] Payment confirmed for franchise ${franchiseId}, amount: ${amount}, referenceId: ${referenceId}`,
      );

      // TODO: Send confirmation email/webhook to payment gateway
      // TODO: Update payment status in external system
      // TODO: Trigger any post-payment workflows
    } catch (error) {
      this.logger.error(
        `[PaymentProcessor] Failed to process payment for franchise ${franchiseId}:`,
        error,
      );
      throw error;
    }
  }
}
