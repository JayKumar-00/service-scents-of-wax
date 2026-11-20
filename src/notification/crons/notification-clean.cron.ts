import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationCleanCron {
  private readonly logger = new Logger(NotificationCleanCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cleans up old notifications daily at midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanOldNotifications() {
    this.logger.log('Starting scheduled cleanup of old notifications...');
    try {
      const deleteDaysVal = this.configService.get<string | number>(
        'NOTIFICATION_DELETE_DAYS',
      );
      const deleteDays = deleteDaysVal ? Number(deleteDaysVal) : 60;
      const finalDays = isNaN(deleteDays) ? 60 : deleteDays;

      this.logger.log(`Using notification retention period: ${finalDays} days`);

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - finalDays);

      const result = await this.prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: thresholdDate,
          },
        },
      });

      this.logger.log(
        `Successfully deleted ${result.count} notifications created before ${thresholdDate.toISOString()}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to clean up old notifications: ${error.message}`,
        error.stack,
      );
    }
  }
}
