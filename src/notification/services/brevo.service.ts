import { Injectable, HttpException, Logger } from '@nestjs/common';
import { BrevoProvider } from '../providers/brevo.provider';

@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);

  constructor(private readonly brevoProvider: BrevoProvider) {}

  // --------------------------------------------------------------------------
  // EMAIL
  // --------------------------------------------------------------------------

  async sendEmail(params: {
    to: string;
    subject: string;
    htmlContent: string;
    replyTo?: string;
    attachment?: Array<{
      content: string;
      name: string;
    }>;
  }) {
    try {
      const client = this.brevoProvider.getClient();
      const { to, subject, htmlContent, replyTo, attachment } = params;

      return await client.transactionalEmails.sendTransacEmail({
        sender: this.brevoProvider.getEmailSender(),

        to: [
          {
            email: to,
          },
        ],

        subject,

        htmlContent,

        ...(replyTo && {
          replyTo: {
            email: replyTo,
            name: this.brevoProvider.getSenderName() || 'ScentsOfWax',
          },
        }),

        ...(attachment && {
          attachment,
        }),
      });
    } catch (error) {
      const errorCode = this.getBrevoErrorCode(error);
      const errorMessage = this.getBrevoErrorMessage(error);
      const status = this.getBrevoStatusCode(error) || 500;

      this.logger.error('Brevo email error', {
        code: errorCode,
        message: errorMessage,
        status,
        cause: this.getErrorCause(error),
        fullError: error,
      });

      throw new HttpException(
        {
          code: errorCode,
          message: `Failed to send email: ${errorMessage}`,
        },
        status,
      );
    }
  }

  // --------------------------------------------------------------------------
  // SMS (919999999999)
  // --------------------------------------------------------------------------

  async sendSms(params: { to: string; content: string; sender?: string }) {
    try {
      const { to, content, sender } = params;

      const client = this.brevoProvider.getClient();
      return await client.transactionalSms.sendTransacSms({
        sender: sender || this.brevoProvider.getSmsSender(),

        recipient: to,

        content,
      });
    } catch (error) {
      const errorCode = this.getBrevoErrorCode(error);
      const errorMessage = this.getBrevoErrorMessage(error);
      const status = this.getBrevoStatusCode(error) || 500;

      this.logger.error('Brevo SMS error', {
        code: errorCode,
        message: errorMessage,
        status,
        cause: this.getErrorCause(error),
        fullError: error,
      });

      throw new HttpException(
        {
          code: errorCode,
          message: `Failed to send SMS: ${errorMessage}`,
        },
        status,
      );
    }
  }

  // --------------------------------------------------------------------------
  // ERROR HANDLER
  // --------------------------------------------------------------------------

  private getBrevoErrorCode(error: any): string {
    try {
      if (error?.response?.body?.code) {
        return error.response.body.code;
      }
      if (error?.body?.code) {
        return error.body.code;
      }
      if (error?.code) {
        return error.code;
      }
      if (error?.response?.statusCode) {
        return `HTTP_${error.response.statusCode}`;
      }
    } catch (e) {
      this.logger.error('Error extracting Brevo error code', e);
    }
    return 'UNKNOWN_ERROR';
  }

  private getBrevoStatusCode(error: any): number | undefined {
    try {
      if (error?.response?.statusCode) return Number(error.response.statusCode);
      if (error?.response?.status) return Number(error.response.status);
      if (error?.statusCode) return Number(error.statusCode);
      if (error?.status) return Number(error.status);
    } catch (e) {
      this.logger.error('Error extracting Brevo status code', e);
    }
    return undefined;
  }

  private getBrevoErrorMessage(error: any): string {
    try {
      // Handle Brevo SDK error with nested body structure
      if (error?.response?.body) {
        const body = error.response.body;
        const message = body.message || 'Unknown error';
        return message;
      }

      // Handle direct body structure
      if (error?.body) {
        const message = error.body.message || 'Unknown error';
        return message;
      }

      // Handle direct message in error
      if (error?.message) {
        if (error?.cause?.message) {
          return `${error.message}: ${error.cause.message}`;
        }

        return error.message;
      }

      // Handle string error
      if (typeof error === 'string') {
        return error;
      }
    } catch (e) {
      this.logger.error('Error extracting Brevo error message', e);
    }

    return 'Unknown error from Brevo';
  }

  private getErrorCause(error: any): string | null {
    try {
      if (!error?.cause) {
        return null;
      }

      const parts = [];

      if (error.cause.code) {
        parts.push(`code=${error.cause.code}`);
      }

      if (error.cause.message) {
        parts.push(`message=${error.cause.message}`);
      }

      if (error.cause.hostname) {
        parts.push(`hostname=${error.cause.hostname}`);
      }

      if (error.cause.syscall) {
        parts.push(`syscall=${error.cause.syscall}`);
      }

      return parts.length ? parts.join(', ') : String(error.cause);
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // OTP HELPERS
  // --------------------------------------------------------------------------

  async sendOtpEmail(params: { to: string; otp: string }) {
    return this.sendEmail({
      to: params.to,

      subject: 'Your OTP Code',

      htmlContent: `
        <div style="font-family: sans-serif;">
          <h2>Your OTP Code</h2>

          <p>Your verification code is:</p>

          <h1>${params.otp}</h1>

          <p>This OTP expires in 10 minutes.</p>
        </div>
      `,
    });
  }

  async sendOtpSms(params: { to: string; otp: string }) {
    return this.sendSms({
      to: params.to,

      content: `Your OTP is ${params.otp}. Valid for 10 minutes.`,
    });
  }
}
