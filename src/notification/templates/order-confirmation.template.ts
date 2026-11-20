import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';
import { OrderSummaryPartial } from './partials/order-summary.partial';

export class OrderConfimationTemplate {
  static build(params: {
    orderId: string;
    customerName: string;
    platformName: string;
    orderNumber: string;
    supportEmail: string;
    amount: number;
    title?: string;
    subTitle?: string;
    message?: string;
  }) {
    const { orderId, customerName, platformName, supportEmail, orderNumber, amount, title, subTitle, message } =
      params;

    const summaryItems = [
      { label: 'Order Number', value: `#${orderNumber}`, isBold: true },
      { label: 'Amount Paid', value: amount, isHighlighted: true },
    ];

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.ORDER,
      title: title || 'Order Confirmation',
      buttonText: 'Track Order',
      buttonUrl: `${process.env.CUSTOMER_APP_URL || 'https://dev-giftfactory.ezzme.com'}/orders/${orderId}`,
      body: `
        <p style="margin: 0 0 16px;">Dear ${customerName},</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          ${message ?? 'Thank you for your order! Your payment has been successfully processed.'}
        </p>

        ${OrderSummaryPartial.render('Order Details', summaryItems, '#6366f1')}

        <h3 style="margin: 24px 0 12px; font-size: 15px; color: #0f172a; font-weight: 700;">What's Next?</h3>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border-collapse: collapse;">
          <tr>
            <td valign="top" style="width: 20px; padding-right: 10px; padding-bottom: 10px; color: #6366f1; font-weight: 700;">✓</td>
            <td valign="top" style="color:#475569;font-size:14px;line-height:1.6;padding-bottom:10px;">
              You will receive a tracking update once your order is dispatched.
            </td>
          </tr>
          <tr>
            <td valign="top" style="width: 20px; padding-right: 10px; color: #6366f1; font-weight: 700;">✓</td>
            <td valign="top" style="color:#475569;font-size:14px;line-height:1.6;">
              Check your order status anytime in your account dashboard.
            </td>
          </tr>
        </table>

        <p style="margin: 24px 0 16px; font-size: 13px; color: #64748b; line-height: 1.5;">
          Have questions or need assistance? Reach out to our support team at <strong style="color: #0f172a;">${supportEmail}</strong>.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${platformName} Team</strong>
        </p>
      `,
    });
  }
}
