import { EmailTemplateBuilder } from './builders/email-template.builder';
import { NotificationEmailEnum } from './enums/notfication-email.enum';

export class LowStockTemplate {
  static build(params: {
    franchiseName: string;
    items: Array<{
      name: string;
      available: number;
      lowStockThreshold?: number;
      suggestedOrderQty?: number;
    }>;
    title?: string;
  }) {
    const title = params.title || 'Low Stock Alert';
    
    let tableHtml = '';
    if (params.items && params.items.length > 0) {
      let tableRows = '';
      for (const item of params.items) {
        const thresholdVal = item.lowStockThreshold !== undefined ? item.lowStockThreshold : 'N/A';
        const availableColor = item.available === 0 ? '#ef4444' : '#d97706';
        
        tableRows += `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 8px 12px 0; color: #0f172a; font-size: 14px; font-weight: 500; text-align: left; line-height: 1.4;">
              ${item.name}
            </td>
            <td style="padding: 12px 8px; color: ${availableColor}; font-size: 14px; font-weight: 600; text-align: right;">
              ${item.available}
            </td>
            <td style="padding: 12px 0 12px 8px; color: #64748b; font-size: 14px; text-align: right;">
              ${thresholdVal}
            </td>
          </tr>
        `;
      }

      tableHtml = `
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
            Low Stock Items
          </h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <thead>
              <tr>
                <th style="padding: 0 8px 8px 0; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; text-align: left; border-bottom: 1px solid #e2e8f0;">Product</th>
                <th style="padding: 0 8px 8px; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; text-align: right; border-bottom: 1px solid #e2e8f0;">Available</th>
                <th style="padding: 0 0 8px 8px; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; text-align: right; border-bottom: 1px solid #e2e8f0;">Threshold</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      `;
    } else {
      tableHtml = `
        <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 18px 0; color: #475569; font-size: 14px; border-radius: 6px;">
          Please log in to your franchise dashboard to view the low stock items in detail.
        </div>
      `;
    }

    return EmailTemplateBuilder.build({
      type: NotificationEmailEnum.LOW_STOCK,
      title,
      buttonText: 'Order Stock',
      buttonUrl: `${process.env.FRANCHISE_APP_URL || 'https://dev-franchise.ezzme.com'}/dashboard/inventory`,
      body: `
        <p style="margin: 0 0 16px;">Hi ${params.franchiseName},</p>
        <p style="margin: 0 0 18px; line-height: 1.6;">
          The following products in your franchise inventory have fallen below their low stock threshold. Please review the items below and consider placing a new stock request to avoid running out of stock.
        </p>

        ${tableHtml}

        <p style="margin: 24px 0 16px; line-height: 1.6;">
          Click the button below to go to your dashboard and manage your inventory or place order.
        </p>
        <p style="margin: 24px 0 0; line-height: 1.5;">
          Best regards,<br>
          <strong>The ${process.env.PLATFORM_NAME || 'UnBoxIO'} Team</strong>
        </p>
      `,
    });
  }
}
