import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreditEventEnum } from '../enums/credit.enum';
import { CreditEventEmitter } from '../events/credit.event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { NotificationType } from 'src/notification/enums/notification-type.enum';

@Injectable()
export class CreditCron {
  constructor(
    private creditEventEmitter: CreditEventEmitter,
    private prisma: PrismaService,
    private readonly roleBasedNotificationService: RoleBasedNotificationService,
  ) {}

  /**
   * Runs daily at 2:00 AM - Penalty trigger for overdue credits
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runPenaltyScan() {
    try {
      // Fetch all pending dues that are overdue
      const dueList = await this.prisma.creditDue.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            lt: new Date(),
          },
        },
      });

      for (const due of dueList) {
        await this.creditEventEmitter.emit(CreditEventEnum.CREDIT_PENALTY, {
          dueId: due.id,
          franchiseId: due.franchiseId,
        });
      }

      console.log(
        `[CreditCron] Penalty scan completed. Processed ${dueList.length} dues`,
      );
    } catch (error) {
      console.error('[CreditCron] Penalty scan failed:', error);
    }
  }

  /**
   * Runs daily at 6:00 AM - Reminder trigger for upcoming dues
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runReminder() {
    try {
      // Fetch all pending dues due within 3 days
      const today = new Date();
      const threeDaysFromNow = new Date(
        today.getTime() + 3 * 24 * 60 * 60 * 1000,
      );

      const dueList = await this.prisma.creditDue.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            gte: today,
            lte: threeDaysFromNow,
          },
        },
      });

      for (const due of dueList) {
        await this.creditEventEmitter.emit(CreditEventEnum.CREDIT_REMINDER, {
          dueId: due.id,
          franchiseId: due.franchiseId,
        });
      }

      console.log(
        `[CreditCron] Reminder scan completed. Processed ${dueList.length} dues`,
      );
    } catch (error) {
      console.error('[CreditCron] Reminder scan failed:', error);
    }
  }

  /**
   * Runs daily at 9:00 AM - Send a summary notification of all overdue dues to each franchise owner
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendOverdueNotifications() {
    try {
      // 1. Fetch all OVERDUE dues
      const overdueDues = await this.prisma.creditDue.findMany({
        where: {
          status: 'OVERDUE',
        },
      });

      if (overdueDues.length === 0) {
        return;
      }

      // 2. Group by franchiseId
      const groupedDues = overdueDues.reduce(
        (acc, due) => {
          if (!acc[due.franchiseId]) {
            acc[due.franchiseId] = [];
          }
          acc[due.franchiseId].push(due);
          return acc;
        },
        {} as Record<string, typeof overdueDues>,
      );

      // 3. Send notification to each franchise owner
      for (const [franchiseId, dues] of Object.entries(groupedDues)) {
        const totalOverdue = dues.reduce(
          (sum, due) => sum + Number(due.outstanding),
          0,
        );
        const count = dues.length;

        // Build list of dues
        const dueListDetails = dues
          .map(
            (due) =>
              `- ID: ${due.id} (Outstanding: ₹${Number(due.outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Due: ${due.dueDate.toLocaleDateString()})`,
          )
          .join('\n');

        const title = `⚠️ Overdue Credit Payment Alert`;
        const body = `You have ${count} overdue credit payment(s) totaling ₹${totalOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Please clear them immediately to avoid any business interruption.\n\nDetails:\n${dueListDetails}`;

        await this.roleBasedNotificationService.notifyFranchiseOwner(
          franchiseId,
          title,
          body,
          NotificationType.SYSTEM,
          { overdueCount: count, totalOverdueAmount: totalOverdue },
        );
      }

      console.log(
        `[CreditCron] Sent daily overdue notifications to ${Object.keys(groupedDues).length} franchises.`,
      );
    } catch (error) {
      console.error(
        '[CreditCron] Failed to send daily overdue notifications:',
        error,
      );
    }
  }
}
