import { Injectable, Logger } from '@nestjs/common';

import { CreditQueue } from '../queues/credit.queue';
import { CreditEventEnum } from '../enums/credit.enum';

@Injectable()
export class CreditEventEmitter {
  private readonly logger = new Logger(CreditEventEmitter.name);

  constructor(private readonly creditQueue: CreditQueue) {}

  /**
   * =========================================================
   * CORE EVENT EMITTER
   * ONLY RESPONSIBILITY:
   * -> push safe jobs into BullMQ queue
   * =========================================================
   */
  async emit(type: CreditEventEnum, payload: any): Promise<void> {
    const jobId = this.generateJobId(type, payload);

    await this.creditQueue.add(type, payload, {
      /**
       * Prevent duplicate jobs
       */
      jobId,

      /**
       * Retry configuration
       */
      attempts: 3,

      backoff: {
        type: 'exponential',
        delay: 2000,
      },

      /**
       * ⚠️ VOLATILE-LRU SAFETY CONFIGURATION
       * These settings ensure BullMQ works safely with volatile-lru eviction policy
       * removeOnComplete keeps last N completed jobs for audit/debugging
       * removeOnFail keeps failed jobs for longer to investigate issues
       * Together they prevent memory bloat while maintaining job history
       */
      removeOnComplete: {
        age: 300, // Keep completed jobs for 5 minutes in queue
      },

      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours for debugging
      },

      /**
       * ⏱ Prevent hanging jobs - essential with volatile-lru
       * Ensures jobs that stall are retried and recovered
       */
      // timeout: 15000,
    });

    this.logger.log(`Queued ${type} with jobId=${jobId}`);
  }

  /**
   * =========================================================
   * JOB ID GENERATOR
   * deterministic + readable + scalable
   * =========================================================
   */
  private generateJobId(type: CreditEventEnum, payload: any): string {
    switch (type) {
      case CreditEventEnum.CREDIT_PENALTY:
        return `penalty:${payload.dueId}`;

      case CreditEventEnum.CREDIT_REMINDER:
        return `reminder:${payload.dueId}`;

      case CreditEventEnum.CREDIT_PAYMENT:
        return `payment:${payload.referenceId}`;

      case CreditEventEnum.CREDIT_LIMIT_EVALUATION:
        return `limit:${payload.franchiseId}`;

      default:
        return `${type}:${Date.now()}`;
    }
  }

  // =========================================================
  // DOMAIN HELPERS
  // clean API for services/crons
  // =========================================================

  /**
   * PENALTY EVENT
   */
  async penalty(dueId: string, franchiseId: string): Promise<void> {
    await this.emit(CreditEventEnum.CREDIT_PENALTY, {
      dueId,
      franchiseId,
    });
  }

  /**
   * REMINDER EVENT
   */
  async reminder(dueId: string, franchiseId: string): Promise<void> {
    await this.emit(CreditEventEnum.CREDIT_REMINDER, {
      dueId,
      franchiseId,
    });
  }

  /**
   * CREDIT LIMIT EVALUATION
   */
  async limitEvaluation(franchiseId: string): Promise<void> {
    await this.emit(CreditEventEnum.CREDIT_LIMIT_EVALUATION, {
      franchiseId,
    });
  }

  /**
   * PAYMENT EVENT
   */
  async payment(
    franchiseId: string,
    amount: number,
    referenceId: string,
  ): Promise<void> {
    if (!referenceId) {
      throw new Error('referenceId is required for payment events');
    }

    await this.emit(CreditEventEnum.CREDIT_PAYMENT, {
      franchiseId,
      amount,
      referenceId,
    });
  }
}
