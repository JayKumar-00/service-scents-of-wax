import * as fs from 'fs';
import * as path from 'path';

export class FooterPartial {
  private static logoBase64: string | null = null;

  private static getLogoBase64(): string {
    if (this.logoBase64 !== null) return this.logoBase64;
    try {
      const possiblePaths = [
        path.join(process.cwd(), 'assets', 'GiftFactoryLogo.png'),
        path.join(__dirname, '..', '..', '..', '..', 'assets', 'GiftFactoryLogo.png'),
        path.join(__dirname, '..', '..', '..', 'assets', 'GiftFactoryLogo.png'),
        path.join(__dirname, '..', '..', 'assets', 'GiftFactoryLogo.png'),
      ];

      const validPath = possiblePaths.find((p) => fs.existsSync(p));
      if (validPath) {
        this.logoBase64 = fs.readFileSync(validPath, 'base64');
      } else {
        this.logoBase64 = '';
      }
    } catch (error) {
      this.logoBase64 = '';
    }
    return this.logoBase64;
  }

  static render(params: { footerText?: string; accentColor?: string }) {
    const platformName = process.env.PLATFORM_NAME || 'ScentsOfWax';
    const year = new Date().getFullYear();
    const awsPrefix = process.env.AWS_PREFIX_URL;
    const defaultLogoUrl = awsPrefix
      ? `${awsPrefix.replace(/\/$/, '')}/assets/GiftFactoryLogo.png`
      : null;
    const logoUrl = process.env.LOGO_URL || "https://d3ori68ve27vyu.cloudfront.net/assets/GiftFactoryLogo.png" || defaultLogoUrl;
    let logoSrc = '';

    if (logoUrl) {
      logoSrc = logoUrl;
    } else {
      const logoData = this.getLogoBase64();
      if (logoData) {
        logoSrc = `data:image/png;base64,${logoData}`;
      }
    }

    const logoHtml = logoSrc
      ? `<img src="${logoSrc}" alt="${platformName} Logo" style="height: 20px; max-height: 20px; width: auto; opacity: 0.65; display: block; margin-bottom: 12px;" />`
      : `<span style="font-size: 13px; font-weight: 700; color: #475569; display: block; margin-bottom: 8px;">${platformName}</span>`;

    return `
      <!-- Footer Logo Row -->
      <tr>
        <td align="center" style="background-color: #f8fafc; padding: 32px 40px; border-top: 1px solid #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; text-align: center;">
            <tr>
              <td align="center" style="padding-bottom: 4px;">
                <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    <td align="center">
                      ${logoHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size: 12px; line-height: 1.5; color: #64748b; font-family: 'Inter', sans-serif;">
                <p style="margin: 0 0 12px; max-width: 480px; margin-left: auto; margin-right: auto;">
                  ${params.footerText || 'This is an automated message. Please do not reply directly to this email.'}
                </p>
                <p style="margin: 0; font-size: 11px; color: #94a3b8; letter-spacing: 0.02em;">
                  © ${year} ${platformName}. All Rights Reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }
}
