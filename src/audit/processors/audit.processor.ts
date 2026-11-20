import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit.service';

@Injectable()
@Processor('audit')
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(private readonly auditService: AuditService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const eventName = job.name;
    const data = job.data;

    if (eventName === 'audit.created') {
      try {
        await this.auditService.saveToDb({
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          metadata: data.metadata,
          ip: data.ipAddress ?? data.ip,
          userAgent: data.userAgent,
          createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to save audit log from queue: ${err.message}`,
          err.stack,
        );
      }
    }
  }
}
