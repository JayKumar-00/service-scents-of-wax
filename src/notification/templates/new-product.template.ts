import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';

export class NewProductTemplate {
  static build(params: {
    productName: string;
    productId: string;
    slug: string;
    imageUrl?: string | null;
    body: string;
  }) {
    const customerAppUrl =
      process.env.CUSTOMER_APP_URL || 'https://dev-giftfactory.ezzme.com';
    const productUrl = `${customerAppUrl}/products/${params.productId}`;

    const imageHtml = params.imageUrl
      ? `
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);">
          <img src="${params.imageUrl}" alt="${params.productName}" style="max-width: 100%; max-height: 280px; object-fit: contain; border-radius: 8px; display: inline-block;" />
        </div>
      `
      : '';

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.NEW_PRODUCT,
      title: 'New Product Available',
      buttonText: 'View Product Details',
      buttonUrl: productUrl,
      body: `
        <p style="margin: 0 0 16px;">Hello,</p>
        <p style="margin: 0 0 20px; line-height: 1.6;">
          We are pleased to introduce our latest addition: <strong style="color: #0f172a;">${params.productName}</strong>.
        </p>

        ${imageHtml}

        <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; margin: 24px 0; border-radius: 4px; color: #475569; font-size: 14px; line-height: 1.6;">
          ${params.body}
        </div>

        <p style="margin: 0 0 24px; line-height: 1.6;">
          Check out the product details and start shopping by clicking the button below.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'ScentsOfWax'} Team</strong>
        </p>
      `,
    });
  }
}
