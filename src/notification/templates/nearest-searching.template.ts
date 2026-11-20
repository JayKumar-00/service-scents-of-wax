import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';

export class NearestSearchingTemplate {
  static build(params: {
    customerName?: string | null;
    requestId: string;
    note?: string;
  }) {
    const noteBox = params.note
      ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 12px 16px; margin: 18px 0; color: #475569; font-size: 14px;">
          <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Additional Information</strong>
          ${params.note}
        </div>
      `
      : '';

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.ORDER,
      title: 'Franchise Search in Progress',
      buttonText: 'Track Request Status',
      buttonUrl: `${process.env.CUSTOMER_APP_URL || 'https://dev-giftfactory.ezzme.com'}/requests/${params.requestId}`,
      body: `
        <p style="margin: 0 0 16px;">Hello${params.customerName ? ` ${params.customerName}` : ''},</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          To ensure the fastest possible delivery and service, our system is automatically finding and assigning the most suitable franchise for your order request.
        </p>

        <!-- Request ID Card -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
          <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Request ID</span>
          <span style="font-family: monospace; font-size: 20px; font-weight: 700; color: #0f172a;">${params.requestId}</span>
        </div>

        <!-- Explanation Card -->
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
          <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 15px; color: #0f172a; font-weight: 700;">What happened?</h3>
          <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">
            The nearest franchise was unable to respond within the required timeframe. To avoid unnecessary delays, your request has been forwarded to the next closest available franchise.
          </p>
        </div>

        <h3 style="margin: 24px 0 12px; font-size: 16px; color: #0f172a; font-weight: 700;">What happens next?</h3>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border-collapse: collapse;">
          <tr>
            <td valign="top" style="width: 28px; padding-right: 12px; padding-bottom: 16px;">
              <div style="width:28px;height:28px;border-radius:50%;background-color:#6366f1;color:#ffffff;text-align:center;line-height:28px;font-size:13px;font-weight:700;">1</div>
            </td>
            <td valign="top" style="color:#475569;font-size:14px;line-height:1.6;padding-bottom:16px;">
              The next nearest franchise is being contacted automatically.
            </td>
          </tr>
          <tr>
            <td valign="top" style="width: 28px; padding-right: 12px; padding-bottom: 16px;">
              <div style="width:28px;height:28px;border-radius:50%;background-color:#6366f1;color:#ffffff;text-align:center;line-height:28px;font-size:13px;font-weight:700;">2</div>
            </td>
            <td valign="top" style="color:#475569;font-size:14px;line-height:1.6;padding-bottom:16px;">
              Once a franchise accepts the request, order processing will begin immediately.
            </td>
          </tr>
          <tr>
            <td valign="top" style="width: 28px; padding-right: 12px;">
              <div style="width:28px;height:28px;border-radius:50%;background-color:#6366f1;color:#ffffff;text-align:center;line-height:28px;font-size:13px;font-weight:700;">3</div>
            </td>
            <td valign="top" style="color:#475569;font-size:14px;line-height:1.6;">
              You will receive another update as soon as your order is accepted.
            </td>
          </tr>
        </table>

        ${noteBox}

        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <h4 style="margin: 0 0 4px; color: #1d4ed8; font-size: 14px; font-weight: 700;">No action required</h4>
          <p style="margin: 0; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
            We'll continue searching and notify you automatically when a franchise accepts your request. Thank you for your patience!
          </p>
        </div>

        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'UnBoxIO'} Team</strong>
        </p>
      `,
    });
  }
}
