import { Worker, Job } from 'bullmq';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PayoutEventEnum } from '../enums/payout.enum';

@Injectable()
export class PayoutWorker implements OnModuleInit {
  private readonly logger = new Logger(PayoutWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: any,
  ) {}

  onModuleInit() {
    this.initWorker();
  }

  private initWorker() {
    const worker = new Worker(
      'payouts',
      async (job: Job) => {
        this.logger.log(
          `[PayoutWorker] Processing job ${job.name} (id: ${job.id}) with data: ${JSON.stringify(job.data)}`,
        );

        switch (job.name) {
          case PayoutEventEnum.PAYOUT_REQUESTED:
            await this.handlePayoutRequested(job.data);
            break;
          case PayoutEventEnum.PAYOUT_APPROVED:
            await this.handlePayoutApproved(job.data);
            break;
          case PayoutEventEnum.PAYOUT_REJECTED:
            await this.handlePayoutRejected(job.data);
            break;
          case PayoutEventEnum.PAYOUT_COMPLETED:
            await this.handlePayoutCompleted(job.data);
            break;
          default:
            this.logger.warn(
              `[PayoutWorker] No handler found for job name: ${job.name}`,
            );
        }
      },
      {
        connection: this.redis,
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 1000,
        },
      },
    );

    worker.on('completed', (job) => {
      this.logger.log(`[PayoutWorker] Completed job ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`[PayoutWorker] Failed job ${job?.id}: ${err.message}`);
    });
  }

  private async handlePayoutRequested(data: any) {
    this.logger.log(
      `[PayoutWorker] Processing payout request event for payout ${data.payoutId}`,
    );
  }

  private async handlePayoutApproved(data: any) {
    this.logger.log(
      `[PayoutWorker] Processing payout approval event for payout ${data.payoutId}`,
    );
  }

  private async handlePayoutRejected(data: any) {
    this.logger.log(
      `[PayoutWorker] Processing payout rejection event for payout ${data.payoutId}`,
    );
  }

  private async handlePayoutCompleted(data: any) {
    this.logger.log(
      `[PayoutWorker] Processing payout completion event for payout ${data.payoutId}`,
    );
  }
}
