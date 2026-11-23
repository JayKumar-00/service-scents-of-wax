import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class BrevoProvider {
  private readonly logger = new Logger(BrevoProvider.name);

  private client: BrevoClient | null = null;

  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly smsSender: string;

  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.senderEmail =
      this.configService.get<string>('BREVO_SENDER_EMAIL') || '';

    this.senderName =
      this.configService.get<string>('BREVO_SENDER_NAME') || 'ScentsOfWax';

    this.smsSender =
      this.configService.get<string>('BREVO_SMS_SENDER') || 'ScentsOfWax-E';

    this.initializeBrevo();
  }

  private initializeBrevo(): void {
    try {
      const apiKey = this.configService.get<string>('BREVO_API_KEY')?.trim();

      if (!apiKey) {
        this.logger.error('BREVO_API_KEY is missing in environment variables');

        this.isInitialized = false;

        return;
      }

      this.client = new BrevoClient({
        apiKey,
      });

      this.isInitialized = true;

      this.logger.log('Brevo initialized successfully');
    } catch (error: any) {
      this.logger.error(
        `Failed to initialize Brevo: ${error.message}`,
        error.stack,
      );

      this.isInitialized = false;
    }
  }

  getClient(): BrevoClient {
    if (!this.isInitialized || !this.client) {
      throw new ServiceUnavailableException({
        message:
          'Brevo service is not initialized. Please check BREVO_API_KEY configuration.',
        code: 'BREVO_NOT_INITIALIZED',
      });
    }

    return this.client;
  }

  getEmailSender() {
    if (!this.senderEmail) {
      throw new InternalServerErrorException({
        message: 'BREVO_SENDER_EMAIL is missing in environment variables.',
        code: 'BREVO_SENDER_EMAIL_MISSING',
      });
    }

    return {
      email: this.senderEmail,
      name: this.senderName,
    };
  }

  getSmsSender(): string {
    if (!this.smsSender) {
      throw new InternalServerErrorException({
        message: 'BREVO_SMS_SENDER is missing in environment variables.',
        code: 'BREVO_SMS_SENDER_MISSING',
      });
    }

    return this.smsSender;
  }

  getSenderName(): string {
    return this.senderName;
  }

  getSmsSenderName(): string {
    return this.smsSender;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}
