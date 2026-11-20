import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';
import { OrderSummaryPartial } from './partials/order-summary.partial';

export class FranchiseRegistrationTemplate {
  static build(params: {
    franchiseId: string;
    franchiseName: string;
    franchiseCode: string;
    ownerName?: string | null;
    ownerEmail?: string | null;
    kycStatus?: string | null;
  }) {
    const summaryItems = [
      { label: 'Franchise Name', value: params.franchiseName, isBold: true },
      { label: 'Franchise Code', value: params.franchiseCode },
      { label: 'Owner Name', value: params.ownerName || '-' },
      { label: 'Owner Email', value: params.ownerEmail || '-' },
      { label: 'KYC Status', value: params.kycStatus || 'PENDING', isHighlighted: true },
    ];

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.FRANCHISE_REGISTRATION,
      title: 'New Franchise Registered',
      buttonText: 'Review Registration',
      buttonUrl: `${process.env.ADMIN_APP_URL || 'https://dev-admin.ezzme.com'}/dashboard/franchise/${params.franchiseId}`,
      body: `
        <p style="margin: 0 0 16px;">Hello Admin,</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          A new franchise has registered on the platform and requires administrative review. Please review their KYC documents and verify their application details:
        </p>

        ${OrderSummaryPartial.render('Registration Info', summaryItems, '#d97706')}

        <p style="margin: 24px 0 16px; line-height: 1.6;">
          You can approve or decline this request directly in the administrator console.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'GiftFactory'} System</strong>
        </p>
      `,
    });
  }
}
