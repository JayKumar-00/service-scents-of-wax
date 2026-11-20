import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import {
  ORDER_ALLOCATION_JOB,
  ORDER_ALLOCATION_QUEUE,
} from '../constants/order-allocation.constants';

@Injectable()
export class OrderAllocationQueue {
  private readonly logger = new Logger(OrderAllocationQueue.name);

  constructor(
    @InjectQueue(ORDER_ALLOCATION_QUEUE)
    private readonly queue: Queue,
  ) {
    this.queue.on('error', (error) => {
      this.logger.error(`Queue error: ${error.message}`);
    });
  }

  async enqueueAllocationRequest(requestId: string) {
    await this.queue.add(ORDER_ALLOCATION_JOB.ALLOCATE_REQUEST, { requestId }, {
      jobId: `order-request-${requestId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 604800 },
    } as JobsOptions);
  }

  async enqueueProposalExpiration(proposalId: string, delayMs: number) {
    await this.queue.add(ORDER_ALLOCATION_JOB.EXPIRE_PROPOSAL, { proposalId }, {
      jobId: `proposal-expire-${proposalId}`,
      delay: delayMs,
      attempts: 1,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 604800 },
    } as JobsOptions);
  }

  async enqueueReservationExpiration(reservationId: string, delayMs: number) {
    await this.queue.add(
      ORDER_ALLOCATION_JOB.EXPIRE_RESERVATION,
      { reservationId },
      {
        jobId: `reservation-expire-${reservationId}`,
        delay: delayMs,
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 604800 },
      } as JobsOptions,
    );
  }

  async enqueueOnlinePaymentExpiration(orderId: string, delayMs: number) {
    await this.queue.add(
      ORDER_ALLOCATION_JOB.EXPIRE_ONLINE_PAYMENT,
      { orderId },
      {
        jobId: `online-payment-expire-${orderId}`,
        delay: delayMs,
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 604800 },
      } as JobsOptions,
    );
  }
}
