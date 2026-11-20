import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NOTICE_QUEUE, NOTICE_JOB } from '../constants/notice.constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { chunkArray } from '../utils/chunk.util';
import { NotificationType } from 'src/notification/enums/notification-type.enum';

@Processor(NOTICE_QUEUE)
export class NoticeProcessor extends WorkerHost {
  private readonly logger = new Logger(NoticeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly roleNotifier: RoleBasedNotificationService,
  ) {
    super();
  }

  /**
   * job.data should contain the payload added by the service.
   */
  async process(job: Job<any>): Promise<any> {
    try {
      const { name } = job;

      if (name === NOTICE_JOB.SEND_GLOBAL) {
        const payload = job.data;
        // Broadcast to all franchise users via role-based helper
        // This helper will internally enqueue notification jobs and handle preferences/delivery.
        await this.roleNotifier.notifyAllFranchises(
          payload.title,
          payload.body,
          NotificationType.SYSTEM,
          { franchiseNoticeId: payload.noticeId },
        );
        return { delivered: true };
      }

      if (name === NOTICE_JOB.SEND_FRANCHISE) {
        const payload = job.data; // { mapping: [{ franchiseId, noticeId }], title, body }

        // Process in chunks to avoid memory / queue pressure
        const chunks = chunkArray(payload.mapping || [], 100);
        for (const chunk of chunks) {
          // For each franchise in chunk, enqueue role-based notifications
          await Promise.allSettled(
            chunk.map((m: any) =>
              this.roleNotifier.notifyFranchiseAll(
                m.franchiseId,
                payload.title,
                payload.body,
                NotificationType.SYSTEM,
                { franchiseNoticeId: m.noticeId, franchiseId: m.franchiseId },
              ),
            ),
          );
        }

        return { delivered: true };
      }

      this.logger.warn(`Unknown notice job: ${name}`);
      return null;
    } catch (error: any) {
      this.logger.error(`Notice job failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
