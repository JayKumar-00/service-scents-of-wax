export class OtpBoxPartial {
  static render(otp: string, validMinutes = 10, accentColor = '#6d28d9') {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0; border-collapse: collapse;">
        <tr>
          <td align="center">
            <div style="
              display: inline-block;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-left: 4px solid ${accentColor};
              border-radius: 8px;
              padding: 20px 40px;
              text-align: center;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
            ">
              <span style="
                font-family: 'Courier New', Courier, monospace, sans-serif;
                font-size: 32px;
                font-weight: 700;
                color: #0f172a;
                letter-spacing: 8px;
                line-height: 1;
              ">${otp}</span>
            </div>
            <p style="margin: 12px 0 0; font-size: 13px; color: #64748b; font-family: 'Inter', 'Segoe UI', Arial, sans-serif;">
              This code is valid for <strong style="color: #0f172a;">${validMinutes} minutes</strong>
            </p>
          </td>
        </tr>
      </table>
    `;
  }
}
