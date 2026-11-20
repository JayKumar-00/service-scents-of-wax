export interface OrderSummaryItem {
  label: string;
  value: string | number;
  isBold?: boolean;
  isHighlighted?: boolean;
}

export class OrderSummaryPartial {
  static render(title: string, items: OrderSummaryItem[], accentColor = '#6d28d9') {
    let rowsHtml = '';
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isLast = i === items.length - 1;
      const borderStyle = isLast ? '' : 'border-bottom: 1px solid #e2e8f0;';
      const color = item.isHighlighted ? accentColor : '#0f172a';
      const weight = (item.isBold || item.isHighlighted) ? '700' : '400';
      const val = typeof item.value === 'number' ? `₹${item.value.toFixed(2)}` : item.value;

      rowsHtml += `
        <tr>
          <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; text-align: left; ${borderStyle}">
            ${item.label}
          </td>
          <td style="padding: 12px 0; color: ${color}; font-size: 14px; font-weight: ${weight}; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; text-align: right; ${borderStyle}">
            ${val}
          </td>
        </tr>
      `;
    }

    return `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
          ${title}
        </h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          ${rowsHtml}
        </table>
      </div>
    `;
  }
}
