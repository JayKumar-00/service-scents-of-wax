import {
  ReportColumn,
  ReportSummaryCard,
} from '../interfaces/report.interface';
import * as fs from 'fs';
import * as path from 'path';

export class HtmlExporter {
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
        path.join(
          __dirname,
          '..',
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
    } catch (error) {
      this.logoBase64 = '';
    }
    return this.logoBase64;
  }

  public static export(params: {
    title: string;
    columns: ReportColumn[];
    records: any[];
    summary: Record<string, ReportSummaryCard>;
    filters: Record<string, any>;
    generatedBy: string;
  }): string {
    const { title, columns, records, summary, filters, generatedBy } = params;
    const logoData = this.getLogoBase64();
    const logoHtml = logoData
      ? `<img src="data:image/png;base64,${logoData}" alt="UnBoxIO Logo" class="company-logo-img">`
      : `<div class="company-logo">UB</div>`;
    const generatedDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Generate KPI Cards HTML
    const kpiCardsHtml = Object.values(summary)
      .map((kpi) => {
        let displayVal = kpi.value;
        if (kpi.type === 'currency') {
          const num =
            typeof kpi.value === 'number'
              ? kpi.value
              : parseFloat(String(kpi.value));
          displayVal = isNaN(num)
            ? '₹0.00'
            : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        } else if (kpi.type === 'percentage') {
          displayVal = `${kpi.value}%`;
        } else if (kpi.type === 'number') {
          const num =
            typeof kpi.value === 'number'
              ? kpi.value
              : parseFloat(String(kpi.value));
          displayVal = isNaN(num) ? '0' : num.toLocaleString('en-IN');
        }

        return `
          <div class="kpi-card">
            <div class="kpi-label">${this.escape(kpi.label)}</div>
            <div class="kpi-value">${this.escape(displayVal)}</div>
            ${kpi.description ? `<div class="kpi-desc">${this.escape(kpi.description)}</div>` : ''}
          </div>
        `;
      })
      .join('');

    // Generate Active Filters HTML
    const activeFiltersList = Object.entries(filters)
      .filter(([_, val]) => val !== undefined && val !== null && val !== '')
      .map(([key, val]) => {
        const formattedKey = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase());
        return `<span class="filter-badge"><strong>${this.escape(formattedKey)}:</strong> ${this.escape(val)}</span>`;
      });

    const filtersHtml = activeFiltersList.length
      ? `
        <div class="filters-applied-box">
          <div class="filters-title">Active Filters:</div>
          <div class="filters-list">${activeFiltersList.join('')}</div>
        </div>
      `
      : '';

    // Generate Table Headers HTML
    const tableHeadersHtml = columns
      .map((col) => `<th>${this.escape(col.label)}</th>`)
      .join('');

    // Generate Table Rows HTML
    const tableRowsHtml = records
      .map((rec) => {
        const rowCells = columns
          .map((col) => {
            const val = rec[col.name];
            let cellContent = '';

            if (col.type === 'currency') {
              const num =
                typeof val === 'number' ? val : parseFloat(String(val));
              cellContent = isNaN(num)
                ? '₹0.00'
                : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
            } else if (col.type === 'date') {
              cellContent = val
                ? new Date(val).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'N/A';
            } else if (col.type === 'status') {
              const statusStr = String(val).toUpperCase();
              let badgeClass = 'status-default';
              if (
                [
                  'DELIVERED',
                  'COMPLETED',
                  'ACTIVE',
                  'PAID',
                  'APPROVED',
                  'SUCCESS',
                  'IN_STOCK',
                ].includes(statusStr)
              ) {
                badgeClass = 'status-success';
              } else if (
                [
                  'PENDING',
                  'PROCESSING',
                  'SCHEDULED',
                  'UNPAID',
                  'LOW_STOCK',
                  'IN_TRANSIT',
                  'OUT_FOR_DELIVERY',
                ].includes(statusStr)
              ) {
                badgeClass = 'status-warning';
              } else if (
                [
                  'CANCELLED',
                  'FAILED',
                  'OUT_OF_STOCK',
                  'REJECTED',
                  'BLOCKED',
                  'FROZEN',
                ].includes(statusStr)
              ) {
                badgeClass = 'status-danger';
              }
              cellContent = `<span class="status-badge ${badgeClass}">${this.escape(val)}</span>`;
            } else {
              cellContent = this.escape(val);
            }

            return `<td>${cellContent}</td>`;
          })
          .join('');

        return `<tr>${rowCells}</tr>`;
      })
      .join('');

    return `
<!DOCTYPE html>
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
      line-height: 1.5;
      font-size: 13px;
    }
    
    .report-container {
      max-width: 280mm;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
      padding: 40px;
    }
    
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 25px;
      margin-bottom: 30px;
    }
    
    .company-branding {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .company-logo-img {
      height: 60px;
      width: auto;
      object-fit: contain;
      display: block;
    }

    .company-info-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    
    .company-name {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin: 0;
    }
    
    .report-title {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin: 0;
    }
    
    .meta-box {
      text-align: right;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    
    .meta-box strong {
      color: #334155;
    }
    
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: #e11d48;
      border-radius: 4px 0 0 4px;
    }
    
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(225, 29, 72, 0.04);
      border-color: #fca5a5;
    }
    
    .kpi-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748b;
      margin-bottom: 4px;
    }
    
    .kpi-value {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    
    .kpi-desc {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
    }
    
    /* Filters Applied Box */
    .filters-applied-box {
      background: #fff5f5;
      border: 1px solid #fee2e2;
      border-radius: 8px;
      padding: 10px 16px;
      margin-bottom: 25px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .filters-title {
      font-size: 10px;
      font-weight: 700;
      color: #be123c;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    
    .filters-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .filter-badge {
      background: #ffffff;
      border: 1px solid #fecaca;
      color: #be123c;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
    }
    
    /* Data Table */
    .table-container {
      width: 100%;
      overflow-x: auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    
    .data-table th {
      background-color: #0f172a;
      color: #ffffff;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 14px 16px;
      border-bottom: 1px solid #0f172a;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      font-size: 13px;
    }
    
    .data-table tr:last-child td {
      border-bottom: none;
    }
    
    .data-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    
    .data-table tr:hover {
      background-color: #f1f5f9;
    }
    
    /* Status Badges */
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-success {
      background-color: #dcfce7;
      color: #15803d;
    }
    
    .status-warning {
      background-color: #fef9c3;
      color: #a16207;
    }
    
    .status-danger {
      background-color: #fee2e2;
      color: #b91c1c;
    }
    
    .status-default {
      background-color: #e2e8f0;
      color: #475569;
    }
    
    /* Footer */
    .report-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #cbd5e1;
      padding-top: 20px;
      font-size: 12px;
      color: #64748b;
    }
    
    /* Print Utility */
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .report-container {
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .kpi-card {
        background: none !important;
        border: 1px solid #cbd5e1 !important;
        page-break-inside: avoid;
      }
      .data-table th {
        background-color: #f1f5f9 !important;
        color: #0f172a !important;
        border-bottom: 2px solid #0f172a;
      }
      .data-table td {
        border-bottom: 1px solid #cbd5e1;
      }
      .data-table tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <div class="report-container">
    
    <!-- Report Header -->
    <div class="report-header">
      <div class="company-branding">
        ${logoHtml}
        <div class="company-info-text">
          <div class="company-name">UnBoxIO ERP</div>
          <div class="report-title">${this.escape(title)}</div>
        </div>
      </div>
      <div class="meta-box">
        <div>Generated By: <strong>${this.escape(generatedBy)}</strong></div>
        <div>Generated On: <strong>${generatedDate}</strong></div>
      </div>
    </div>
    
    <!-- KPI Summary Section -->
    <div class="kpi-grid">
      ${kpiCardsHtml}
    </div>
    
    <!-- Active Filters Section -->
    ${filtersHtml}
    
    <!-- Records Data Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            ${tableHeadersHtml}
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
    
    <!-- Report Footer -->
    <div class="report-footer">
      <div>Generated by ERP System</div>
      <div>UnBoxIO Premium Reporting Module</div>
    </div>
    
  </div>

</body>
</html>
    `;
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
}
