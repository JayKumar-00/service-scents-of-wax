import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from 'src/notification/services/notification.service';
import { NotificationType } from 'src/notification/enums/notification-type.enum';
import { SaleType } from '../enums/order.enum';
import Redis from 'ioredis';

@Injectable()
export class PickupReminderCron {
  private readonly logger = new Logger(PickupReminderCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  @Cron('0 */15 * * * *') // Run every 15 minutes
  async checkPickupReminders() {
    this.logger.log('Starting pickup reminder check...');
    try {
      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      const orders = await this.prisma.order.findMany({
        where: {
          saleType: SaleType.PICKUP,
          status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
        },
        select: {
          id: true,
          orderNumber: true,
          addressJson: true,
          customerId: true,
          customer: {
            select: {
              userId: true,
            },
          },
        },
      });

      for (const order of orders) {
        try {
          const address = JSON.parse(order.addressJson);
          if (address && order.customer?.userId) {
            let needsReminder = false;
            let needsMissed = false;

            let startTime: Date | null = null;
            if (address.fromPickupScheduleTime) {
              startTime = new Date(address.fromPickupScheduleTime);
              if (startTime > now && startTime <= twoHoursLater && !address.reminderSent) {
                needsReminder = true;
              }
            }

            let endTime: Date | null = null;
            const endTimeStr = address.toPickupScheduleTime || address.fromPickupScheduleTime;
            if (endTimeStr) {
              endTime = new Date(endTimeStr);
              if (endTime < now && !address.missedNotificationSent) {
                needsMissed = true;
              }
            }

            if (!needsReminder && !needsMissed) {
              continue;
            }

            const lockKey = `lock:pickup-reminder:user:${order.customer.userId}`;
            const lockAcquired = await this.redisClient.set(lockKey, '1', 'EX', 10, 'NX');

            if (!lockAcquired) {
              this.logger.log(
                `Skipping reminder check for order ${order.orderNumber} - user lock busy`,
              );
              continue;
            }

            try {
              // 1. Pre-pickup 2-hour reminder
              if (needsReminder && startTime) {
                const recentNotification = await this.prisma.notification.findFirst({
                  where: {
                    userId: order.customer.userId,
                    type: NotificationType.PICKUP_REMINDER,
                    createdAt: { gte: oneDayAgo },
                  },
                });

                const duplicateNotification = await this.prisma.notification.findFirst({
                  where: {
                    userId: order.customer.userId,
                    type: NotificationType.PICKUP_REMINDER,
                    metadata: {
                      path: ['orderId'],
                      equals: order.id,
                    },
                    createdAt: { gte: tenMinutesAgo },
                  },
                });

                if (duplicateNotification) {
                  this.logger.log(
                    `Skipping 2-hour pickup reminder for order ${order.orderNumber} (technical safeguard: duplicate sent in last 10 minutes)`,
                  );
                } else if (recentNotification) {
                  this.logger.log(
                    `Skipping 2-hour pickup reminder for order ${order.orderNumber} (business rule: daily limit reached)`,
                  );
                } else {
                  await this.notificationService.notify({
                    userId: order.customer.userId,
                    title: 'Upcoming Pickup Reminder',
                    body: `Reminder: Your order ${order.orderNumber} is scheduled for pickup starting at ${startTime.toLocaleTimeString()}. Please collect it soon!`,
                    type: NotificationType.PICKUP_REMINDER,
                    metadata: {
                      notificationType: 'PICKUP_REMINDER',
                      customerId: order.customerId,
                      orderId: order.id,
                      sentAt: new Date().toISOString(),
                    },
                  });
                  this.logger.log(
                    `Sent 2-hour pickup reminder for order ${order.orderNumber}`,
                  );
                }

                address.reminderSent = true;
                await this.prisma.order.update({
                  where: { id: order.id },
                  data: {
                    addressJson: JSON.stringify(address),
                  },
                });
              }

              // 2. Missed pickup notification
              if (needsMissed && endTime) {
                const recentNotification = await this.prisma.notification.findFirst({
                  where: {
                    userId: order.customer.userId,
                    type: NotificationType.PICKUP_REMINDER,
                    createdAt: { gte: oneDayAgo },
                  },
                });

                const duplicateNotification = await this.prisma.notification.findFirst({
                  where: {
                    userId: order.customer.userId,
                    type: NotificationType.PICKUP_REMINDER,
                    metadata: {
                      path: ['orderId'],
                      equals: order.id,
                    },
                    createdAt: { gte: tenMinutesAgo },
                  },
                });

                if (duplicateNotification) {
                  this.logger.log(
                    `Skipping missed pickup notification for order ${order.orderNumber} (technical safeguard: duplicate sent in last 10 minutes)`,
                  );
                } else if (recentNotification) {
                  this.logger.log(
                    `Skipping missed pickup notification for order ${order.orderNumber} (business rule: daily limit reached)`,
                  );
                } else {
                  await this.notificationService.notify({
                    userId: order.customer.userId,
                    title: 'Missed Pickup Notification',
                    body: `You missed your scheduled pickup window for order ${order.orderNumber}. You can still pick it up at any time, but please contact the outlet if delayed.`,
                    type: NotificationType.PICKUP_REMINDER,
                    metadata: {
                      notificationType: 'PICKUP_REMINDER',
                      customerId: order.customerId,
                      orderId: order.id,
                      sentAt: new Date().toISOString(),
                    },
                  });
                  this.logger.log(
                    `Sent missed pickup notification for order ${order.orderNumber}`,
                  );
                }

                address.missedNotificationSent = true;
                await this.prisma.order.update({
                  where: { id: order.id },
                  data: {
                    addressJson: JSON.stringify(address),
                  },
                });
              }
            } finally {
              // Release user lock
              await this.redisClient.del(lockKey).catch((err) => {
                this.logger.error(`Failed to release lock for key ${lockKey}: ${err.message}`);
              });
            }
          }
        } catch (e: any) {
          this.logger.error(
            `Error processing pickup reminder for order ${order.id}: ${e.message}`,
          );
        }
      }
    } catch (e: any) {
      this.logger.error(`Error in checkPickupReminders cron job: ${e.message}`);
    }
  }
}
