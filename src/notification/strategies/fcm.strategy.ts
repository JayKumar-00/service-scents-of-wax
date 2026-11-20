import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { FcmService } from '../services/fcm.service';

@Injectable()
export class FcmStrategy {
  private readonly logger = new Logger(FcmStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
  ) {}

  async deliver(userId: string, payload: any) {
    try {
      const devices = await this.prisma.userDevice.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      for (const device of devices) {
        try {
          await this.fcmService.sendPush(
            device.fcmToken,
            payload.title,
            payload.body,
          );
        } catch (err: any) {
          this.logger.warn(
            `Failed to send FCM notification to device ${device.id}: ${err.message}`,
          );
          // Continue with other devices
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to deliver FCM notifications: ${error.message}`,
      );
    }
  }
}
