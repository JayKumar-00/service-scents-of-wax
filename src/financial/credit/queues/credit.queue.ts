import { Injectable, Logger } from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';

import { JobsOptions, Queue } from 'bullmq';

@Injectable()
export class CreditQueue {
  private readonly logger = new Logger(CreditQueue.name);

  constructor(
    @InjectQueue('credits')
    private readonly creditQueue: Queue,
  ) {
    this.creditQueue.on('error', (err) => {
      this.logger.error(`Queue error: ${err.message}`);
    });
  }

  async add(type: string, payload: any, options?: JobsOptions): Promise<any> {
    console.log(
      `Adding job to queue: ${type} with payload:`,
      payload,
      `and options:`,
      options,
    );
    return this.creditQueue.add(
      type,
      payload,
      (options = {
        attempts: 3,
      }),
    );
  }
}
