import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';
import { OtpBoxPartial } from './partials/otp-box.partial';

export class OtpTemplate {
  static build(params: { otp: string; validMinutes?: number }) {
    const validMinutes = params.validMinutes || 10;

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.OTP,
      title: 'Verification Code',
      body: `
        <p style="margin: 0 0 16px;">Hello,</p>
        <p style="margin: 0 0 16px; line-height: 1.6;">
          You requested a verification code to access your <strong>${process.env.PLATFORM_NAME || 'UnBoxIO'}</strong> account. Please use the One-Time Password (OTP) below to complete your verification:
        </p>

        ${OtpBoxPartial.render(params.otp, validMinutes, '#4f46e5')}

        <p style="margin: 24px 0 16px; font-size: 13px; color: #64748b; line-height: 1.5;">
          For security reasons, do not share this OTP with anyone. If you did not request this code, you can safely ignore this email.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'UnBoxIO'} Team</strong>
        </p>
      `,
    });
  }
}
