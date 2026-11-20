import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';

export class RefferalTemplate {
  static build(params: {
    referrerEmail: string;
    referralCode: string;
    signupUrl: string;
  }) {
    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.REFFERAL,
      title: "You've Been Invited to UnBoxIO!",
      body: `
        <p style="margin: 0 0 16px;">Hello,</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          Your colleague or friend <strong>${params.referrerEmail}</strong> has invited you to join <strong>UnBoxIO</strong>, the leading platform for corporate gifting and custom merchandise.
        </p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          By registering, you'll gain access to curated gift collections, automated custom branding, and exclusive loyalty rewards. Use the referral code below during signup to claim your welcome benefits:
        </p>

        <!-- Referral Code Display -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0; border-collapse: collapse;">
          <tr>
            <td align="center">
              <div style="
                display: inline-block;
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                border-left: 4px solid #2563eb;
                border-radius: 8px;
                padding: 16px 32px;
                text-align: center;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
              ">
                <span style="
                  font-family: 'Courier New', Courier, monospace, sans-serif;
                  font-size: 24px;
                  font-weight: 700;
                  color: #0f172a;
                  letter-spacing: 2px;
                  line-height: 1;
                ">${params.referralCode}</span>
              </div>
            </td>
          </tr>
        </table>

        <p style="margin: 0 0 24px; line-height: 1.6;">
          Click the button below to accept the invitation, register your account, and instantly claim your rewards!
        </p>
      `,
      buttonText: 'Accept Invitation & Sign Up',
      buttonUrl: params.signupUrl,
      footerText:
        'This invitation was sent to you on behalf of a friend. If you did not expect this, you can safely ignore this email.',
    });
  }
}
