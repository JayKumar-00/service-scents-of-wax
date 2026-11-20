import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';

@Injectable()
export class PaymentQueue {
  private readonly logger = new Logger(PaymentQueue.name);

  constructor(@InjectQueue('payments') private readonly paymentQueue: Queue) {
    this.paymentQueue.on('error', (err) => {
      this.logger.error(`Queue error: ${err.message}`);
    });
  }

  async settlePayment(financialEventId: string) {
    return this.paymentQueue.add('settle-payment', { financialEventId }, {
      attempts: 5,
      removeOnComplete: 100,
      removeOnFail: 100,
      backoff: { type: 'exponential', delay: 5000 },
    } as JobsOptions);
  }

  async refundPayment(financialEventId: string) {
    return this.paymentQueue.add('refund-payment', { financialEventId }, {
      attempts: 3,
    } as JobsOptions);
  }
}
