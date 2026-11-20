import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { NotificationPayload } from '../interfaces/notification-payload.interface';
import {
  NOTIFICATION_JOB,
  NOTIFICATION_QUEUE,
} from '../constants/notifications.constants';

@Injectable()
export class NotificationQueue {
  constructor(
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async add(payload: NotificationPayload) {
    await this.queue.add(NOTIFICATION_JOB.SEND, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
