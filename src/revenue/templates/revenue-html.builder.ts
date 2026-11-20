import { RevenueResponseDto } from '../dto/revenue-response.dto';
import * as fs from 'fs';
import * as path from 'path';

export class RevenueHtmlBuilder {
  private static logoBase64: string | null = null;

  private static getLogoBase64(): string {
    if (this.logoBase64 !== null) return this.logoBase64;
    try {
      const possiblePaths = [
        path.join(process.cwd(), 'assets', 'GiftFactoryLogo.png'),
        path.join(__dirname, '..', '..', '..', 'assets', 'GiftFactoryLogo.png'),
        path.join(
          __dirname,
          '..',
          '..',
          '..',
          '..',
          'assets',
          'GiftFactoryLogo.png',
        ),
      ];

      const validPath = possiblePaths.find((p) => fs.existsSync(p));
      if (validPath) {
        this.logoBase64 = fs.readFileSync(validPath, 'base64');
      } else {
        this.logoBase64 = '';
      }
    } catch {
      this.logoBase64 = '';
    }
    return this.logoBase64;
  }

  private static escape(value: any): string {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private static formatCurrency(amount: number | string | null | undefined): string {
    if (amount == null) return '₹0.00';
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(num)) return '₹0.00';
    return `₹${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private static formatDateRange(startStr?: string, endStr?: string): string {
    if (!startStr || !endStr) return 'N/A';
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const formatSingle = (d: Date) => {
      const day = d.getDate();
      const month = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear();
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const mins = String(d.getUTCMinutes()).padStart(2, '0');
      return `${day} ${month} ${year} ${hours}:${mins} UTC`;
    };

    return `${formatSingle(startDate)} → ${formatSingle(endDate)}`;
  }

  private static formatGraphLabel(label: string): string {
    if (!label) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
      const parts = label.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const month = d.toLocaleString('en-US', { month: 'short' });
      return `${month} ${d.getDate()}`;
    }
    return label;
  }

  public static build(
    data: RevenueResponseDto,
    options?: { isFranchiseView?: boolean; autoPrint?: boolean },
  ): string {
    const isFranchise = options?.isFranchiseView ?? (data.franchiseId != null);
    const title = isFranchise ? 'FRANCHISE REVENUE REPORT' : 'ADMIN REVENUE REPORT';
    const subtitle = isFranchise
      ? 'UnBoxIO • Franchise financial performance summary'
      : 'UnBoxIO • Admin financial performance summary';
    const footerLabel = isFranchise
      ? 'UnBoxIO • Franchise Financial Report'
      : 'UnBoxIO • Admin Financial Report';

    const periodStr = (data.period || 'DAY').toUpperCase();
    const franchiseCodeOrIdStr = data.franchiseCode || data.franchiseId || 'All Franchises';
    const reportWindowStr = this.formatDateRange(data.startDate, data.endDate);

    const overallRev = data.overallRevenue ?? data.overAllRevanure ?? 0;
    const supplierPay = data.supplierPayments ?? data.SupplierPayments ?? 0;
    const customerOrders = data.customerOrderRevenues ?? data.CustomerOrderRevenues ?? 0;
    const posRev = data.posRevenue ?? data.POSRevanue ?? 0;
    const onlineRev = data.onlineCustomerRevenue ?? data.OnlineCustomerRevanue ?? 0;

    const logoData = this.getLogoBase64();
    const logoHtml = logoData
      ? `<img src="data:image/png;base64,${logoData}" alt="UnBoxIO Logo" class="brand-logo-img">`
      : `<div class="brand-logo-fallback">UnBoxIO</div>`;

    // SVG Line Graph Construction
    const graphPoints = data.graphData || [];
    const chartWidth = 700;
    const chartHeight = 220;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    const plotW = chartWidth - paddingLeft - paddingRight;
    const plotH = chartHeight - paddingTop - paddingBottom;

    // Find Max Y
    let maxY = 0;
    graphPoints.forEach((pt) => {
      const o = pt.overallRevenue ?? pt.overAllRevanure ?? 0;
      const c = pt.customerOrderRevenues ?? pt.CustomerOrderRevenues ?? 0;
      if (o > maxY) maxY = o;
      if (c > maxY) maxY = c;
    });

    if (maxY === 0) maxY = 1000;
    const rawStep = maxY / 5;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const step = Math.ceil(rawStep / magnitude) * magnitude;
    const scaledMaxY = step * 6 || 1000;

    // Generate Y-axis grid ticks
    const yTicks: { yPx: number; val: number }[] = [];
    for (let i = 0; i <= 5; i++) {
      const val = Math.round((scaledMaxY / 5) * i);
      const yPx = paddingTop + plotH - (val / scaledMaxY) * plotH;
      yTicks.push({ yPx, val });
    }

    // Build coordinates
    const numPoints = graphPoints.length;
    const pointCoords = graphPoints.map((pt, idx) => {
      const xPx =
        numPoints > 1
          ? paddingLeft + (idx / (numPoints - 1)) * plotW
          : paddingLeft + plotW / 2;

      const o = pt.overallRevenue ?? pt.overAllRevanure ?? 0;
      const c = pt.customerOrderRevenues ?? pt.CustomerOrderRevenues ?? 0;

      const yO = paddingTop + plotH - (o / scaledMaxY) * plotH;
      const yC = paddingTop + plotH - (c / scaledMaxY) * plotH;

      const displayLabel = this.formatGraphLabel(pt.label);

      return { xPx, yO, yC, label: displayLabel };
    });

    // Polyline paths
    const pathOverall = pointCoords.map((p) => `${p.xPx},${p.yO}`).join(' ');
    const pathCustomer = pointCoords.map((p) => `${p.xPx},${p.yC}`).join(' ');

    // SVG Ticks HTML
    const yTicksSvg = yTicks
      .map(
        (t) => `
        <line x1="${paddingLeft}" y1="${t.yPx}" x2="${chartWidth - paddingRight}" y2="${t.yPx}" stroke="#e2e8f0" stroke-width="1" />
        <text x="${paddingLeft - 8}" y="${t.yPx + 4}" text-anchor="end" font-size="10" fill="#64748b">${t.val.toLocaleString('en-IN')}</text>
      `,
      )
      .join('');

    const xTicksSvg = pointCoords
      .map(
        (p) => `
        <text x="${p.xPx}" y="${chartHeight - 12}" text-anchor="middle" font-size="10" fill="#64748b">${this.escape(p.label)}</text>
      `,
      )
      .join('');

    const pointsSvg = pointCoords
      .map(
        (p) => `
        <circle cx="${p.xPx}" cy="${p.yO}" r="3" fill="#2563eb" />
        <circle cx="${p.xPx}" cy="${p.yC}" r="3" fill="#d97706" />
      `,
      )
      .join('');

    // Table rows & total sums
    let totalOverall = 0;
    let totalSupplier = 0;
    let totalCustomer = 0;
    let totalRefunds = 0;
    let totalPos = 0;
    let totalOnline = 0;

    const tableRowsHtml = graphPoints
      .map((pt) => {
        const o = pt.overallRevenue ?? pt.overAllRevanure ?? 0;
        const sup = pt.supplierPayments ?? pt.SupplierPayments ?? 0;
        const c = pt.customerOrderRevenues ?? pt.CustomerOrderRevenues ?? 0;
        const ref = pt.refundLosses ?? pt.RefundLosses ?? 0;
        const pos = pt.posRevenue ?? pt.POSRevanue ?? 0;
        const onl = pt.onlineCustomerRevenue ?? pt.OnlineCustomerRevanue ?? 0;

        totalOverall += o;
        totalSupplier += sup;
        totalCustomer += c;
        totalRefunds += ref;
        totalPos += pos;
        totalOnline += onl;

        const formattedDate = this.formatGraphLabel(pt.label);

        return `
          <tr>
            <td class="col-date">${this.escape(formattedDate)}</td>
            <td class="col-num">${this.formatCurrency(o)}</td>
            <td class="col-num">${this.formatCurrency(sup)}</td>
            <td class="col-num">${this.formatCurrency(c)}</td>
            <td class="col-num">${this.formatCurrency(ref)}</td>
            <td class="col-num">${this.formatCurrency(pos)}</td>
            <td class="col-num">${this.formatCurrency(onl)}</td>
          </tr>
        `;
      })
      .join('');

    const autoPrintScript = options?.autoPrint
      ? `<script>window.addEventListener('load', function() { window.print(); });</script>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${this.escape(title)}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      background-color: #f8fafc;
      color: #0f172a;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px 20px;
      line-height: 1.4;
      font-size: 12px;
    }

