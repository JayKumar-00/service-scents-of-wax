import { Worker } from 'bullmq';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createProcessorMap } from '../processors/processor.map';
import { PenaltyProcessor } from '../processors/penalty.processor';
import { ReminderProcessor } from '../processors/reminder.processor';
import { CreditAutoRefillProcessor } from '../processors/auto-refill.processor';
import { CreditPaymentProcessor } from '../processors/payment.processor';

@Injectable()
export class CreditWorker implements OnModuleInit {
  private readonly logger = new Logger(CreditWorker.name);

  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private redis: any,
    private readonly penaltyProcessor: PenaltyProcessor,
    private readonly reminderProcessor: ReminderProcessor,
    private readonly paymentProcessor: CreditPaymentProcessor,
    private readonly autoRefillProcessor: CreditAutoRefillProcessor,
  ) {}

  onModuleInit() {
    this.initWorker();
  }

  private initWorker() {
    const processorMap: any = createProcessorMap(
      this.penaltyProcessor,
      this.reminderProcessor,
      this.paymentProcessor,
      this.autoRefillProcessor,
    );

    const worker = new Worker(
      'credit.queue',
      async (job) => {
        const processor = processorMap[job.name];

        if (!processor) {
          throw new Error(`No processor found for ${job.name}`);
        }

        await processor.handle(job);
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
      this.logger.log(`Completed job ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Failed job ${job?.id}: ${err.message}`);
    });
  }
  /*
  initWorker() {
    new Worker(
      'credit.queue',
      async (job) => {
        const { dueId } = job.data;

        const due = await this.prisma.creditDue.findUnique({
          where: { id: dueId },
        });

        if (!due || due.status !== 'PENDING') return;

        await this.prisma.$transaction(async (tx) => {
          await tx.creditDue.update({
            where: { id: dueId },
            data: { status: 'OVERDUE' },
          });
        });
      },
      {
        connection: this.redis,
        concurrency: 5,
      },
    );
  }*/
}
