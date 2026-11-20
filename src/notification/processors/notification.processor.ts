import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { NotificationDeliveryService } from '../services/notification-delivery.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { NOTIFICATION_QUEUE } from '../constants/notifications.constants';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    try {
      const payload = job.data;

      // Check if user should receive this notification based on preferences
      const canDeliver = await this.preferenceService.canDeliver(
        payload.userId,
        payload.type,
      );

      if (!canDeliver) {
        this.logger.debug(
          `Skipped notification for user ${payload.userId} - preferences disabled for type ${payload.type}`,
        );
        return null;
      }

      // SAVE NOTIFICATION IN DB
      const notification = await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          title: payload.title,
          body: payload.body,
          type: payload.type,
          channel: payload.channel || 'IN_APP',
          metadata: payload.metadata,
        },
      });

      // Get enabled channels for this user based on preferences
      const enabledChannels = await this.preferenceService.getEnabledChannels(
        payload.userId,
      );

      this.logger.debug(
        `Delivering notification to user ${payload.userId} via channels: ${enabledChannels.join(', ')}`,
      );

      // Deliver via enabled channels
      await this.deliveryService.deliver(
        payload.userId,
        notification,
        enabledChannels,
      );

      return notification;
    } catch (error: any) {
      this.logger.error(
        `Failed to process notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
