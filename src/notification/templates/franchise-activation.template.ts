import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';
import { OrderSummaryPartial } from './partials/order-summary.partial';

export class FranchiseActivationTemplate {
  static build(params: {
    businessName: string;
    franchiseCode: string;
    ownerName?: string | null;
    note?: string;
  }) {
    const summaryItems = [
      { label: 'Business Name', value: params.businessName, isBold: true },
      { label: 'Franchise Code', value: params.franchiseCode, isHighlighted: true },
    ];

    const noteBox = params.note
      ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 12px 16px; margin: 18px 0; color: #475569; font-size: 14px;">
          ${params.note}
        </div>
      `
      : '';

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.FRANCHISE_ACTIVATION,
      title: 'Franchise Activated',
      buttonText: 'Open Dashboard',
      buttonUrl: `${process.env.FRANCHISE_APP_URL || 'https://dev-franchise.ezzme.com'}/login`,
      body: `
        <p style="margin: 0 0 16px;">Hello${params.ownerName ? ` ${params.ownerName}` : ''},</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          Congratulations! Your franchise account has been reviewed and successfully activated. You now have full access to our platform features and operations.
        </p>

        ${OrderSummaryPartial.render('Franchise Details', summaryItems, '#0d9488')}

        ${noteBox}

        <p style="margin: 24px 0 16px; line-height: 1.6;">
          Welcome aboard! Please click the button below to sign in to your dashboard and get started.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'GiftFactory'} Team</strong>
        </p>
      `,
    });
  }
}
