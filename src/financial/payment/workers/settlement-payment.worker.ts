import { Worker } from 'bullmq';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Job } from 'bullmq';
import { createProcessorMap } from '../processors/processor.map';
import { PaymentProcessor } from '../processors/payment.processor';

@Injectable()
export class PaymentWorker implements OnModuleInit {
  private readonly logger = new Logger(PaymentWorker.name);

  constructor(
    @Inject('REDIS_CLIENT') private redis: any,
    private readonly paymentProcessor: PaymentProcessor,
  ) {}

  onModuleInit() {
    this.initWorker();
  }

  private initWorker() {
    const processorMap: any = createProcessorMap(this.paymentProcessor);

    const worker = new Worker(
      'payments',
      async (job: Job) => {
        const processor = processorMap[job.name];

        if (!processor) {
          throw new Error(`No processor found for ${job.name}`);
        }

        await processor.handle(job as any);
      },
      {
        connection: this.redis,
        concurrency: 5,
      },
    );

    worker.on('completed', (job) => {
      this.logger.log(`Completed job ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Failed job ${job?.id}: ${err.message}`);
    });
  }
}
