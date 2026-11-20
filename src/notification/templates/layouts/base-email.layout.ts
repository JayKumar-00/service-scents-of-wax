import { HeaderPartial } from '../partials/header.partial';
import { FooterPartial } from '../partials/footer.partial';

export class BaseEmailLayout {
  static render(params: {
    title: string;
    subtitle?: string;
    body: string;
    footerText?: string;
    accentColor?: string;
    eyebrow?: string;
  }) {
    const accentColor = params.accentColor || '#1a1a2e';

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${params.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
</style>
</head>

<body style="margin:0;padding:0;background-color:#f8fafc;color:#1e293b;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">

<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="padding:40px 16px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0"
  style="background-color:#ffffff;margin:0 auto;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 15px -3px rgba(0,0,0,0.05),0 4px 6px -4px rgba(0,0,0,0.05);">

  <!-- Accent Top Bar -->
  <tr>
    <td style="background-color:${accentColor};height:6px;line-height:6px;font-size:1px;">&nbsp;</td>
  </tr>

  ${HeaderPartial.render(accentColor)}

  <!-- Header Info / Title -->
  <tr>
    <td align="center" style="padding:32px 40px 24px;border-bottom:1px solid #f1f5f9;">
      ${
        params.eyebrow
          ? `
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#f1f5f9;color:#64748b;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:16px;">
          ${params.eyebrow}
        </div>
      `
          : ''
      }

      <h1 style="margin:0;color:#0f172a;font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-0.02em;">
        ${params.title}
      </h1>

      ${
        params.subtitle
          ? `
        <p style="margin:8px 0 0;color:#64748b;font-size:14px;font-weight:500;">
          ${params.subtitle}
        </p>
      `
          : ''
      }
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:40px;background-color:#ffffff;">
      <div style="font-size:15px;line-height:1.6;color:#334155;text-align:left;">
        ${params.body}
      </div>
    </td>
  </tr>

  ${FooterPartial.render({ footerText: params.footerText, accentColor })}

</table>

</td>
</tr>
</table>

</body>
</html>
`;
  }
}

