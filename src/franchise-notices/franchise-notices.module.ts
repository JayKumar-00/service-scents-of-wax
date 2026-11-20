import { Module } from '@nestjs/common';
import { FranchiseNoticesController } from './franchise-notices.controller';
import { FranchiseNoticesService } from './franchise-notices.service';
import { NotificationModule } from 'src/notification/notification.module';
import { BullModule } from '@nestjs/bullmq';
import { NOTICE_QUEUE } from './constants/notice.constants';
import { NoticeQueue } from './queues/notice.queue';
import { NoticeProcessor } from './processors/notice.processor';

@Module({
  imports: [
    NotificationModule,
    BullModule.registerQueue({
      name: NOTICE_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 604800 },
      },
    }),
  ],
  controllers: [FranchiseNoticesController],
  providers: [FranchiseNoticesService, NoticeQueue, NoticeProcessor],
})
export class FranchiseNoticesModule {}
