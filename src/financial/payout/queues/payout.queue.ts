import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';

@Injectable()
export class PayoutQueue {
  private readonly logger = new Logger(PayoutQueue.name);

  constructor(
    @InjectQueue('payouts')
    private readonly payoutQueue: Queue,
  ) {
    this.payoutQueue.on('error', (err) => {
      this.logger.error(`Payout Queue error: ${err.message}`);
    });
  }

  async add(type: string, payload: any, options?: JobsOptions): Promise<any> {
    console.log(
      `Adding job to payout queue: ${type} with payload:`,
      payload,
      `and options:`,
      options,
    );
    return this.payoutQueue.add(
      type,
      payload,
      (options = {
        attempts: 3,
        ...options,
      }),
    );
  }
}
