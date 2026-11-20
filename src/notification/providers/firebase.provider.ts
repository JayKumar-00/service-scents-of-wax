import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseProvider {
  private readonly logger = new Logger(FirebaseProvider.name);
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
      const clientEmail = this.configService.get<string>(
        'FIREBASE_CLIENT_EMAIL',
      );

      // Check if required credentials exist
      if (!projectId || !privateKey || !clientEmail) {
        this.logger.warn(
          'Firebase credentials not fully configured. Push notifications will be skipped. ' +
            'Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL to enable.',
        );
        this.isInitialized = false;
        return;
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            clientEmail,
          }),
        });

        this.logger.log('Firebase initialized successfully');
        this.isInitialized = true;
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to initialize Firebase: ${error.message}. ` +
          'Push notifications will be skipped. Please check your Firebase credentials.',
      );
      this.isInitialized = false;
    }
  }

  getMessaging() {
    if (!this.isInitialized) {
      return null;
    }
    return admin.messaging();
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}
