import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayGateway {
  private razorClient: Razorpay | null = null;

  private readonly logger = new Logger(RazorpayGateway.name);

  constructor(private readonly config: ConfigService) {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID')?.trim();
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET')?.trim();

    if (keyId && keySecret) {
      this.razorClient = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
      this.logger.log('Razorpay client initialized');
      return;
    }

    this.logger.warn(
      'Razorpay keys not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET). Payment features are disabled until set.',
    );
  }

  isConfigured(): boolean {
    return this.razorClient !== null;
  }

  getDetails(): Razorpay {
    if (!this.razorClient) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
    return this.razorClient;
  }

  getKeySecret(): string {
    return (
      this.config.get<string>('RAZORPAY_KEY_SECRET')?.trim() ||
      'RAZORPAY_KEY_SECRET'
    );
  }

  getWebHookKeySecret(): string {
    return (
      this.config.get<string>('RAZORPAY_WEBHOOK_SECRET')?.trim() ||
      'razor_webhook_secret'
    );
  }
}
