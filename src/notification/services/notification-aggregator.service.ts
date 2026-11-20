import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from './notification.service';
import { BrevoService } from './brevo.service';
import { NotificationType } from '../enums/notification-type.enum';
import { Prisma } from '@prisma/client';
import { RedisService } from 'src/redis/redis.service';
import * as crypto from 'crypto';

export enum RetentionIntentType {
  ABANDONED_CART = 'ABANDONED_CART',
  VIEWED_NOT_PURCHASED = 'VIEWED_NOT_PURCHASED',
  PRODUCT_SUGGESTION = 'PRODUCT_SUGGESTION',
  WIN_BACK = 'WIN_BACK',
  DORMANT_CUSTOMER = 'DORMANT_CUSTOMER',
}

export enum RetentionIntentStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  SKIPPED = 'SKIPPED',
}

export enum NotificationLogStatus {
  PENDING_DELIVERY = 'PENDING_DELIVERY',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export enum NotificationCampaignStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
}

export interface RetentionIntent {
  customerId: string;
  type: 'ABANDONED_CART' | 'VIEWED_NOT_PURCHASED' | 'PRODUCT_SUGGESTION' | 'WIN_BACK' | 'DORMANT_CUSTOMER';
  payload: {
    campaignId: string;
    title: string;
    body: string;
    campaignType?: string;
    categoryId?: string;
  };
}

