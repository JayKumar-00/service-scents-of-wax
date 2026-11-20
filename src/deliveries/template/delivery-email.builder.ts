import { EmailTemplateBuilder } from '../../notification/templates/builders/email-template.builder';
import { NotificationEmailEnum } from '../../notification/templates/enums/notfication-email.enum';
import { OrderSummaryPartial } from '../../notification/templates/partials/order-summary.partial';

export class DeliveryEmailBuilder {
  /**
   * Builds the HTML email content for a stock request delivery notification.
   * @param params.deliveryId - The ID of the delivery.
   * @param params.stockRequestId - (Optional) The associated stock request ID.
   * @param params.franchise - Franchise information (ownerFullName, businessName, name, code, ownerEmail, etc.).
   * @param params.platformName - The platform name to display in the signature.
   * @returns HTML string ready to be sent via email.
   */
  static build(params: {
    deliveryId: string;
    stockRequestId?: string | null;
    franchise: any;
    platformName: string;
    productName?: string | null;
    variantName?: string | null;
    quantity?: number | null;
  }): string {
    const {
      deliveryId,
      stockRequestId,
      franchise,
      platformName,
      productName,
      variantName,
      quantity,
    } = params;
    const ownerName = franchise.ownerFullName || 'Franchise Owner';
    const franchiseName = franchise.businessName || franchise.name;
    const franchiseCode = franchise.code;

    const summaryItems = [
      { label: 'Delivery ID', value: deliveryId, isBold: true },
      ...(stockRequestId ? [{ label: 'Stock Request ID', value: stockRequestId }] : []),
      { label: 'Franchise', value: `${franchiseName} (${franchiseCode})` },
      ...(productName ? [{ label: 'Product', value: variantName ? `${productName} (${variantName})` : productName }] : []),
      ...(quantity !== undefined && quantity !== null ? [{ label: 'Quantity', value: String(quantity) }] : []),
      { label: 'Status', value: 'Delivered', isHighlighted: true },
    ];

    const accentColor = '#f97316'; // Matches NotificationEmailEnum.DELIVERY color in EmailTemplateBuilder

    const buttonUrl = stockRequestId
      ? `${process.env.FRANCHISE_APP_URL || 'https://dev-franchise.ezzme.com'}/dashboard/stock-request/${stockRequestId}`
      : `${process.env.FRANCHISE_APP_URL || 'https://dev-franchise.ezzme.com'}/dashboard`;

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.DELIVERY,
      title: 'Stock Request Shipment Delivered ✓',
      buttonText: 'View Stock Request',
      buttonUrl,
      body: `
        <p style="margin: 0 0 16px;">Dear ${franchiseName || ownerName},</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          Your stock request shipment has been marked as <strong>DELIVERED</strong> at your store location.
        </p>

        ${OrderSummaryPartial.render('Delivery Details', summaryItems, accentColor)}

        <p style="margin: 24px 0 16px; line-height: 1.6;">
          Please verify items upon receipt. If an invoice is generated, it is attached to this email.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Regards,<br>
          <strong>${platformName} Supply Chain Team</strong>
        </p>
      `,
    });
  }
}

