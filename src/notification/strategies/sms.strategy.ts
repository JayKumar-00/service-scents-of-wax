import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsStrategy {
  private readonly logger = new Logger(SmsStrategy.name);

  async deliver(userId: string, notification: any): Promise<void> {
    try {
      // TODO: Implement SMS sending via Twilio, AWS SNS, or similar
      // For now, log that SMS would be sent
      this.logger.debug(
        `[SMS] Would send SMS notification to user ${userId}: ${notification.title}`,
      );

      // Example implementation (requires SMS service setup):
      // const user = await this.prisma.user.findUnique({
      //   where: { id: userId },
      //   include: { customer: true },
      // });
      //
      // if (user?.customer?.phone) {
      //   await this.smsService.send({
      //     to: user.customer.phone,
      //     message: notification.body,
      //   });
      // }
    } catch (error: any) {
      this.logger.error(`Failed to send SMS notification: ${error.message}`);
    }
  }
}
