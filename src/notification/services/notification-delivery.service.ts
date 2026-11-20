import { Injectable, Logger } from '@nestjs/common';

import { WebsocketService } from './websocket.service';

import { WebsocketStrategy } from '../strategies/websocket.strategy';
import { FcmStrategy } from '../strategies/fcm.strategy';
import { EmailStrategy } from '../strategies/email.strategy';
import { SmsStrategy } from '../strategies/sms.strategy';
import { NotificationChannel } from '../enums/notification-channel.enum';

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly websocketStrategy: WebsocketStrategy,
    private readonly fcmStrategy: FcmStrategy,
    private readonly emailStrategy: EmailStrategy,
    private readonly smsStrategy: SmsStrategy,
  ) {}

  /**
   * Deliver notification to user via enabled channels.
   * `enabledChannels` is an array like ['IN_APP','PUSH','EMAIL']
   */
  async deliver(userId: string, payload: any, enabledChannels: string[] = []) {
    // In-app (websocket) delivery
    if (enabledChannels.includes(NotificationChannel.IN_APP)) {
      if (this.websocketService.isOnline(userId)) {
        try {
          await this.websocketStrategy.deliver(userId, payload);
        } catch (err: any) {
          this.logger.warn(
            `Websocket deliver failed for ${userId}: ${err.message}`,
          );
        }
      }
    }

    // Push (FCM)
    if (enabledChannels.includes(NotificationChannel.PUSH)) {
      try {
        await this.fcmStrategy.deliver(userId, payload);
      } catch (err: any) {
        this.logger.warn(`FCM deliver failed for ${userId}: ${err.message}`);
      }
    }

    // Email
    if (enabledChannels.includes(NotificationChannel.EMAIL)) {
      try {
        await this.emailStrategy.deliver(userId, payload);
      } catch (err: any) {
        this.logger.warn(`Email deliver failed for ${userId}: ${err.message}`);
      }
    }

    // SMS
    if (enabledChannels.includes(NotificationChannel.SMS)) {
      try {
        await this.smsStrategy.deliver(userId, payload);
      } catch (err: any) {
        this.logger.warn(`SMS deliver failed for ${userId}: ${err.message}`);
      }
    }
  }
}
