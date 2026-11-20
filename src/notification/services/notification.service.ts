import { Injectable } from '@nestjs/common';

import { NotificationQueue } from '../queues/notification.queue';

import { NotificationPayload } from '../interfaces/notification-payload.interface';

@Injectable()
export class NotificationService {
  constructor(private readonly notificationQueue: NotificationQueue) {}

  async notify(payload: NotificationPayload) {
    await this.notificationQueue.add(payload);
  }
}
