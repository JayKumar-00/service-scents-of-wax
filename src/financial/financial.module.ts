import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CreditService } from './credit/credit.service';
import { SettlementService } from './settlement/settlement.service';
import { CreditController } from './credit/credit.controller';
import { SettlementController } from './settlement/settlement.controller';
import { CreditEventEmitter } from './credit/events/credit.event-emitter';
import { CreditQueue } from './credit/queues/credit.queue';
import { CreditCron } from './credit/crons/credit.cron';
import { CreditAutoRefillCron } from './credit/crons/credit-auto-refill.cron';
import { CreditWorker } from './credit/workers/credit.worker';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { PenaltyProcessor } from './credit/processors/penalty.processor';
import { ReminderProcessor } from './credit/processors/reminder.processor';
import { CreditPaymentProcessor } from './credit/processors/payment.processor';
import { CreditAutoRefillProcessor } from './credit/processors/auto-refill.processor';
import { RazorpayService } from './payment/razorpay.service';
import { PaymentController } from './payment/payment.controller';
import { RazorpayGateway } from './payment/providers/razorpay.geteway';
import { LedgerService } from './ledger.service';
import { BullModule } from '@nestjs/bullmq';
import { PaymentProcessor } from './payment/processors/payment.processor';
import { PaymentQueue } from './payment/queues/payment.queue';
import { OrdersModule } from 'src/orders/orders.module';
import { PaymentWorker } from './payment/workers/settlement-payment.worker';
import { NotificationModule } from 'src/notification/notification.module';
import { PayoutService } from './payout/payout.service';
import { PayoutController } from './payout/payout.controller';
import { PayoutQueue } from './payout/queues/payout.queue';
import { PayoutEventEmitter } from './payout/events/payout.event-emitter';
import { PayoutWorker } from './payout/workers/payout.worker';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    forwardRef(() => OrdersModule),
    NotificationModule,
    BullModule.registerQueue(
      {
        name: 'credits',
        defaultJobOptions: {
          attempts: 3,

          backoff: {
            type: 'exponential',

            delay: 2000,
          },

          removeOnComplete: {
            age: 3600,
          },

          removeOnFail: {
            age: 604800,
          },
        },
      },
      {
        name: 'payments',
        defaultJobOptions: {
          attempts: 5,

          backoff: {
            type: 'exponential',

            delay: 3000,
          },

          removeOnComplete: {
            age: 3600,
          },

          removeOnFail: {
            age: 604800,
          },
        },
      },
      {
        name: 'payouts',
        defaultJobOptions: {
          attempts: 3,

          backoff: {
            type: 'exponential',

            delay: 2000,
          },

          removeOnComplete: {
            age: 3600,
          },

          removeOnFail: {
            age: 604800,
          },
        },
      },
    ),
  ],
  providers: [
    CreditService,
    SettlementService,
    CreditEventEmitter,
    CreditQueue,
    CreditCron,
    CreditAutoRefillCron,
    CreditWorker,
    PenaltyProcessor,
    ReminderProcessor,
    CreditPaymentProcessor,
    CreditAutoRefillProcessor,

    PaymentWorker,
    PaymentQueue,
    PaymentProcessor,
    RazorpayGateway,
    RazorpayService,

    LedgerService,

    PayoutService,
    PayoutQueue,
    PayoutEventEmitter,
    PayoutWorker,
  ],
  exports: [
    PaymentQueue,
    RazorpayService,
    CreditEventEmitter,
    PayoutEventEmitter,
  ],
  controllers: [
    CreditController,
    PaymentController,
    PayoutController,
    SettlementController,
  ],
})
export class FinancialModule {}