@Injectable()
export class NotificationAggregatorService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationAggregatorService.name);
  private readonly activeIntervals = new Set<NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly brevoService: BrevoService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Gracefully clean up active Redis heartbeat intervals on application shutdown/SIGTERM.
   */
  onModuleDestroy() {
    this.logger.log('Cleaning up active lock heartbeat intervals for graceful shutdown...');
    for (const interval of this.activeIntervals) {
      clearInterval(interval);
    }
    this.activeIntervals.clear();
  }

  /**
   * Add a retention intent to persistent DB storage
   */
  async addIntent(intent: RetentionIntent): Promise<void> {
    try {
      await this.prisma.retentionNotificationIntent.create({
        data: {
          customerId: intent.customerId,
          type: intent.type,
          payload: intent.payload as any,
          status: RetentionIntentStatus.PENDING,
        },
      });
      this.logger.log(`Persisted retention intent ${intent.type} in DB for customer ${intent.customerId}`);
    } catch (err: any) {
      this.logger.error(`Failed to persist retention intent: ${err.message}`);
      throw err;
    }
  }

  /**
   * Process all pending aggregated notifications (triggered daily)
   */
  @Cron('0 5 0 * * *') // Run daily at 12:05 AM
  async processAggregatedNotifications() {
    const cronStartTime = new Date();
    this.logger.log({
      action: 'RETENTION_AGGREGATION_START',
      message: `Starting daily notification aggregation processing... (Snapshot Time: ${cronStartTime.toISOString()})`,
    });
    
    // Execution state isolated context to prevent concurrent cron collision issues
    const executionState = {
      cronLockLost: false,
    };

    // Multi-instance safe cron lock with owner token
    const lockKey = 'lock:notification-aggregator:cron';
    const lockToken = crypto.randomUUID();
    const acquired = await this.redisService.redisClient.set(lockKey, lockToken, 'EX', 600, 'NX');
    if (!acquired) {
      this.logger.log('Notification aggregator cron already running on another instance.');
      return;
    }

    // Lock Heartbeat Renewal Loop (extended every 30s for a 600s TTL to prevent latency timeouts)
    let cronRenewing = false;
    let cronRenewalFailures = 0;
    const renewalInterval = setInterval(async () => {
      if (cronRenewing) return;
      cronRenewing = true;
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], 600)
        else
          return 0
        end
      `;
      try {
        const renewed = await this.redisService.redisClient.eval(script, 1, lockKey, lockToken);
        if (renewed === 0 || renewed === '0') {
          this.logger.error(`Lost ownership of lock ${lockKey}. Stopping aggregation loop.`);
          executionState.cronLockLost = true;
          clearInterval(renewalInterval);
          this.activeIntervals.delete(renewalInterval);
        } else {
          cronRenewalFailures = 0; // Reset failures on successful heartbeats
        }
      } catch (err: any) {
        cronRenewalFailures++;
        this.logger.error(`Failed to renew aggregator cron lock heartbeat: ${err.message} (Failure count: ${cronRenewalFailures})`);
        if (cronRenewalFailures >= 3) {
          this.logger.error(`Cron lock renewal failed 3 consecutive times. Halting execution.`);
          executionState.cronLockLost = true;
          clearInterval(renewalInterval);
          this.activeIntervals.delete(renewalInterval);
        }
      } finally {
        cronRenewing = false;
      }
    }, 30000);

    this.activeIntervals.add(renewalInterval);

    try {
      // Deterministic cursor pagination to prevent OOM errors and customer skipping.
      // By restricting query scope to intents created BEFORE cronStartTime, the eligible records set
      // remains static throughout execution, eliminating pagination drift/new intent customer skips.
      let lastCustomerId: string | null = null;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        if (executionState.cronLockLost) {
          this.logger.error('Cron lock ownership lost globally. Halting batch loop pagination.');
          break;
        }

        const whereClause: Prisma.RetentionNotificationIntentWhereInput = {
          status: RetentionIntentStatus.PENDING,
          createdAt: { lt: cronStartTime },
          OR: [
            { deferredUntil: null },
            { deferredUntil: { lte: cronStartTime } },
          ],
        };
        if (lastCustomerId) {
          whereClause.customerId = { gt: lastCustomerId };
        }

        const pendingCustomers = await this.prisma.retentionNotificationIntent.findMany({
          where: whereClause,
          select: { customerId: true },
          distinct: ['customerId'],
          orderBy: { customerId: 'asc' },
          take: batchSize,
        });

        if (pendingCustomers.length === 0) {
          hasMore = false;
          break;
        }

        this.logger.log(`Processing batch of ${pendingCustomers.length} customer(s) (lastCustomerId: ${lastCustomerId || 'START'}).`);

        // High-performance concurrency pool (limit: 20 parallel workers)
        const tasks = pendingCustomers.map((pending: { customerId: string }) => () => this.processCustomerIntents(pending.customerId, cronStartTime, executionState));
        await this.runWithConcurrencyLimit(tasks, 20);

        // Update cursor tracker
        lastCustomerId = pendingCustomers[pendingCustomers.length - 1].customerId;

        if (pendingCustomers.length < batchSize) {
          hasMore = false;
        }
      }

    } catch (err: any) {
      this.logger.error(`Error processing aggregated notifications: ${err.message}`);
    } finally {
      clearInterval(renewalInterval);
      this.activeIntervals.delete(renewalInterval);
      // Clean up / release the cron lock safely if still owned
      if (!executionState.cronLockLost) {
        await this.releaseLock(lockKey, lockToken);
      }
    }
  }

  /**
   * Process and merge intents for a single customer
   */
  private async processCustomerIntents(customerId: string, cronStartTime: Date, executionState: { cronLockLost: boolean }) {
    if (executionState.cronLockLost) {
      this.logger.error(`Aborting processing for customer ${customerId}: cron lock ownership lost globally.`);
      return;
    }

    const customerLockKey = `lock:retention-customer:${customerId}`;
    const lockToken = crypto.randomUUID();
    // 5-minute TTL on lock combined with 15s API timeouts prevents premature lock expiration race conditions
    const acquired = await this.redisService.redisClient.set(customerLockKey, lockToken, 'EX', 300, 'NX');
    if (!acquired) {
      this.logger.warn(`Could not lock customer ${customerId} for processing - skipping.`);
      return;
    }

    let lockLost = false;
    const checkLock = () => {
      if (lockLost) {
        throw new Error(`Customer lock ownership lost for customer ${customerId}`);
      }
      if (executionState.cronLockLost) {
        throw new Error(`Aggregator cron lock ownership lost globally`);
      }
    };

    // Customer Lock Heartbeat Renewal Loop (extended every 15s for a 300s TTL to prevent latency timeouts)
    let customerRenewing = false;
    let customerRenewalFailures = 0;
    const customerRenewalInterval = setInterval(async () => {
      if (customerRenewing) return;
      customerRenewing = true;
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], 300)
        else
          return 0
        end
      `;
      try {
        const renewed = await this.redisService.redisClient.eval(script, 1, customerLockKey, lockToken);
        if (renewed === 0 || renewed === '0') {
          this.logger.error(`Lost ownership of lock ${customerLockKey}. Stopping customer processing.`);
          lockLost = true;
          clearInterval(customerRenewalInterval);
          this.activeIntervals.delete(customerRenewalInterval);
        } else {
          customerRenewalFailures = 0;
        }
      } catch (err: any) {
        customerRenewalFailures++;
        this.logger.error(`Failed to renew customer lock heartbeat for ${customerId}: ${err.message} (Failure count: ${customerRenewalFailures})`);
        if (customerRenewalFailures >= 3) {
          this.logger.error(`Customer lock renewal failed 3 consecutive times. Halting customer processing.`);
          lockLost = true;
          clearInterval(customerRenewalInterval);
          this.activeIntervals.delete(customerRenewalInterval);
        }
      } finally {
        customerRenewing = false;
      }
    }, 15000);

    this.activeIntervals.add(customerRenewalInterval);

    try {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        include: { user: true },
      });

      if (!customer) {
        this.logger.warn(`Customer ${customerId} not found in DB - skipping and marking intents SKIPPED.`);
        await this.prisma.retentionNotificationIntent.updateMany({
          where: { customerId, status: RetentionIntentStatus.PENDING },
          data: { status: RetentionIntentStatus.SKIPPED, processedAt: new Date() },
        });
        
        this.logger.log({
          action: 'RETENTION_SKIPPED',
          customerId,
          reason: 'Customer not found in DB',
        });
        return;
      }

      // Query pending, non-deferred intents sorted in deterministic ascending creation order with safety take limit to prevent memory spikes
      // Constrained to intents created before cronStartTime to avoid pagination skip race conditions.
      const allPending = await this.prisma.retentionNotificationIntent.findMany({
        where: {
          customerId,
          status: RetentionIntentStatus.PENDING,
          createdAt: { lt: cronStartTime },
          OR: [
            { deferredUntil: null },
            { deferredUntil: { lte: cronStartTime } },
          ],
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 5001,
      });

      if (allPending.length === 0) return;

      const hasMoreIntents = allPending.length > 5000;
      const dbIntents = hasMoreIntents ? allPending.slice(0, 5000) : allPending;

      if (hasMoreIntents) {
        this.logger.warn({
          action: 'RETENTION_INTENT_TRUNCATION',
          customerId,
          message: `Customer ${customerId} has more than 5000 pending intents. Truncating fetch to 5000 to prevent OOM spikes.`,
        });
      }

      const intents: RetentionIntent[] = dbIntents.map((dbi) => ({
        customerId: dbi.customerId,
        type: dbi.type as any,
        payload: dbi.payload as any,
      }));

      // Dedup identical intents (same type and campaignId) to be safe
      const uniqueIntentsMap = new Map<string, RetentionIntent>();
      for (const intent of intents) {
        const key = `${intent.type}:${intent.payload.campaignId}`;
        uniqueIntentsMap.set(key, intent);
      }
      const uniqueIntents = Array.from(uniqueIntentsMap.values());

      // Priority ordering
      const priorityMap: Record<string, number> = {
        [RetentionIntentType.ABANDONED_CART]: 1,
        [RetentionIntentType.VIEWED_NOT_PURCHASED]: 2,
        [RetentionIntentType.PRODUCT_SUGGESTION]: 3,
        [RetentionIntentType.WIN_BACK]: 4,
        [RetentionIntentType.DORMANT_CUSTOMER]: 5,
      };

      uniqueIntents.sort((a, b) => {
        return (priorityMap[a.type] || 99) - (priorityMap[b.type] || 99);
      });

      const primaryIntent = uniqueIntents[0];
      const reasons = uniqueIntents.map((i) => i.type);
      const primaryReason = primaryIntent.type;

      let finalTitle = primaryIntent.payload.title;
      let finalBody = primaryIntent.payload.body;

      // Generate merged notification if multiple unique intents exist
      if (uniqueIntents.length > 1) {
        if (reasons.includes(RetentionIntentType.ABANDONED_CART)) {
          finalTitle = 'Complete your purchase and discover products selected for you';
          finalBody = `We noticed you left some items in your cart. Check them out now, and explore other personal recommendations waiting for you!`;
        } else if (reasons.includes(RetentionIntentType.VIEWED_NOT_PURCHASED) || reasons.includes(RetentionIntentType.PRODUCT_SUGGESTION)) {
          finalTitle = 'Still thinking about these products?';
          finalBody = `Check out the items you recently viewed and some new suggestions chosen just for you!`;
        } else {
          finalTitle = 'Special updates and offers waiting for you!';
          finalBody = `We miss you! Come check out the latest arrivals and exclusive updates made for you.`;
        }
      }

      // Collect all campaign IDs involved in the merged notifications to update counts correctly
      const campaignIds = Array.from(new Set(uniqueIntents.map((i) => i.payload.campaignId)));
      const primaryCampaignId = primaryIntent.payload.campaignId;

      this.logger.log({
        action: 'RETENTION_CUSTOMER_PROCESSING',
        customerId,
        primaryReason,
        reasons,
        campaignIds,
      });

      checkLock();

      // 1. Transaction to check limits, deduplicate, and create initial log (DATABASE ONLY with 30s timeout)
      const checkResult = await this.prisma.$transaction(async (tx) => {
        const res = await this.checkAndCreateLog(
          tx,
          customerId,
          primaryCampaignId,
          finalTitle,
          finalBody,
        );

        if (res.success && res.logId) {
          // Keep it
        } else if (res.skip) {
          // Suppressed business logic: mark intents processed in current execution as SKIPPED
          const processedIntentIds = dbIntents.map((i) => i.id);
          await this.batchUpdateIntents(tx, processedIntentIds, RetentionIntentStatus.SKIPPED, new Date(), 0, null);
        } else if (res.retryLater) {
          // Align deferral with the next cron execution time (tomorrow at 12:05 AM)
          const nextCronTime = new Date();
          nextCronTime.setDate(nextCronTime.getDate() + 1);
          nextCronTime.setHours(0, 5, 0, 0);

          const processedIntentIds = dbIntents.map((i) => i.id);
          await this.batchUpdateIntents(tx, processedIntentIds, RetentionIntentStatus.PENDING, null, 0, nextCronTime);
        }
        return res;
      }, { timeout: 30000, maxWait: 10000 });

      checkLock();

      // 2. If check was successful and we created a log, attempt delivery (OUTSIDE TRANSACTION)
      if (checkResult && checkResult.success && checkResult.logId) {
        const notificationLogId = checkResult.logId;
        let deliverySuccess = false;
        let deliveryError: string | null = null;

        let pushSuccess = false;
        let emailSuccess = false;
        let pushError: string | null = null;
        let emailError: string | null = null;

        // **Delivery Semantics Comment**:
        // Our system follows "At-least-one channel delivery success" model. If push notification succeeds 
        // but email fails, we consider the customer reached and mark the log as DELIVERED.
        
        // Try push notification
        try {
          checkLock();
          await this.withTimeout(
            this.notificationService.notify({
              userId: customer.userId,
              title: finalTitle,
              body: finalBody,
              type: NotificationType.RETENTION,
              metadata: {
                notificationType: 'RETENTION',
                customerId,
                primaryReason,
                reasons,
              },
            }),
            15000,
            'Push notification delivery timed out after 15 seconds',
          );
          pushSuccess = true;
        } catch (err: any) {
          pushError = err.message;
          this.logger.error(`Push notification failed for customer ${customerId}: ${err.message}`);
        }

        // Try email trigger
        if (customer.user?.email) {
          try {
            checkLock();
            await this.withTimeout(
              this.brevoService.sendEmail({
                to: customer.user.email,
                subject: finalTitle,
                htmlContent: `<p>${finalBody}</p>`,
              }),
              15000,
              'Email delivery timed out after 15 seconds',
            );
            emailSuccess = true;
          } catch (err: any) {
            emailError = err.message;
            this.logger.error(`Email delivery failed for customer ${customerId}: ${err.message}`);
          }
        }

        checkLock();
        deliverySuccess = pushSuccess || emailSuccess;
        if (!deliverySuccess) {
          deliveryError = `Push failed: ${pushError || 'N/A'}. Email failed: ${emailError || 'N/A'}`;
        }

        checkLock();

        // 3. Update DB state in a second transaction based on delivery success (DATABASE ONLY with 30s timeout)
        // Transactional consistency: No try-catch blocks swallowing campaign database updates.
        // If updating campaign counters fails, the transaction is rejected, rolling back all associated intent updates.
        await this.prisma.$transaction(async (tx) => {
          const processedIntentIds = dbIntents.map((i) => i.id);

          if (deliverySuccess) {
            // Update log to DELIVERED
            await tx.notificationLog.update({
              where: { id: notificationLogId! },
              data: { status: NotificationLogStatus.DELIVERED, deliveredAt: new Date() },
            });

            // Increment campaign deliveredCount for ALL merged campaigns (ignoring P2025 record not found errors)
            for (const cId of campaignIds) {
              await tx.notificationCampaign.update({
                where: { id: cId },
                data: { deliveredCount: { increment: 1 } },
              }).catch((err: any) => {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                  this.logger.warn(`Campaign ${cId} not found during deliveredCount update (possibly deleted).`);
                } else {
                  throw err;
                }
              });
            }

            // Mark ONLY the intents processed in the current aggregation run as PROCESSED (safe status PENDING check, clearing deferredUntil)
            await this.batchUpdateIntents(tx, processedIntentIds, RetentionIntentStatus.PROCESSED, new Date(), 0, null);

            this.logger.log({
              action: 'RETENTION_DELIVERED',
              customerId,
              primaryReason,
              reasons,
              campaignIds,
            });
          } else {
            // Update log to FAILED and keep notificationHash to block duplicates under specific status unique index
            await tx.notificationLog.update({
              where: { id: notificationLogId! },
              data: {
                status: NotificationLogStatus.FAILED,
                error: deliveryError,
                failedAt: new Date(),
              },
            });

            // Increment campaign failedCount for ALL merged campaigns (ignoring P2025 record not found errors)
            for (const cId of campaignIds) {
              await tx.notificationCampaign.update({
                where: { id: cId },
                data: { failedCount: { increment: 1 } },
              }).catch((err: any) => {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                  this.logger.warn(`Campaign ${cId} not found during failedCount update (possibly deleted).`);
                } else {
                  throw err;
                }
              });
            }

            // Atomic update: mark intents exceeding retry limit (retryCount >= 4, which will become 5) as SKIPPED
            await tx.retentionNotificationIntent.updateMany({
              where: {
                id: { in: processedIntentIds },
                status: RetentionIntentStatus.PENDING,
                retryCount: { gte: 4 },
              },
              data: {
                status: RetentionIntentStatus.SKIPPED,
                processedAt: new Date(),
              },
            });

            // Increment retryCount for the remaining PENDING intents
            await this.batchUpdateIntents(tx, processedIntentIds, RetentionIntentStatus.PENDING, null, 1);

            this.logger.error({
              action: 'RETENTION_FAILED',
              customerId,
              primaryReason,
              reasons,
              campaignIds,
              error: deliveryError,
            });
          }
        }, { timeout: 30000, maxWait: 10000 });
      } else if (checkResult.skip) {
        this.logger.log({
          action: 'RETENTION_SKIPPED',
          customerId,
          primaryReason,
          reasons,
          primaryCampaignId,
          reason: checkResult.reason,
        });
      } else if (checkResult.retryLater) {
        this.logger.log({
          action: 'RETENTION_DEFERRED',
          customerId,
          primaryReason,
          reasons,
          primaryCampaignId,
          reason: checkResult.reason,
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to process intents for customer ${customerId}: ${err.message}`);
    } finally {
      clearInterval(customerRenewalInterval);
      this.activeIntervals.delete(customerRenewalInterval);
      if (!lockLost) {
        await this.releaseLock(customerLockKey, lockToken);
      }
    }
  }

  /**
   * Check business rate limits and duplicate checks inside transaction context.
   * Creates a notification log with status 'PENDING_DELIVERY' (pending delivery verification).
   */
  private async checkAndCreateLog(
    tx: Prisma.TransactionClient,
    customerId: string,
    campaignId: string,
    title: string,
    body: string,
  ): Promise<{ success: boolean; skip?: boolean; retryLater?: boolean; reason?: string; logId?: string }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Enforce daily rate limit check (max 1 retention notification per 24 hours)
    // We only count successful (DELIVERED) or active delivery (PENDING_DELIVERY created within the last 30 minutes) logs.
    const recentCount = await tx.notificationLog.count({
      where: {
        customerId,
        createdAt: { gte: oneDayAgo },
        OR: [
          { status: NotificationLogStatus.DELIVERED },
          {
            status: NotificationLogStatus.PENDING_DELIVERY,
            createdAt: { gte: thirtyMinutesAgo },
          },
        ],
      },
    });

    if (recentCount >= 1) {
      this.logger.warn(`Daily limit reached for customer ${customerId}, skipping aggregated notification.`);
      return { success: false, retryLater: true, reason: 'Daily limit reached' };
    }

    // Enforce 10-minute duplicate check (ignore FAILED logs so retries aren't blocked)
    const contentHash = crypto
      .createHash('sha256')
      .update(`${customerId}_${campaignId}_${title}_${body}`)
      .digest('hex');

    const duplicate = await tx.notificationLog.findFirst({
      where: {
        customerId,
        notificationHash: contentHash,
        status: { not: NotificationLogStatus.FAILED },
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (duplicate) {
      this.logger.warn(`Duplicate aggregated notification blocked for customer ${customerId} (within 10 minutes).`);
      return { success: false, skip: true, reason: 'Duplicate notification blocked' };
    }

    // Ensure campaign exists in db (campaign status set to SENT globally, propagating other db errors)
    try {
      await tx.notificationCampaign.upsert({
        where: { id: campaignId },
        update: {},
        create: {
          id: campaignId,
          title,
          body,
          type: 'RETENTION',
          status: NotificationCampaignStatus.SENT,
        },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(`Campaign already exists due to concurrency: ${err.message}`);
      } else {
        throw err;
      }
    }

    // Create the initial log in 'PENDING_DELIVERY' status (gracefully catching P2002 duplicate constraints)
    try {
      const log = await tx.notificationLog.create({
        data: {
          campaignId,
          customerId,
          status: NotificationLogStatus.PENDING_DELIVERY,
          notificationHash: contentHash,
        },
      });
      return { success: true, logId: log.id };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.warn(`Unique constraint block on log creation for customer ${customerId}: ${err.message}`);
        return { success: false, skip: true, reason: 'Duplicate notification blocked (unique constraint)' };
      }
      throw err;
    }
  }

  /**
   * Periodically clean up stale PENDING retention intents (older than 7 days)
   * to avoid indefinite accumulation of staled business data.
   */
  @Cron('0 0 0 * * *') // Run daily at 12:00 AM (just before aggregation service runs at 12:05 AM)
  async cleanupStaleIntents() {
    this.logger.log('Starting staled retention intents cleanup task...');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const lockKey = 'lock:notification-aggregator:cleanup';
    const lockToken = crypto.randomUUID();
    const acquired = await this.redisService.redisClient.set(lockKey, lockToken, 'EX', 600, 'NX');
    if (!acquired) {
      this.logger.log('Cleanup task lock busy on another instance.');
      return;
    }

    try {
      const staleCount = await this.prisma.retentionNotificationIntent.count({
        where: {
          status: RetentionIntentStatus.PENDING,
          createdAt: { lt: sevenDaysAgo },
        },
      });

      if (staleCount > 0) {
        await this.prisma.retentionNotificationIntent.updateMany({
          where: {
            status: RetentionIntentStatus.PENDING,
            createdAt: { lt: sevenDaysAgo },
          },
          data: {
            status: RetentionIntentStatus.SKIPPED,
            processedAt: new Date(),
          },
        });
        this.logger.log({
          action: 'RETENTION_CLEANUP_STALE',
          staleCount,
          message: `Successfully marked ${staleCount} stale pending intents (older than 7 days) as SKIPPED.`,
        });
      } else {
        this.logger.log('No stale pending intents found.');
      }
    } catch (err: any) {
      this.logger.error(`Error during stale intents cleanup: ${err.message}`);
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Batch update helper to protect database operations against parameter limit overflows.
   */
  private async batchUpdateIntents(
    tx: Prisma.TransactionClient,
    intentIds: string[],
    status: RetentionIntentStatus,
    processedAt: Date | null = null,
    retryIncrement = 0,
    deferredUntil: Date | null | undefined = undefined,
  ) {
    const chunkSize = 500;
    for (let i = 0; i < intentIds.length; i += chunkSize) {
      const chunk = intentIds.slice(i, i + chunkSize);
      const updateData: any = { status };
      if (processedAt) updateData.processedAt = processedAt;
      if (retryIncrement > 0) updateData.retryCount = { increment: retryIncrement };
      if (deferredUntil !== undefined) {
        updateData.deferredUntil = deferredUntil;
      }

      await tx.retentionNotificationIntent.updateMany({
        where: {
          id: { in: chunk },
          status: RetentionIntentStatus.PENDING,
        },
        data: updateData,
      });
    }
  }

  /**
   * Concurrency helper: processes tasks with a limit
   */
  private async runWithConcurrencyLimit(tasks: (() => Promise<any>)[], limit: number): Promise<void> {
    if (limit <= 0) {
      throw new Error('Concurrency limit must be greater than 0');
    }
    const executing: Promise<void>[] = [];
    for (const task of tasks) {
      const p = Promise.resolve()
        .then(task)
        .catch((err) => {
          this.logger.error(err);
        })
        .finally(() => {
          executing.splice(executing.indexOf(p), 1);
        });
      executing.push(p);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  }

  /**
   * Helper to enforce timeout constraint on long running promises (e.g. HTTP external triggers).
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    let timer: NodeJS.Timeout;
    return Promise.race([
      promise.finally(() => clearTimeout(timer)),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      }),
    ]);
  }

  /**
   * Atomic Lua script wrapper to safely release a Redis lock only if owned.
   */
  private async releaseLock(lockKey: string, lockToken: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      const result = await this.redisService.redisClient.eval(script, 1, lockKey, lockToken);
      return result === 1;
    } catch (err: any) {
      this.logger.error(`Failed to release lock for key ${lockKey}: ${err.message}`);
      return false;
    }
  }
}
