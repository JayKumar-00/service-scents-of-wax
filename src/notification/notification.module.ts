import { Module } from '@nestjs/common';

import { BullModule } from '@nestjs/bullmq';

import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from 'src/prisma/prisma.module';

import { NotificationController } from './controllers/notification.controller';

import { NotificationGateway } from './gateways/notification.gateway';

import { NotificationQueue } from './queues/notification.queue';

import { NotificationProcessor } from './processors/notification.processor';

import { FirebaseProvider } from './providers/firebase.provider';

import { FcmService } from './services/fcm.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationService } from './services/notification.service';
import { RoleBasedNotificationService } from './services/role-based-notification.service';
import { WebsocketService } from './services/websocket.service';

import { EmailStrategy } from './strategies/email.strategy';
import { FcmStrategy } from './strategies/fcm.strategy';
import { SmsStrategy } from './strategies/sms.strategy';
import { WebsocketStrategy } from './strategies/websocket.strategy';
import { NOTIFICATION_QUEUE } from './constants/notifications.constants';
import { BrevoService } from './services/brevo.service';
import { BrevoProvider } from './providers/brevo.provider';
import { NotificationCleanCron } from './crons/notification-clean.cron';
import { LowStockAlertCron } from './crons/low-stock-alert.cron';
import { NotificationAggregatorService } from './services/notification-aggregator.service';

@Module({
  imports: [
    ConfigModule,

    PrismaModule,

    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,

      defaultJobOptions: {
        attempts: 3,

        backoff: {
          type: 'exponential',

          delay: 2000,
        },

        removeOnComplete: {
          age: 3600,
        },

        removeOnFail: {
          age: 604800,
        },
      },
    }),
  ],

  controllers: [NotificationController],

  providers: [
    FirebaseProvider,

    BrevoProvider,

    NotificationGateway,

    NotificationQueue,

    NotificationProcessor,

    NotificationService,

    BrevoService,

    NotificationDeliveryService,

    NotificationPreferenceService,

    RoleBasedNotificationService,

    WebsocketService,

    FcmService,

    WebsocketStrategy,

    FcmStrategy,

    EmailStrategy,

    SmsStrategy,

    NotificationCleanCron,

    LowStockAlertCron,

    NotificationAggregatorService,
  ],

  exports: [
    NotificationService,
    NotificationQueue,
    BrevoService,
    RoleBasedNotificationService,
    WebsocketService,
    NotificationAggregatorService,
  ],
})
export class NotificationModule {}
