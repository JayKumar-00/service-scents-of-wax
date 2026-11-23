import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';
import { OrderSummaryPartial } from './partials/order-summary.partial';

export class InvoiceTemplate {
  static build(params: {
    orderId?: string;
    customerName: string;
    orderNumber?: string;
    statusText?: string;
  }) {
    const { orderId, customerName, orderNumber, statusText } = params;

    const summaryItems = [
      { label: 'Order Number', value: orderNumber ? `#${orderNumber}` : '-', isBold: true },
      { label: 'Document Type', value: 'Tax Invoice' },
      { label: 'Status', value: statusText || 'Generated', isHighlighted: true },
    ];

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.INVOICE,
      title: 'Invoice Document',
      buttonText: 'View Order Details',
      buttonUrl: `${process.env.CUSTOMER_APP_URL || 'https://dev-giftfactory.ezzme.com'}/orders/${orderId || ''}`,
      body: `
        <p style="margin: 0 0 16px;">Dear <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          Thank you for shopping with us! Your invoice for order <strong>#${orderNumber || ''}</strong> has been successfully generated.
        </p>

        ${OrderSummaryPartial.render('Invoice Details', summaryItems, '#0f172a')}

        <p style="margin: 24px 0 16px; line-height: 1.6;">
          Please find the attached PDF document for your records. If you have any questions or require further assistance, please contact our support team.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'ScentsOfWax'} Team</strong>
        </p>
      `,
    });
  }
}
