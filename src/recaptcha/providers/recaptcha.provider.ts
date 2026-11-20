import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RecaptchaProvider {
  private readonly logger = new Logger(RecaptchaProvider.name);
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      const secret = this.configService.get<string>('RECAPTCHA_SECRET');

      // Check if required credentials exist
      if (!secret) {
        this.logger.warn(
          'Recaptcha credentials not fully configured. Recaptcha verification will be skipped. ' +
            'Set RECAPTCHA_SECRET to enable.',
        );
        this.isInitialized = false;
        return;
      }

      this.logger.log('Recaptcha initialized successfully');
      this.isInitialized = true;
    } catch (error: any) {
      this.logger.warn(
        `Failed to initialize Recaptcha: ${error.message}. ` +
          'Recaptcha verification will be skipped. Please check your Recaptcha credentials.',
      );
      this.isInitialized = false;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getSiteKey(): string {
    return (
      this.configService.get<string>('RECAPTCHA_SITE_KEY') ||
      '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
    );
  }

  async validateToken(token: string, remoteIp?: string): Promise<boolean> {
    if (!this.isInitialized) {
      this.logger.warn('Recaptcha is not initialized. Skipping validation.');
      return true;
    }
    try {
      const params = new URLSearchParams();
      params.append(
        'secret',
        this.configService.get<string>('RECAPTCHA_SECRET') || '',
      );
      params.append('response', token);
      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        },
      );
      return response.data.success === true;
    } catch (error: any) {
      this.logger.error('Recaptcha verification failed:', error.message);
      return false;
    }
  }
}
