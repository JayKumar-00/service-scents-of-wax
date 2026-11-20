import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReminderProcessor {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(job: any) {
    const { dueId, franchiseId } = job.data;

    try {
      const due = await this.prisma.creditDue.findUnique({
        where: { id: dueId },
      });

      if (!due || due.status !== 'PENDING') {
        this.logger.warn(
          `Cannot send reminder for due ${dueId}: status is not PENDING`,
        );
        return;
      }

      // TODO: Send email/SMS notification to franchise owner
      // const franchise = await this.prisma.franchise.findUnique({
      //   where: { id: franchiseId },
      //   select: { email: true, phone: true },
      // });

      // Send notification to franchise
      this.logger.log(
        `[ReminderProcessor] Reminder sent for due ${dueId} to franchise ${franchiseId}`,
      );

      // Optional: Mark reminder as sent
      // await this.prisma.$transaction(async (tx) => {
      // Create audit log or notification record
      // await tx.creditNotification.create({
      //   data: {
      //     dueId,
      //     franchiseId,
      //     type: 'REMINDER',
      //     sentAt: new Date(),
      //   },
      // });
      // });
    } catch (error) {
      this.logger.error(
        `[ReminderProcessor] Failed to process reminder for due ${dueId}:`,
        error,
      );
      throw error;
    }
  }
}
