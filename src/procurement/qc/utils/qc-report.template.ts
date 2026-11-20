export interface QcReportData {
  reportType?: 'BASIC' | 'COMPLETE';
  poNumber: string;
  poStatus?: string;
  poTime?: string;
  expectedDeliveryDate?: string;
  currency?: string;
  totalAmount?: string | number;
  notes?: string;
  reportNumber?: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  supplierGst?: string;
  poDate?: string;
  reportDate: string;
  warehouseName?: string;
  warehouseAddress?: string;
  poLines?: Array<{
    productName: string;
    variantName?: string;
    orderedQty: number;
    unitCost: number | string;
    lineTotal: number | string;
  }>;
  asns?: Array<{
    asnNumber: string;
    status: string;
    supplierInvoiceNo?: string;
    vehicleNumber?: string;
    courier?: string;
    trackingNumber?: string;
    expectedArrival?: string;
    shipmentNote?: string;
    createdAt?: string;
    lines: Array<{
      productName: string;
      variantName?: string;
      expectedQty: number;
    }>;
  }>;
  grns?: Array<{
    grnNumber: string;
    status: string;
    asnNumber?: string;
    warehouseName?: string;
    createdAt?: string;
    lines: Array<{
      productName: string;
      variantName?: string;
      receivedQty: number;
      acceptedQty: number;
      damagedQty: number;
      rejectedQty: number;
      notes?: string;
    }>;
  }>;
  inspections: Array<{
    grnNumber: string;
    productName: string;
    variantName?: string;
    receivedQty: number;
    acceptedQty: number;
    damagedQty: number;
    rejectedQty: number;
    status: string;
    qcTime?: string;
    notes: string;
  }>;
}

