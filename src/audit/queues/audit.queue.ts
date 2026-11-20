import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AuditQueue {
  constructor(
    @InjectQueue('audit')
    private readonly auditQueue: Queue,
  ) {}

  async emit(eventName: string, data: any) {
    await this.auditQueue.add(eventName, data);
  }
}
