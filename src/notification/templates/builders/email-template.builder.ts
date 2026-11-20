import { NotificationEmailEnum } from '../enums/notfication-email.enum';
import { BaseEmailLayout } from '../layouts/base-email.layout';
import { ButtonPartial } from '../partials/button.partial';

export class EmailTemplateBuilder {
  static build(params: {
    type: NotificationEmailEnum;
    title: string;
    body: string;
    buttonText?: string;
    buttonUrl?: string;
    footerText?: string;
  }) {
    let color = '#4f46e5';

    switch (params.type) {
      case NotificationEmailEnum.OTP:
        color = '#4f46e5';
        break;

      case NotificationEmailEnum.REFFERAL:
        color = '#2563eb';
        break;

      case NotificationEmailEnum.INVOICE:
        color = '#0f172a';
        break;

      case NotificationEmailEnum.ORDER:
        color = '#6366f1';
        break;

      case NotificationEmailEnum.PAYMENT:
        color = '#10b981';
        break;

      case NotificationEmailEnum.PAYMENT_FAILURE:
        color = '#ef4444';
        break;

      case NotificationEmailEnum.DELIVERY:
        color = '#f97316';
        break;

      case NotificationEmailEnum.SUPPORT:
        color = '#8b5cf6';
        break;

      case NotificationEmailEnum.SYSTEM:
        color = '#dc2626';
        break;

      case NotificationEmailEnum.FRANCHISE_ACTIVATION:
        color = '#0d9488';
        break;

      case NotificationEmailEnum.FRANCHISE_REGISTRATION:
        color = '#d97706';
        break;

      case NotificationEmailEnum.LOW_STOCK:
        color = '#f59e0b';
        break;

      case NotificationEmailEnum.NEW_PRODUCT:
        color = '#6366f1';
        break;
    }

    const isInvoice = params.type === NotificationEmailEnum.INVOICE;

    const button = params.buttonText && params.buttonUrl
      ? ButtonPartial.render(params.buttonText, params.buttonUrl, color, isInvoice)
      : '';

    return BaseEmailLayout.render({
      title: params.title,

      subtitle: params.type.replaceAll('_', ' '),

      eyebrow:
        params.type === NotificationEmailEnum.OTP
          ? 'Security Verification'
          : params.type === NotificationEmailEnum.INVOICE
            ? 'Billing & Invoices'
            : params.type === NotificationEmailEnum.ORDER
              ? 'Order Notification'
              : params.type === NotificationEmailEnum.PAYMENT
                ? 'Payment Confirmation'
                : params.type === NotificationEmailEnum.PAYMENT_FAILURE
                  ? 'Payment Failure Warning'
                  : params.type === NotificationEmailEnum.LOW_STOCK
                    ? 'Inventory Alert'
                    : params.type === NotificationEmailEnum.NEW_PRODUCT
                      ? 'New Arrival'
                      : params.type === NotificationEmailEnum.DELIVERY
                        ? 'Delivery Confirmation'
                        : 'Platform Update',

      accentColor: color,

      body: `
        ${params.body}
        ${button}
      `,

      footerText: params.footerText,
    });
  }
}