export function generateQcReportHtml(data: QcReportData): string {
  const isComplete = data.reportType === 'COMPLETE';

  const escapeHtml = (unsafe: string) => {
    return (unsafe || '').replace(/[&<"'>]/g, function (m) {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#039;';
        default: return m;
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const upper = (status || '').toUpperCase();
    switch (upper) {
      case 'PASSED':
      case 'APPROVED':
      case 'RECEIVED':
      case 'ARRIVED':
      case 'POSTED':
      case 'COMPLETED':
        return `<span class="badge badge-success">${escapeHtml(upper)}</span>`;
      case 'FAILED':
      case 'REJECTED':
      case 'CANCELLED':
      case 'REVERSED':
        return `<span class="badge badge-error">${escapeHtml(upper)}</span>`;
      case 'PARTIAL':
      case 'PENDING':
      case 'DRAFT':
      case 'IN_TRANSIT':
      case 'SUBMITTED':
      case 'SENT':
      case 'PENDING_APPROVAL':
        return `<span class="badge badge-warning">${escapeHtml(upper)}</span>`;
      default:
        return `<span class="badge badge-neutral">${escapeHtml(upper || 'N/A')}</span>`;
    }
  };

  const cleanRemarks = (rawNotes?: string | null) => {
    if (!rawNotes) return '-';
    let str = String(rawNotes).trim();
    if (!str) return '-';
    str = str.replace(/Auto-generated QC inspection for line\s+[a-z0-9_]{10,40}\s+of GRN\s+([A-Z0-9_-]+)/gi, 'Auto-generated QC inspection');
    str = str.replace(/for line\s+[a-z0-9_]{10,40}\s+of GRN\s+([A-Z0-9_-]+)/gi, 'for GRN $1');
    str = str.replace(/for line\s+[a-z0-9_]{10,40}/gi, '');
    str = str.replace(/\b[a-z0-9]{20,35}\b/gi, '');
    str = str.replace(/\s+/g, ' ').trim();
    if (!str || str === 'for' || str === 'of' || str === 'for GRN') {
      return 'Auto-generated QC inspection';
    }
    return str;
  };

  const totalReceived = data.inspections.reduce((sum, item) => sum + (item.receivedQty || 0), 0);
  const totalAccepted = data.inspections.reduce((sum, item) => sum + (item.acceptedQty || 0), 0);
  const totalDamaged = data.inspections.reduce((sum, item) => sum + (item.damagedQty || 0), 0);
  const totalRejected = data.inspections.reduce((sum, item) => sum + (item.rejectedQty || 0), 0);

  const hasFailed = data.inspections.some(i => i.status === 'FAILED');
  const hasPartial = data.inspections.some(i => i.status === 'PARTIAL' || i.status === 'PENDING');
  const overallStatus = data.inspections.length === 0 ? 'N/A' : (hasFailed ? 'FAILED' : (hasPartial ? 'PENDING / PARTIAL' : 'PASSED'));
  const passRate = totalReceived > 0 ? Math.round((totalAccepted / totalReceived) * 100) : 100;

  const qcRows = data.inspections.map((item, index) => {
    const pName = (item.productName || '').trim();
    const vName = item.variantName ? item.variantName.trim().toUpperCase() : '';
    const itemName = vName ? `${pName} (${vName})` : pName;
    return `
      <tr>
        <td class="text-center font-medium">${index + 1}</td>
        <td class="text-left font-semibold">${escapeHtml(item.grnNumber)}</td>
        <td class="text-left"><div class="product-title">${escapeHtml(itemName)}</div></td>
        <td class="text-right font-medium">${item.receivedQty}</td>
        <td class="text-right text-success font-semibold">${item.acceptedQty}</td>
        <td class="text-right text-warning font-semibold">${item.damagedQty}</td>
        <td class="text-right text-error font-semibold">${item.rejectedQty}</td>
        <td class="text-center">${getStatusBadge(item.status)}</td>
        <td class="text-left text-muted remark-cell">${escapeHtml(cleanRemarks(item.notes))}</td>
      </tr>
    `;
  }).join('');

  // SECTION 1: PO Lines HTML
  const poLinesRows = (data.poLines || []).map((item, index) => {
    const pName = (item.productName || '').trim();
    const vName = item.variantName ? item.variantName.trim().toUpperCase() : '';
    const itemName = vName ? `${pName} (${vName})` : pName;
    return `
      <tr>
        <td class="text-center font-medium">${index + 1}</td>
        <td class="text-left"><div class="product-title">${escapeHtml(itemName)}</div></td>
        <td class="text-right font-semibold">${item.orderedQty}</td>
        <td class="text-right font-medium">₹${Number(item.unitCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right font-semibold">₹${Number(item.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `;
  }).join('');

  // SECTION 2: ASN HTML
  const asnBlocks = (data.asns || []).map((asn) => {
    const lineRows = (asn.lines || []).map((line, lIdx) => {
      const pName = (line.productName || '').trim();
      const vName = line.variantName ? line.variantName.trim().toUpperCase() : '';
      const itemName = vName ? `${pName} (${vName})` : pName;
      return `
        <tr>
          <td class="text-center font-medium">${lIdx + 1}</td>
          <td class="text-left"><div class="product-title">${escapeHtml(itemName)}</div></td>
          <td class="text-right font-semibold">${line.expectedQty}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: #fafafa; box-sizing: border-box; width: 100%; overflow: hidden;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <strong style="font-size: 11px; color: #0f172a;">ASN #${escapeHtml(asn.asnNumber)}</strong>
            <span style="margin-left: 8px;">${getStatusBadge(asn.status)}</span>
          </div>
          <div style="font-size: 10px; font-weight: 600; color: #0f172a; background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">
            ASN Time: ${escapeHtml(asn.createdAt || 'N/A')}
          </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 9.5px; color: #475569; margin-bottom: 6px;">
          <div><strong>Created/Dispatched:</strong> ${escapeHtml(asn.createdAt || 'N/A')}</div>
          ${asn.supplierInvoiceNo ? `<div><strong>Invoice No:</strong> ${escapeHtml(asn.supplierInvoiceNo)}</div>` : ''}
          ${asn.vehicleNumber ? `<div><strong>Vehicle No:</strong> ${escapeHtml(asn.vehicleNumber)}</div>` : ''}
          ${asn.courier ? `<div><strong>Courier:</strong> ${escapeHtml(asn.courier)}</div>` : ''}
          ${asn.trackingNumber ? `<div><strong>Tracking #:</strong> ${escapeHtml(asn.trackingNumber)}</div>` : ''}
          ${asn.expectedArrival ? `<div><strong>Expected Arrival:</strong> ${escapeHtml(asn.expectedArrival)}</div>` : ''}
        </div>
        ${asn.shipmentNote ? `<div style="font-size: 9.5px; color: #64748b; margin-bottom: 6px;"><em>Notes: ${escapeHtml(cleanRemarks(asn.shipmentNote))}</em></div>` : ''}
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 8%;">#</th>
              <th class="text-left" style="width: 72%;">Item Description</th>
              <th class="text-right" style="width: 20%;">Expected Qty</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows || '<tr><td colspan="3" class="text-center text-muted" style="padding: 6px;">No ASN line items logged.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  // SECTION 3: GRN HTML
  const grnBlocks = (data.grns || []).map((grn) => {
    const lineRows = (grn.lines || []).map((line, lIdx) => {
      const pName = (line.productName || '').trim();
      const vName = line.variantName ? line.variantName.trim().toUpperCase() : '';
      const itemName = vName ? `${pName} (${vName})` : pName;
      return `
        <tr>
          <td class="text-center font-medium">${lIdx + 1}</td>
          <td class="text-left"><div class="product-title">${escapeHtml(itemName)}</div></td>
          <td class="text-right font-medium">${line.receivedQty}</td>
          <td class="text-right text-success font-semibold">${line.acceptedQty}</td>
          <td class="text-right text-warning font-semibold">${line.damagedQty}</td>
          <td class="text-right text-error font-semibold">${line.rejectedQty}</td>
          <td class="text-left text-muted remark-cell">${escapeHtml(cleanRemarks(line.notes))}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: #fafafa; box-sizing: border-box; width: 100%; overflow: hidden;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <strong style="font-size: 11px; color: #0f172a;">GRN #${escapeHtml(grn.grnNumber)}</strong>
            <span style="margin-left: 8px;">${getStatusBadge(grn.status)}</span>
          </div>
          <div style="font-size: 10px; font-weight: 600; color: #0f172a; background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">
            GRN Time: ${escapeHtml(grn.createdAt || 'N/A')}
          </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 9.5px; color: #475569; margin-bottom: 6px;">
          <div><strong>Receipt Time:</strong> ${escapeHtml(grn.createdAt || 'N/A')}</div>
          ${grn.asnNumber ? `<div><strong>Ref ASN #:</strong> ${escapeHtml(grn.asnNumber)}</div>` : ''}
          ${grn.warehouseName ? `<div><strong>Warehouse Node:</strong> ${escapeHtml(grn.warehouseName)}</div>` : ''}
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 5%;">#</th>
              <th class="text-left" style="width: 31%;">Item Description</th>
              <th class="text-right" style="width: 10%;">Received</th>
              <th class="text-right" style="width: 10%;">Accepted</th>
              <th class="text-right" style="width: 10%;">Damaged</th>
              <th class="text-right" style="width: 10%;">Rejected</th>
              <th class="text-left" style="width: 24%;">Line Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows || '<tr><td colspan="7" class="text-center text-muted" style="padding: 6px;">No GRN line items logged.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  const reportNo = data.reportNumber || `QCR-${data.poNumber.replace(/^PO-?/, '')}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QC Report - ${escapeHtml(data.poNumber)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    
    body {
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 15px;
      line-height: 1.35;
      font-size: 11px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      padding: 24px 28px;
    }
    
    /* Toolbar for Browser Print */
    .print-toolbar {
      max-width: 210mm;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }
    
    .print-btn {
      background-color: #0f172a;
      color: #ffffff;
      border: none;
      padding: 7px 14px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .print-btn:hover { background-color: #1e293b; transform: translateY(-1px); }

    /* Header Section */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      table-layout: fixed;
    }
    .header-table td { padding: 0; vertical-align: top; }
    
    .logo-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .logo-box {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(225, 29, 72, 0.2);
    }

    .logo-box svg {
      width: 20px;
      height: 20px;
    }
    
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
      letter-spacing: -0.5px;
    }

    .brand-title span {
      color: #e11d48;
    }

    .brand-tagline {
      font-size: 10px;
      color: #64748b;
      font-weight: 500;
      margin-top: 1px;
    }
    
    .doc-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: right;
      margin: 0 0 4px 0;
    }
    
    .meta-details { text-align: right; color: #475569; font-size: 10.5px; margin-left: auto; }
    .meta-details td { padding: 1px 0; }
    .meta-label { font-weight: 600; color: #64748b; text-align: right; padding-right: 10px !important; white-space: nowrap; }
    .meta-value { font-weight: 600; color: #0f172a; text-align: left; word-wrap: break-word; }

    /* Section Cards */
    .section-card {
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 12px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .dashed-box {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
      background: #fafafa;
      box-sizing: border-box;
      width: 100%;
      overflow: hidden;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    
    .card-header-title {
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: 4px;
      margin-bottom: 8px;
      border-bottom: 1.5px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .details-grid {
      display: table;
      width: 100%;
      table-layout: fixed;
    }

    .details-col {
      display: table-cell;
      vertical-align: top;
      padding-right: 12px;
    }

    .details-col:last-child {
      padding-right: 0;
    }

    .col-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 3px;
      letter-spacing: 0.03em;
    }

    .entity-name {
      font-size: 11.5px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .entity-info {
      font-size: 10px;
      color: #475569;
      line-height: 1.35;
    }

    /* General Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
      table-layout: fixed;
      box-sizing: border-box;
    }
    .data-table th {
      background-color: #f8fafc;
      color: #475569;
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 6px 4px;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #cbd5e1;
      box-sizing: border-box;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .data-table td {
      padding: 6px 4px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
      color: #334155;
      font-size: 10px;
      box-sizing: border-box;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .data-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .data-table tr:nth-child(even) { background-color: #fafafa; }
    
    .product-title { font-weight: 600; color: #0f172a; font-size: 10.5px; }

    .remark-cell {
      word-wrap: break-word !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      font-size: 9.5px !important;
      padding-right: 8px !important;
      color: #64748b !important;
    }

    .text-left { text-align: left !important; }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    
    .font-semibold { font-weight: 600 !important; }
    .font-medium { font-weight: 500 !important; }
    
    .text-success { color: #059669 !important; }
    .text-warning { color: #d97706 !important; }
    .text-error { color: #dc2626 !important; }
    .text-muted { color: #64748b !important; }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 9999px;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .badge-success { background-color: #d1fae5; color: #065f46; }
    .badge-error { background-color: #fee2e2; color: #991b1b; }
    .badge-warning { background-color: #fef3c7; color: #92400e; }
    .badge-neutral { background-color: #f3f4f6; color: #374151; }

    /* Bottom Summary Grid */
    .summary-grid {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 16px;
      margin-top: 12px;
      width: 100%;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .summary-col {
      flex: 1;
      min-width: 0;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .summary-col-spacer {
      display: none;
    }

    .summary-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      background: #ffffff;
      height: 100%;
      box-sizing: border-box;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .summary-table td {
      padding: 3px 0;
      color: #475569;
    }

    .summary-table td.val {
      text-align: right;
      font-weight: 600;
      color: #0f172a;
    }

    .summary-table tr.total-row td {
      border-top: 1.5px solid #0f172a;
      padding-top: 5px;
      font-weight: 800;
      font-size: 11px;
      color: #0f172a;
    }

    /* Footer Notes */
    .footer-notes {
      text-align: center;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      margin-top: 12px;
      font-size: 9.5px;
      color: #64748b;
      line-height: 1.35;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* Print styling definitions */
    @media print {
      @page { size: A4 portrait; margin: 6mm 8mm; }
      html, body { background-color: #ffffff !important; padding: 0 !important; margin: 0 !important; }
      .invoice-container { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
      .print-toolbar { display: none !important; }
      .section-card, .dashed-box, .summary-grid, .summary-box, .footer-notes, tr, tbody {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .data-table th { background-color: #f8fafc !important; color: #475569 !important; border-bottom: 1.5px solid #cbd5e1 !important; }
      .data-table tr:nth-child(even) { background-color: transparent !important; }
      .badge-success { border: 1px solid #065f46 !important; }
      .badge-error { border: 1px solid #991b1b !important; }
      .badge-warning { border: 1px solid #92400e !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>

  <!-- Print Toolbar (Hidden during print) -->
  <div class="print-toolbar">
    <button onclick="window.print()" class="print-btn">
      <svg style="width:15px;height:15px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
      </svg>
      Print / Save as PDF
    </button>
  </div>

  <div class="invoice-container">
    <!-- Header Block -->
    <table class="header-table">
      <tr>
        <td style="width: 50%; vertical-align: middle;">
          <div class="logo-container">
            <div class="logo-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 12 20 22 4 22 4 12"></polyline>
                <rect x="2" y="7" width="20" height="5" rx="1"></rect>
                <line x1="12" y1="22" x2="12" y2="7"></line>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
              </svg>
            </div>
            <div>
              <div class="brand-title">UnBoxIO<span></span></div>
              <div class="brand-tagline">we box happiness</div>
            </div>
          </div>
        </td>
        <td style="width: 50%;">
          <div class="doc-title">${isComplete ? 'PROCUREMENT REPORT' : 'QC REPORT'}</div>
          <table class="meta-details">
            <tr>
              <td class="meta-label">Report Number:</td>
              <td class="meta-value">${escapeHtml(reportNo)}</td>
            </tr>
            <tr>
              <td class="meta-label">Report Type:</td>
              <td class="meta-value"><span class="badge ${isComplete ? 'badge-success' : 'badge-neutral'}">${isComplete ? 'COMPLETE' : 'BASIC'}</span></td>
            </tr>
            <tr>
              <td class="meta-label">Issue Date:</td>
              <td class="meta-value">${escapeHtml(data.reportDate)}</td>
            </tr>
            <tr>
              <td class="meta-label">PO Number:</td>
              <td class="meta-value">${escapeHtml(data.poNumber)}</td>
            </tr>
            <tr>
              <td class="meta-label">PO Date & Time:</td>
              <td class="meta-value">${escapeHtml(data.poTime || data.poDate || 'N/A')}</td>
            </tr>
            ${data.poStatus ? `<tr><td class="meta-label">PO Status:</td><td class="meta-value">${getStatusBadge(data.poStatus)}</td></tr>` : ''}
            <tr>
              <td class="meta-label">Place of Supply:</td>
              <td class="meta-value">Chhattisgarh</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Address & Procurement Details Card -->
    <div class="section-card">
      <div class="card-header-title">ADDRESS & PROCUREMENT DETAILS</div>
      <div class="details-grid">
        <div class="details-col" style="width: 34%;">
          <div class="col-title">BILLED TO (SUPPLIER)</div>
          <div class="entity-name">${escapeHtml(data.supplierName)}</div>
          <div class="entity-info">
            ${data.supplierPhone ? `Phone: ${escapeHtml(data.supplierPhone)}<br>` : ''}
            ${data.supplierEmail ? `Email: ${escapeHtml(data.supplierEmail)}<br>` : ''}
            ${data.supplierAddress ? `${escapeHtml(data.supplierAddress)}<br>` : ''}
            ${data.supplierGst ? `GSTIN: ${escapeHtml(data.supplierGst)}` : ''}
          </div>
        </div>
        <div class="details-col" style="width: 33%;">
          <div class="col-title">SHIPPED TO (DELIVERY)</div>
          <div class="entity-name">UnBoxIO Central Hub</div>
          <div class="entity-info">
            Phone: 7586585698<br>
            Bharti Nagar, Telipara, Chhattisgarh<br>
            495001, India<br>
            Telipara, Chhattisgarh, 495001
          </div>
        </div>
        <div class="details-col" style="width: 33%;">
          <div class="col-title">DISPATCHED FROM (SELLER PICKUP)</div>
          <div class="entity-name">${escapeHtml(data.warehouseName || 'UnBoxIO Central Hub')}</div>
          <div class="entity-info">
            CENTRAL-HUB<br>
            Bilaspur, Chhattisgarh, 495001<br>
            India
          </div>
        </div>
      </div>
    </div>

    ${isComplete ? `
    <!-- SECTION 1: PURCHASE ORDER TIME & DETAILS -->
    <div class="section-card">
      <div class="card-header-title">
        <span>1. PURCHASE ORDER DETAILS & ORDERED ITEMS</span>
        <span>Order Time: ${escapeHtml(data.poTime || data.poDate || 'N/A')}</span>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 10px; color: #475569; margin-bottom: 8px;">
        <div><strong>Status:</strong> ${getStatusBadge(data.poStatus || 'N/A')}</div>
        <div><strong>Expected Delivery:</strong> ${escapeHtml(data.expectedDeliveryDate || 'N/A')}</div>
        <div><strong>Currency:</strong> ${escapeHtml(data.currency || 'INR')}</div>
        ${data.totalAmount ? `<div><strong>Total Amount:</strong> ₹${Number(data.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>` : ''}
      </div>
      ${data.notes ? `<div style="font-size: 9.5px; color: #64748b; margin-bottom: 8px;"><em>PO Notes: ${escapeHtml(data.notes)}</em></div>` : ''}
      <table class="data-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 6%;">#</th>
            <th class="text-left" style="width: 44%;">Item Description</th>
            <th class="text-right" style="width: 15%;">Ordered Qty</th>
            <th class="text-right" style="width: 17%;">Unit Cost</th>
            <th class="text-right" style="width: 18%;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${poLinesRows || '<tr><td colspan="5" class="text-center text-muted" style="padding: 8px;">No line items found for this Purchase Order.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- SECTION 2: ASN REGARDING INFO -->
    <div class="section-card">
      <div class="card-header-title">
        <span>2. ADVANCED SHIPPING NOTICES (ASN)</span>
        <span>Total ASNs: ${data.asns ? data.asns.length : 0}</span>
      </div>
      ${asnBlocks || '<div class="text-center text-muted" style="padding: 10px;">No Advanced Shipping Notices (ASN) found for this Purchase Order.</div>'}
    </div>

    <!-- SECTION 3: GRN INFO -->
    <div class="section-card">
      <div class="card-header-title">
        <span>3. GOODS RECEIPT NOTES (GRN)</span>
        <span>Total GRNs: ${data.grns ? data.grns.length : 0}</span>
      </div>
      ${grnBlocks || '<div class="text-center text-muted" style="padding: 10px;">No Goods Receipt Notes (GRN) found for this Purchase Order.</div>'}
    </div>

    <!-- SECTION 4: QC INSPECTION INFO -->
    <div class="section-card" style="padding: 0; overflow: hidden;">
      <div class="card-header-title" style="padding: 8px 14px; margin: 0; border-bottom: none; border-radius: 8px 8px 0 0;">
        <span>4. QUALITY CONTROL (QC) INSPECTION DETAILS</span>
        <span>QC Time: ${escapeHtml(data.inspections[0]?.qcTime || data.reportDate || 'N/A')}</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 4%;">#</th>
            <th class="text-left" style="width: 14%;">GRN No</th>
            <th class="text-left" style="width: 18%;">Item Description</th>
            <th class="text-right" style="width: 10%;">Received</th>
            <th class="text-right" style="width: 10%;">Accepted</th>
            <th class="text-right" style="width: 10%;">Damaged</th>
            <th class="text-right" style="width: 10%;">Rejected</th>
            <th class="text-center" style="width: 10%;">Status</th>
            <th class="text-left" style="width: 12%;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${qcRows || '<tr><td colspan="10" class="text-center" style="padding: 16px; color: #94a3b8;">No quality inspection records found for this Purchase Order.</td></tr>'}
        </tbody>
      </table>
    </div>
    ` : `
    <!-- BASIC VIEW: LINE ITEMS TABLE SECTION CARD -->
    <div class="section-card" style="padding: 0; overflow: hidden;">
      <div class="card-header-title" style="padding: 8px 14px; margin: 0; border-bottom: none; border-radius: 8px 8px 0 0;">
        <span>LINE ITEMS (QC INSPECTIONS)</span>
        <span>QC Time: ${escapeHtml(data.inspections[0]?.qcTime || data.reportDate || 'N/A')}</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 4%;">#</th>
            <th class="text-left" style="width: 14%;">GRN No</th>
            <th class="text-left" style="width: 18%;">Item Description</th>
            <th class="text-right" style="width: 10%;">Received</th>
            <th class="text-right" style="width: 10%;">Accepted</th>
            <th class="text-right" style="width: 10%;">Damaged</th>
            <th class="text-right" style="width: 10%;">Rejected</th>
            <th class="text-center" style="width: 10%;">Status</th>
            <th class="text-left" style="width: 12%;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${qcRows || '<tr><td colspan="10" class="text-center" style="padding: 16px; color: #94a3b8;">No quality inspection records found for this Purchase Order.</td></tr>'}
        </tbody>
      </table>
    </div>
    `}

    <!-- Bottom Summary Block -->
    <div class="summary-grid">
      <div class="summary-col">
        <div class="summary-box">
          <div class="card-header-title">INSPECTION STATUS</div>
          <table class="summary-table">
            <tr>
              <td>Overall QC Status:</td>
              <td class="val">${getStatusBadge(overallStatus)}</td>
            </tr>
            <tr>
              <td>QC Inspection Time:</td>
              <td class="val">${escapeHtml(data.inspections[0]?.qcTime || data.reportDate || 'N/A')}</td>
            </tr>
            <tr>
              <td>Total Inspections Logged:</td>
              <td class="val">${data.inspections.length}</td>
            </tr>
            <tr>
              <td>Acceptance Rate:</td>
              <td class="val text-success">${passRate}%</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="summary-col-spacer"></div>

      <div class="summary-col">
        <div class="summary-box">
          <div class="card-header-title">QUANTITY SUMMARY</div>
          <table class="summary-table">
            <tr>
              <td>Subtotal Received:</td>
              <td class="val">${totalReceived}</td>
            </tr>
            <tr>
              <td>Accepted Quantity:</td>
              <td class="val text-success">${totalAccepted}</td>
            </tr>
            <tr>
              <td>Damaged Quantity:</td>
              <td class="val text-warning">${totalDamaged}</td>
            </tr>
            <tr>
              <td>Rejected Quantity:</td>
              <td class="val text-error">${totalRejected}</td>
            </tr>
            <tr class="total-row">
              <td>Grand Total Inspected:</td>
              <td class="val">${totalReceived}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>

    <!-- Footer Notes -->
    <div class="footer-notes">
      <p style="margin: 0 0 2px 0; font-weight: 500;">Whether you're shopping for yourself or sending a gift, thank you for choosing <strong>UnBoxIO</strong>!</p>
      <p style="margin: 0; color: #94a3b8; font-size: 9px;">This is a computer-generated quality control report. No physical signature is required.</p>
    </div>
  </div>

</body>
</html>`;
}


