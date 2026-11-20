import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CreditEventEnum } from '../enums/credit.enum';
import { CreditEventEmitter } from '../events/credit.event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CreditAutoRefillCron {
  constructor(
    private creditEventEmitter: CreditEventEmitter,
    private prisma: PrismaService,
  ) {}

  /**
   * Runs every 15 days - Auto-refill credit for franchises that used credit
   * Only refills if:
   * 1. Credit was actually used in last 15 days
   * 2. Automation is enabled
   * 3. Not paused
   */
  @Cron('0 3 */15 * *') // Every 15 days at 3:00 AM
  async runAutoRefill() {
    try {
      // Get all franchises with active credit accounts and auto-credit-increase enabled
      const creditAccounts = await this.prisma.creditAccount.findMany({
        where: {
          status: 'ACTIVE',
          autoCreditIncreaseEnabled: true,
        },
        include: { franchise: { select: { id: true } } },
      });

      let processedCount = 0;
      let skippedCount = 0;

      for (const account of creditAccounts) {
        try {
          // 🔐 Check if automation is paused (filter in memory)
          const pausedUntil = (account as any).automationPausedUntil;
          if (pausedUntil && pausedUntil > new Date()) {
            skippedCount++;
            continue;
          }

          // 🔐 Check if they have more than 3 overdue credits. If so, automatically disable autoCreditIncreaseEnabled.
          const overdueCount = await this.prisma.creditDue.count({
            where: {
              franchiseId: account.franchiseId,
              status: 'OVERDUE',
            },
          });

          if (overdueCount > 3) {
            await this.prisma.creditAccount.update({
              where: { id: account.id },
              data: { autoCreditIncreaseEnabled: false },
            });
            console.warn(
              `[CreditAutoRefillCron] Franchise ${account.franchiseId} has ${overdueCount} overdue credits. Auto-credit increase automatically disabled.`,
            );
            skippedCount++;
            continue;
          }

          // Find the last auto-refill transaction for this franchise
          const lastRefill = await this.prisma.creditTransaction.findFirst({
            where: {
              franchiseId: account.franchiseId,
              type: 'ADJUSTMENT',
              description: { contains: 'Auto-refill' },
            },
            orderBy: { createdAt: 'desc' },
          });

          // Start of current cycle is either the last refill date or account creation date
          const cycleStart = lastRefill
            ? lastRefill.createdAt
            : account.createdAt;

          // Find the earliest credit usage (order or payment) in the current cycle
          const firstUsage = await this.prisma.creditTransaction.findFirst({
            where: {
              franchiseId: account.franchiseId,
              createdAt: { gt: cycleStart },
              type: { in: ['ORDER', 'PAYMENT'] },
            },
            orderBy: { createdAt: 'asc' },
          });

          if (!firstUsage) {
            skippedCount++;
            continue;
          }

          // Check if that earliest usage occurred more than 15 days ago
          const fifteenDaysAgo = new Date(
            Date.now() - 15 * 24 * 60 * 60 * 1000,
          );

          if (firstUsage.createdAt > fifteenDaysAgo) {
            skippedCount++;
            continue;
          }

          // Emit auto-refill event
          await this.creditEventEmitter.emit(
            CreditEventEnum.CREDIT_AUTO_REFILL,
            {
              franchiseId: account.franchiseId,
            },
          );

          processedCount++;
        } catch (error) {
          console.error(
            `[CreditAutoRefillCron] Failed to process auto-refill for franchise ${account.franchiseId}:`,
            error,
          );
        }
      }

      console.log(
        `[CreditAutoRefillCron] Auto-refill completed. Processed: ${processedCount}, Skipped: ${skippedCount}`,
      );
    } catch (error) {
      console.error('[CreditAutoRefillCron] Auto-refill scan failed:', error);
    }
  }
}
