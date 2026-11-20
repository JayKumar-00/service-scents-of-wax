import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CreditAutoRefillProcessor {
  private readonly logger = new Logger(CreditAutoRefillProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(job: any) {
    const { franchiseId } = job.data;

    try {
      const account = await this.prisma.creditAccount.findUnique({
        where: { franchiseId },
      });

      if (!account) {
        this.logger.warn(
          `Credit account not found for franchise ${franchiseId}`,
        );
        return;
      }

      // 🔐 Check if automation is paused
      const pausedUntil = (account as any).automationPausedUntil;
      if (pausedUntil && pausedUntil > new Date()) {
        this.logger.warn(
          `Auto-refill paused for franchise ${franchiseId} until ${pausedUntil}`,
        );
        return;
      }

      // 🔐 Check if auto-credit-increase is enabled
      const autoCreditIncreaseEnabled = (account as any)
        .autoCreditIncreaseEnabled;
      if (autoCreditIncreaseEnabled === false) {
        this.logger.warn(
          `Auto-credit-increase is disabled for franchise ${franchiseId}`,
        );
        return;
      }

      // 🔐 Check if they have more than 3 overdue credits. If so, automatically disable autoCreditIncreaseEnabled.
      const overdueCount = await this.prisma.creditDue.count({
        where: {
          franchiseId,
          status: 'OVERDUE',
        },
      });

      if (overdueCount > 3) {
        await this.prisma.creditAccount.update({
          where: { id: account.id },
          data: { autoCreditIncreaseEnabled: false },
        });
        this.logger.warn(
          `Franchise ${franchiseId} has ${overdueCount} overdue credits. Auto-credit increase automatically disabled.`,
        );
        return;
      }

      // Find the last auto-refill transaction for this franchise
      const lastRefill = await this.prisma.creditTransaction.findFirst({
        where: {
          franchiseId,
          type: 'ADJUSTMENT',
          description: { contains: 'Auto-refill' },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Start of current cycle is either the last refill date or account creation date
      const cycleStart = lastRefill ? lastRefill.createdAt : account.createdAt;

      // Find the earliest credit usage (order or payment) in the current cycle
      const firstUsage = await this.prisma.creditTransaction.findFirst({
        where: {
          franchiseId,
          createdAt: { gt: cycleStart },
          type: { in: ['ORDER', 'PAYMENT'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!firstUsage) {
        this.logger.warn(
          `No credit usage found since last refill/creation for franchise ${franchiseId}. Skipping refill.`,
        );
        return;
      }

      // Check if that earliest usage occurred more than 15 days ago
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

      if (firstUsage.createdAt > fifteenDaysAgo) {
        this.logger.warn(
          `Earliest credit usage for franchise ${franchiseId} was on ${firstUsage.createdAt}, which is less than 15 days ago. Skipping refill.`,
        );
        return;
      }

      // 🎯 Only refill to totalCredit limit (not beyond)
      const beforeBalance = Number(account.usedCredit);
      const creditLimit = Number(account.totalCredit);

      // Don't refill if already at limit
      if (beforeBalance <= 0) {
        this.logger.log(
          `Franchise ${franchiseId} credit is already at limit. No refill needed.`,
        );
        return;
      }

      // Calculate how much to refill (to reach the limit, not beyond)
      const refillAmount = beforeBalance;
      const afterBalance = 0; // Reset to 0 (full credit available)

      // Calculate due date based on the account's configured duration (15, 30, or 45 days)
      let days = 15;
      if (account.duration === 'DAY_30') days = 30;
      else if (account.duration === 'DAY_45') days = 45;

      const dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      await this.prisma.$transaction(async (tx) => {
        // Create a PENDING CreditDue record for the amount being refilled
        await tx.creditDue.create({
          data: {
            franchiseId,
            accountId: account.id,
            outstanding: refillAmount,
            dueDate,
            status: 'PENDING',
          },
        });

        // Create refill transaction
        await tx.creditTransaction.create({
          data: {
            franchiseId,
            accountId: account.id,
            type: 'ADJUSTMENT', // Auto-refill is tracked as adjustment
            amount: refillAmount,
            direction: 'CREDIT',
            balanceBefore: beforeBalance,
            balanceAfter: afterBalance,
            description: `Auto-refill after 15 days of usage (refill limit: ${creditLimit})`,
          },
        });

        // Update account
        await tx.creditAccount.update({
          where: { id: account.id },
          data: {
            usedCredit: afterBalance,
            availableCredit: creditLimit - afterBalance,
          },
        });
      });

      this.logger.log(
        `[CreditAutoRefillProcessor] Auto-refilled ₹${refillAmount} for franchise ${franchiseId}`,
      );
    } catch (error) {
      this.logger.error(
        `[CreditAutoRefillProcessor] Failed to process auto-refill for franchise ${franchiseId}:`,
        error,
      );
      throw error;
    }
  }
}
