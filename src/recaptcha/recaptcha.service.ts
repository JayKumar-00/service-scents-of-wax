import { Injectable, Logger } from '@nestjs/common';
import { RecaptchaProvider } from './providers/recaptcha.provider';

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  constructor(private readonly recaptchaProvider: RecaptchaProvider) {}

  getSiteKey(): string {
    return this.recaptchaProvider.getSiteKey();
  }

  /**
   * Validates a reCAPTCHA token by delegating to the recaptcha provider.
   * @param token Token from the frontend client
   * @param remoteIp Client's IP address (optional)
   * @returns boolean true if verification is successful, false otherwise
   */
  async validateToken(token: string, remoteIp?: string): Promise<boolean> {
    if (!token) {
      this.logger.warn(
        JSON.stringify({
          event: 'fraud_monitoring.recaptcha_failure',
          message: 'reCAPTCHA token was not provided',
          ip: remoteIp || 'unknown',
          severity: 'WARNING',
          timestamp: new Date().toISOString(),
        }),
      );
      return false;
    }
    return this.recaptchaProvider.validateToken(token, remoteIp);
  }
}
