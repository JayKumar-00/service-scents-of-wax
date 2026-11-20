import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomerLifecycleStage, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RetentionService } from '../retention.service';
import { NotificationAggregatorService } from 'src/notification/services/notification-aggregator.service';

@Injectable()
export class RetentionCronService {
  private readonly logger = new Logger(RetentionCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly retentionService: RetentionService,
    private readonly notificationAggregator: NotificationAggregatorService,
  ) {}

  /**
   * Daily retention sync cron at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncRetentionStages() {
    this.logger.log('Starting daily retention lifecycle stage sync...');
    const now = new Date();
    const dormantCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const churnedCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    try {
      // 1. Process CHURNED (>= 90 Days of inactivity)
      const churnedSnapshots = await this.prisma.retentionSnapshot.findMany({
        where: {
          stage: { not: CustomerLifecycleStage.CHURNED },
          OR: [
            {
              lastOrderAt: { lte: churnedCutoff },
            },
            {
              lastOrderAt: null,
              createdAt: { lte: churnedCutoff },
            },
          ],
        },
        include: { customer: true },
      });

      this.logger.log(
        `Found ${churnedSnapshots.length} customers transitioning to CHURNED`,
      );
      for (const snap of churnedSnapshots) {
        const refDate = snap.lastOrderAt || snap.createdAt;
        const days = Math.floor(
          (now.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000),
        );

        await this.prisma.retentionSnapshot.update({
          where: { customerId: snap.customerId },
          data: {
            stage: CustomerLifecycleStage.CHURNED,
            daysSinceLastOrder: days,
          },
        });

        // Trigger win-back campaign coupon / notification
        const todayStr = new Date().toISOString().split('T')[0];
        const campaignId = `churned_winback_${snap.customerId}_${todayStr}`;
        await this.notificationAggregator.addIntent({
          customerId: snap.customerId,
          type: 'WIN_BACK',
          payload: {
            campaignId,
            title: 'We Miss You! Special Win-back Offer Inside',
            body: 'It has been a while since your last purchase. Use code GF-MISSYOU for an exclusive ₹100 discount!',
          },
        });

        await this.retentionService.logJourney(snap.customerId, 'CHURNED', {
          days,
        });
      }

      // 2. Process DORMANT (>= 30 Days and < 90 Days of inactivity)
      const dormantSnapshots = await this.prisma.retentionSnapshot.findMany({
        where: {
          stage: {
            notIn: [
              CustomerLifecycleStage.DORMANT,
              CustomerLifecycleStage.CHURNED,
            ],
          },
          OR: [
            {
              lastOrderAt: { lte: dormantCutoff, gt: churnedCutoff },
            },
            {
              lastOrderAt: null,
              createdAt: { lte: dormantCutoff, gt: churnedCutoff },
            },
          ],
        },
        include: { customer: true },
      });

      this.logger.log(
        `Found ${dormantSnapshots.length} customers transitioning to DORMANT`,
      );
      for (const snap of dormantSnapshots) {
        const refDate = snap.lastOrderAt || snap.createdAt;
        const days = Math.floor(
          (now.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000),
        );

        await this.prisma.retentionSnapshot.update({
          where: { customerId: snap.customerId },
          data: {
            stage: CustomerLifecycleStage.DORMANT,
            daysSinceLastOrder: days,
          },
        });

        // Trigger dormant customer reminder
        const todayStr = new Date().toISOString().split('T')[0];
        const campaignId = `dormant_reminder_${snap.customerId}_${todayStr}`;
        await this.notificationAggregator.addIntent({
          customerId: snap.customerId,
          type: 'DORMANT_CUSTOMER',
          payload: {
            campaignId,
            title: 'Check out our new arrivals!',
            body: "We noticed you haven't visited in a while. Come back and check out the latest collections!",
          },
        });

        await this.retentionService.logJourney(snap.customerId, 'DORMANT', {
          days,
        });
      }

      // 3. Update daysSinceLastOrder for active customers and check win-back automation schedules
      const allSnapshots = await this.prisma.retentionSnapshot.findMany({
        include: { customer: true },
      });

      for (const snap of allSnapshots) {
        const refDate = snap.lastOrderAt || snap.createdAt;
        const days = Math.floor(
          (now.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000),
        );

        await this.prisma.retentionSnapshot.update({
          where: { customerId: snap.customerId },
          data: {
            daysSinceLastOrder: days,
          },
        });

        // Win-Back Automation check (30, 60, 90, 120 days)
        if (days === 30) {
          // Handled above in dormant transitioning, but log journey just in case
        } else if (days === 60) {
          const couponVal = 100;
          const randHex = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();
          const couponCode = `WINBACK60-${randHex}`;

          await this.prisma.$transaction(async (tx) => {
            await tx.discount.create({
              data: {
                name: `Win-Back 60 Days Coupon (₹${couponVal})`,
                code: couponCode,
                type: 'FIXED_AMOUNT',
                scope: 'CART',
                value: new Prisma.Decimal(couponVal),
                usageLimit: 1,
                usedCount: 0,
                active: true,
                startsAt: new Date(),
                endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            });
            const todayStr = new Date().toISOString().split('T')[0];
            const campaignId = `winback_60_${snap.customerId}_${todayStr}`;
            await this.notificationAggregator.addIntent({
              customerId: snap.customerId,
              type: 'WIN_BACK',
              payload: {
                campaignId,
                title: 'A Special gift for you!',
                body: `We really want you back! Use code ${couponCode} to get ₹100 off on your next purchase.`,
              },
            });
          });
        } else if (days === 90) {
          // Handled above in churned transitioning
        } else if (days === 120) {
          const couponVal = 150;
          const randHex = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();
          const couponCode = `WINBACK120-${randHex}`;

          await this.prisma.$transaction(async (tx) => {
            await tx.discount.create({
              data: {
                name: `Final Comeback 120 Days Coupon (₹${couponVal})`,
                code: couponCode,
                type: 'FIXED_AMOUNT',
                scope: 'CART',
                value: new Prisma.Decimal(couponVal),
                usageLimit: 1,
                usedCount: 0,
                active: true,
                startsAt: new Date(),
                endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            });
            const todayStr = new Date().toISOString().split('T')[0];
            const campaignId = `winback_120_${snap.customerId}_${todayStr}`;
            await this.notificationAggregator.addIntent({
              customerId: snap.customerId,
              type: 'WIN_BACK',
              payload: {
                campaignId,
                title: 'Final comeback offer - ₹150 discount!',
                body: `This is our final invite to get you back. Use coupon ${couponCode} for ₹150 off on anything in store.`,
              },
            });
          });
        }
      }

      this.logger.log('Daily retention sync completed successfully.');
    } catch (error: any) {
      this.logger.error(
        `Error during daily retention lifecycle sync: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Daily loyalty points expiry check
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyPointsExpiry() {
    try {
      await this.retentionService.expirePoints();
    } catch (err: any) {
      this.logger.error(
        `Error during daily points expiry cron: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Daily segments refresh
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailySegmentRefresh() {
    try {
      await this.retentionService.refreshCustomerSegments();
    } catch (err: any) {
      this.logger.error(
        `Error during daily segment refresh cron: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Daily abandoned cart recovery detector
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyAbandonedCart() {
    try {
      await this.retentionService.detectAbandonedCarts();
    } catch (err: any) {
      this.logger.error(
        `Error during daily abandoned cart cron: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Daily viewed but not purchased detector
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyViewedButNotPurchased() {
    try {
      await this.retentionService.detectViewedButNotPurchased();
    } catch (err: any) {
      this.logger.error(
        `Error during daily viewed but not purchased cron: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Weekly notification cleanup
   */
  @Cron(CronExpression.EVERY_WEEKEND)
  async handleWeeklyCleanup() {
    try {
      this.logger.log('Starting weekly notification cleanup...');
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await this.prisma.notificationLog.deleteMany({
        where: {
          createdAt: { lte: thirtyDaysAgo },
        },
      });
      this.logger.log('Weekly notification cleanup complete.');
    } catch (err: any) {
      this.logger.error(
        `Error during weekly cleanup cron: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Daily guest cleanup / deactivation cron
   * Deactivates or removes guests that have been inactive
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyGuestCleanup() {
    try {
      this.logger.log('Starting daily guest cleanup/deactivation...');
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // 1. Mark older guests as inactive to prevent extra load
      const deactivateResult = await this.prisma.guestCustomer.updateMany({
        where: {
          updatedAt: { lte: sevenDaysAgo },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // 2. Delete guest records older than 30 days to save DB space
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deleteResult = await this.prisma.guestCustomer.deleteMany({
        where: {
          updatedAt: { lte: thirtyDaysAgo },
        },
      });

      this.logger.log(
        `Guest cleanup complete: deactivated ${deactivateResult.count} guests, deleted ${deleteResult.count} stale guests.`,
      );
    } catch (err: any) {
      this.logger.error(
        `Error during guest cleanup cron: ${err.message}`,
        err.stack,
      );
    }
  }
}
