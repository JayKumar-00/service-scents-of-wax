import { Injectable, Logger } from '@nestjs/common';

import { FirebaseProvider } from '../providers/firebase.provider';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  constructor(private readonly firebaseProvider: FirebaseProvider) {}

  async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    try {
      const messaging = this.firebaseProvider.getMessaging();

      if (!messaging) {
        this.logger.warn(
          `Cannot send push notification to ${token} - Firebase is not initialized`,
        );
        return null;
      }

      return await messaging.send({
        token,

        notification: {
          title,
          body,
        },

        data,
      });
    } catch (error: any) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      throw error;
    }
  }
}
