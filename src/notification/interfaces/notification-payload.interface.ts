import { NotificationType } from '../enums/notification-type.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';

export interface NotificationPayload {
  userId: string;

  title: string;

  body: string;

  type: NotificationType;

  metadata?: Record<string, any> & {
    attachment?: Array<{ content: string; name: string }>;
  };
  channel?: NotificationChannel;
}
