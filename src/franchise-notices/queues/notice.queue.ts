import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NOTICE_QUEUE,
  NOTICE_QUEUE_DEFAULTS,
} from '../constants/notice.constants';

@Injectable()
export class NoticeQueue {
  constructor(
    @InjectQueue(NOTICE_QUEUE)
    private readonly queue: Queue,
  ) {}

  async add(name: string, payload: any) {
    await this.queue.add(name, payload, {
      attempts: NOTICE_QUEUE_DEFAULTS.attempts,
      backoff: NOTICE_QUEUE_DEFAULTS.backoff,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 604800 },
    });
  }
}
