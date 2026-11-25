import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';
import { OrderSummaryPartial } from './partials/order-summary.partial';

export class StockRequestPaymentTemplate {
  static build(params: {
    stockRequestId: string;
    franchiseCode: string;
    businessName: string;
    ownerName?: string | null;

    totalAmount: number;
    cashAmount?: number;
    deductedAmount: number;
    remainingAmount: number;

    paymentStatus: string;
    paymentReference?: string;
    title?: string;
    intro?: string;
    reason?: string;
  }) {
    const title = params.title || 'Stock Request Payment Updated';
    const intro =
      params.intro ||
      'Your stock request payment has been processed successfully.';

    const summaryItems = [
      { label: 'Stock Request ID', value: params.stockRequestId, isBold: true },
      { label: 'Business Name', value: params.businessName },
      { label: 'Franchise Code', value: params.franchiseCode },
      { label: 'Payment Status', value: params.paymentStatus, isHighlighted: true },
      { label: 'Total Amount', value: params.totalAmount },
      { label: 'Cash Paid', value: params.cashAmount || 0 },
      { label: 'Credit Used', value: params.deductedAmount },
      { label: 'Remaining Balance', value: params.remainingAmount },
    ];

    if (params.paymentReference) {
      summaryItems.splice(4, 0, { label: 'Payment Reference', value: params.paymentReference });
    }

    const reasonBox = params.reason
      ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 18px 0; color: #475569; font-size: 14px;">
          <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Update Reason</strong>
          ${params.reason}
        </div>
      `
      : '';

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.PAYMENT,
      title,
      buttonText: 'Open Dashboard',
      buttonUrl: `${process.env.FRANCHISE_APP_URL || 'https://dev-franchise.ezzme.com'}/dashboard/stock-request/${params.stockRequestId}`,
      body: `
        <p style="margin: 0 0 16px;">Hello ${params.businessName || params.ownerName || 'Partner'},</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          ${intro}
        </p>

        ${OrderSummaryPartial.render('Stock Request & Payment Summary', summaryItems, '#10b981')}

        ${reasonBox}

        <p style="margin: 24px 0 16px; line-height: 1.6;">
          Please log in to your dashboard to review full order history or make additional requests.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'ScentsOfWax'} Team</strong>
        </p>
      `,
    });
  }
}

export class StockRequestStatusTemplate {
  static build(params: {
    stockRequestId: string;
    franchiseCode: string;
    businessName: string;
    ownerName?: string | null;
    productName: string;
    variantInfo?: string;
    quantityInfo: string;
    isApproval: boolean;
    body: string;
    reason?: string;
  }) {
    const title = params.isApproval
      ? 'Your Stock Request has been Approved'
      : 'Your Stock Request has been rejected';

    const accentColor = params.isApproval ? '#10b981' : '#ef4444';

    const summaryItems = [
      { label: 'Stock Request ID', value: params.stockRequestId, isBold: true },
      { label: 'Franchise', value: `${params.businessName} (${params.franchiseCode})` },
      { label: 'Product', value: `${params.productName}${params.variantInfo || ''}` },
      { label: 'Quantity', value: params.quantityInfo },
    ];

    if (params.reason) {
      summaryItems.push({ label: 'Reason', value: params.reason });
    }

    return EmailTemplateBuilder.build({
      type: params.isApproval ? NotificationEmailEnum.PAYMENT : NotificationEmailEnum.PAYMENT_FAILURE,
      title,
      buttonText: 'View Stock Request',
      buttonUrl: `${process.env.FRANCHISE_APP_URL || 'https://dev-franchise.ezzme.com'}/dashboard/stock-request/${params.stockRequestId}`,
      body: `
        <p style="margin: 0 0 16px;">Dear ${params.businessName || params.ownerName || 'Partner'},</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          ${params.body}
        </p>

        ${OrderSummaryPartial.render('Stock Request Details', summaryItems, accentColor)}

        <p style="margin: 24px 0 16px; line-height: 1.6;">
          Please log in to your dashboard to review full stock request history.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'ScentsOfWax'} Team</strong>
        </p>
      `,
    });
  }
}