    /* Print toolbar */
    .print-toolbar {
      max-width: 280mm;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }

    .print-btn {
      background-color: #0f2942;
      color: #ffffff;
      border: none;
      padding: 9px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: background-color 0.2s;
    }

    .print-btn:hover {
      background-color: #1a365d;
    }

    .report-container {
      max-width: 280mm;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
      padding: 35px 40px;
    }

    /* Top Branding & Main Title */
    .brand-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .brand-logo-img {
      height: 45px;
      width: auto;
      object-fit: contain;
    }

    .brand-logo-fallback {
      font-size: 20px;
      font-weight: 800;
      color: #0f2942;
      letter-spacing: -0.5px;
    }

    .doc-main-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f2942;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 0;
      text-align: center;
      flex-grow: 1;
    }

    .period-badge {
      text-align: right;
      font-size: 10px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .period-badge .period-val {
      font-size: 13px;
      font-weight: 800;
      color: #0f2942;
      display: block;
      margin-top: 1px;
    }

    .doc-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 18px;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 8px;
    }

    /* Metadata Panel */
    .metadata-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 30px;
      margin-bottom: 22px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 11px;
    }

    .meta-item .meta-lbl {
      font-weight: 700;
      color: #334155;
      white-space: nowrap;
    }

    .meta-item .meta-val {
      color: #475569;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 3px 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 28px;
    }

    .kpi-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      background: #ffffff;
    }

    .kpi-lbl {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .kpi-val {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
      white-space: nowrap;
    }

    /* Section Headings */
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px 0;
    }

    /* Graph Section */
    .graph-container-flex {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 8px;
    }

    .graph-svg-wrapper {
      flex: 1;
      overflow: hidden;
    }

    .graph-legend-box {
      width: 170px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-left: 10px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
    }

    .legend-color {
      width: 14px;
      height: 14px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .graph-caption {
      font-size: 10px;
      color: #94a3b8;
      margin-bottom: 28px;
    }

    /* Data Table */
    .data-table-container {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .data-table th {
      background-color: #0f2942;
      color: #ffffff;
      font-weight: 700;
      font-size: 10.5px;
      padding: 10px 12px;
      border: 1px solid #0f2942;
    }

    .data-table th.col-num,
    .data-table td.col-num {
      text-align: right;
    }

    .data-table th.col-date,
    .data-table td.col-date {
      text-align: left;
      font-weight: 600;
    }

    .data-table td {
      padding: 9px 12px;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 11px;
    }

    .data-table tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    .data-table tr.total-row td {
      background-color: #0f2942;
      color: #ffffff;
      font-weight: 800;
      border-color: #0f2942;
      font-size: 11px;
    }

    /* Footer Notes */
    .notes-section {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 25px;
    }

    .notes-section strong {
      color: #475569;
    }

    .doc-footer-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      font-size: 10px;
      color: #94a3b8;
    }

    /* Print utility styles */
    @media print {
      @page {
        size: A4 landscape;
        margin: 8mm 10mm;
      }

      body {
        background-color: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .print-toolbar {
        display: none !important;
      }

      .report-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }

      .kpi-grid {
        grid-template-columns: repeat(5, 1fr) !important;
      }

      .kpi-box {
        border: 1px solid #cbd5e1 !important;
      }

      .data-table th {
        background-color: #0f2942 !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .data-table tr.total-row td {
        background-color: #0f2942 !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>

  <!-- Print Toolbar (Hidden during print) -->
  <div class="print-toolbar">
    <button onclick="window.print()" class="print-btn">
      <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
      </svg>
      Print / Download PDF
    </button>
  </div>

  <div class="report-container">
    
    <!-- Top Header -->
    <div class="brand-top-row">
      <div style="width: 180px;">${logoHtml}</div>
      <h1 class="doc-main-title">${this.escape(title)}</h1>
      <div class="period-badge">
        PERIOD
        <span class="period-val">${this.escape(periodStr)}</span>
      </div>
    </div>

    <div class="doc-subtitle">${this.escape(subtitle)}</div>

    <!-- Metadata Card -->
    <div class="metadata-card">
      <div class="meta-item">
        <span class="meta-lbl">Franchise Code</span>
        <span class="meta-val">${this.escape(franchiseCodeOrIdStr)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">Report Window</span>
        <span style="color: #334155; font-size: 11px;">${this.escape(reportWindowStr)}</span>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-lbl">OVERALL REVENUE</div>
        <div class="kpi-val">${this.formatCurrency(overallRev)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">SUPPLIER PAYMENTS</div>
        <div class="kpi-val">${this.formatCurrency(supplierPay)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">CUSTOMER ORDERS</div>
        <div class="kpi-val">${this.formatCurrency(customerOrders)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">POS REVENUE</div>
        <div class="kpi-val">${this.formatCurrency(posRev)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">ONLINE REVENUE</div>
        <div class="kpi-val">${this.formatCurrency(onlineRev)}</div>
      </div>
    </div>

    <!-- Revenue Trend Chart -->
    <div class="section-title">Revenue Trend</div>
    <div class="graph-container-flex">
      <div class="graph-svg-wrapper">
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%; height: auto; display: block;">
          ${yTicksSvg}
          ${xTicksSvg}
          <polyline points="${pathOverall}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <polyline points="${pathCustomer}" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          ${pointsSvg}
        </svg>
      </div>

      <div class="graph-legend-box">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #2563eb;"></div>
          <span>Overall Revenue</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #d97706;"></div>
          <span>Customer Orders</span>
        </div>
      </div>
    </div>
    <div class="graph-caption">Dynamic trend generated from all daily graphData points supplied by the API.</div>

    <!-- Daily Revenue Breakdown Table -->
    <div class="section-title">Daily Revenue Breakdown</div>
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-date">Date</th>
            <th class="col-num">Overall</th>
            <th class="col-num">Supplier Payments</th>
            <th class="col-num">Customer Orders</th>
            <th class="col-num">Refunds</th>
            <th class="col-num">POS</th>
            <th class="col-num">Online</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          <tr class="total-row">
            <td class="col-date">TOTAL</td>
            <td class="col-num">${this.formatCurrency(overallRev || totalOverall)}</td>
            <td class="col-num">${this.formatCurrency(supplierPay || totalSupplier)}</td>
            <td class="col-num">${this.formatCurrency(customerOrders || totalCustomer)}</td>
            <td class="col-num">${this.formatCurrency(data.refundLosses ?? data.RefundLosses ?? totalRefunds)}</td>
            <td class="col-num">${this.formatCurrency(posRev || totalPos)}</td>
            <td class="col-num">${this.formatCurrency(onlineRev || totalOnline)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Notes & Footer -->
    <div class="notes-section">
      <strong>Notes:</strong> Amounts are shown in INR. Legacy duplicate API field names were normalized to their corresponding camelCase financial fields.
    </div>

    <div class="doc-footer-bar">
      <div>${this.escape(footerLabel)}</div>
      <div>Page 1</div>
    </div>

  </div>

  ${autoPrintScript}
</body>
</html>`;
  }
}
