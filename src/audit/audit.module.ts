import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { PartitionManagerService } from './partition-manager.service';
import { AuditArchiveService } from './audit-archive.service';
import { AuditQueue } from './queues/audit.queue';
import { AuditProcessor } from './processors/audit.processor';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'audit',
    }),
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
    PartitionManagerService,
    AuditArchiveService,
    AuditQueue,
    AuditProcessor,
  ],
  exports: [
    AuditService,
    AuditQueue,
    BullModule.registerQueue({
      name: 'audit',
    }),
  ],
})
export class AuditModule {}
