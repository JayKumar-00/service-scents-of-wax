import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';
import { OrderSummaryPartial } from './partials/order-summary.partial';

export class CustomerOrderCreateTemplate {
  static build(params: {
    orderId: string;
    orderNumber: string;
    totalAmount: string;
    ownerName?: string | null;
    note?: string;
    isOnlinePayment?: boolean;
  }) {
    const paymentExpiryMinutes = process.env.PAYMENT_EXPIRY_MINUTES || '5';
    const amountNum = parseFloat(params.totalAmount.replace(/,/g, ''));

    const summaryItems = [
      { label: 'Order Number', value: `#${params.orderNumber}`, isBold: true },
      { label: 'Total Amount', value: isNaN(amountNum) ? `₹${params.totalAmount}` : amountNum, isHighlighted: true },
    ];

    const warningBox = params.isOnlinePayment
      ? `
        <div style="background-color: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #f97316; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <h4 style="margin: 0 0 6px; color: #ea580c; font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;">Action Required: Payment Pending</h4>
          <p style="margin: 0; color: #c2410c; font-size: 13px; line-height: 1.5; font-family: 'Inter', sans-serif;">
            This order is awaiting online payment. Please complete your payment within <strong>${paymentExpiryMinutes} minutes</strong> to secure your order.
          </p>
        </div>
      `
      : '';

    const noteBox = params.note
      ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 12px 16px; margin: 18px 0; font-style: italic; color: #475569; font-size: 14px;">
          "${params.note}"
        </div>
      `
      : '';

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.ORDER,
      title: 'Order Created Successfully',
      buttonText: 'View Order Details',
      buttonUrl: `${process.env.CUSTOMER_APP_URL || 'https://dev-giftfactory.ezzme.com'}/orders/${params.orderId}`,
      body: `
        <p style="margin: 0 0 16px;">Hello${params.ownerName ? ` ${params.ownerName}` : ''},</p>
        <p style="margin: 0 0 16px; line-height: 1.6;">
          Your order has been successfully created. We are excited to process it for you! Here are the details:
        </p>

        ${OrderSummaryPartial.render('Order Details', summaryItems, '#6366f1')}

        ${warningBox}
        ${noteBox}

        <p style="margin: 24px 0 16px; line-height: 1.6;">
          We will notify you with another update as soon as your order status changes.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'GiftFactory'} Team</strong>
        </p>
      `,
    });
  }
}
