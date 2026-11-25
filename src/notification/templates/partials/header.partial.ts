import * as fs from 'fs';
import * as path from 'path';

export class HeaderPartial {
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

  static render(accentColor: string = '#4f46e5') {
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
      ? `<img src="${logoSrc}" alt="ScentsOfWax Logo" style="height: 36px; max-height: 36px; width: auto; display: block;" />`
      : `<span style="font-size: 20px; font-weight: 800; color: ${accentColor}; letter-spacing: -0.02em;">ScentsOfWax</span>`;

    return `
      <!-- Header Logo Row -->
      <tr>
        <td style="padding: 24px 40px 20px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td align="left" style="vertical-align: middle;">
                ${logoHtml}
              </td>
              <td align="right" style="vertical-align: middle; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-family: 'Inter', sans-serif;">
                Corporate Gifting
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }
}
