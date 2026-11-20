import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';
import { OrderSummaryPartial } from './partials/order-summary.partial';

export class PaymentFailureTemplate {
  static build(params: {
    orderId: string;
    platformName: string;
    reason: string;
    amount: number;
    orderNumber: string;
    recipientName: string;
  }) {
    const { orderId, platformName, reason, amount, orderNumber, recipientName } = params;

    const summaryItems = [
      { label: 'Order Number', value: `#${orderNumber}`, isBold: true },
      { label: 'Amount Due', value: amount },
      { label: 'Failure Reason', value: reason, isHighlighted: true },
    ];

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.PAYMENT_FAILURE,
      title: 'Payment Failed',
      buttonText: 'Retry Payment',
      buttonUrl: `${process.env.CUSTOMER_APP_URL || 'https://dev-giftfactory.ezzme.com'}/orders/${orderId}`,
      body: `
        <p style="margin: 0 0 16px;">Dear ${recipientName},</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          We were unable to process your payment for order <strong>#${orderNumber}</strong>. Please find the details of the transaction below:
        </p>

        ${OrderSummaryPartial.render('Transaction Details', summaryItems, '#ef4444')}

        <!-- Warning Callout Box -->
        <div style="background-color: #fff5f5; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <h4 style="margin: 0 0 6px; color: #991b1b; font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;">What should you do?</h4>
          <p style="margin: 0; color: #b91c1c; font-size: 13px; line-height: 1.5; font-family: 'Inter', sans-serif;">
            Please log in to your account and retry the payment using an alternative payment method. If the amount has been debited from your account, it will be refunded automatically within 3-5 business days.
          </p>
        </div>

        <p style="margin: 24px 0 16px; line-height: 1.6;">
          If the problem persists, please do not hesitate to contact our customer support team.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${platformName} Team</strong>
        </p>
      `,
    });
  }
}
