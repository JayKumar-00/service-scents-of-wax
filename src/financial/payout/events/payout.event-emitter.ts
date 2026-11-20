import { Injectable, Logger } from '@nestjs/common';
import { PayoutQueue } from '../queues/payout.queue';
import { PayoutEventEnum } from '../enums/payout.enum';

@Injectable()
export class PayoutEventEmitter {
  private readonly logger = new Logger(PayoutEventEmitter.name);

  constructor(private readonly payoutQueue: PayoutQueue) {}

  async emit(type: PayoutEventEnum, payload: any): Promise<void> {
    const jobId = this.generateJobId(type, payload);

    await this.payoutQueue.add(type, payload, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 300, // 5 minutes
      },
      removeOnFail: {
        age: 86400, // 24 hours
      },
    });

    this.logger.log(`Queued payout event ${type} with jobId=${jobId}`);
  }

  private generateJobId(type: PayoutEventEnum, payload: any): string {
    return `${type}:${payload.payoutId || payload.franchiseId}:${Date.now()}`;
  }

  async requested(
    payoutId: string,
    franchiseId: string,
    amount: number,
  ): Promise<void> {
    await this.emit(PayoutEventEnum.PAYOUT_REQUESTED, {
      payoutId,
      franchiseId,
      amount,
    });
  }

  async approved(
    payoutId: string,
    franchiseId: string,
    amount: number,
    referenceId: string,
  ): Promise<void> {
    await this.emit(PayoutEventEnum.PAYOUT_APPROVED, {
      payoutId,
      franchiseId,
      amount,
      referenceId,
    });
  }

  async rejected(
    payoutId: string,
    franchiseId: string,
    amount: number,
    reason: string,
  ): Promise<void> {
    await this.emit(PayoutEventEnum.PAYOUT_REJECTED, {
      payoutId,
      franchiseId,
      amount,
      reason,
    });
  }

  async completed(
    payoutId: string,
    franchiseId: string,
    amount: number,
  ): Promise<void> {
    await this.emit(PayoutEventEnum.PAYOUT_COMPLETED, {
      payoutId,
      franchiseId,
      amount,
    });
  }
}
