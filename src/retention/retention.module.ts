import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';
import { RetentionService } from './retention.service';
import { RetentionController } from './retention.controller';
import { RetentionProcessor } from './processors/retention.processor';
import { RetentionCronService } from './crons/retention-cron.service';

@Global()
@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    BullModule.registerQueue({
      name: 'retention',
    }),
  ],
  controllers: [RetentionController],
  providers: [RetentionService, RetentionProcessor, RetentionCronService],
  exports: [
    RetentionService,
    BullModule.registerQueue({
      name: 'retention',
    }),
  ],
})
export class RetentionModule {}
