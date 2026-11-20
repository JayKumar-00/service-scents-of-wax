import {
  InvoiceViewModel,
  AddressSnapshot,
} from '../interfaces/invoice.interface';
import * as fs from 'fs';
import * as path from 'path';

export class InvoiceHtmlBuilder {
  private static logoBase64: string | null = null;

  private static getLogoBase64(): string {
    if (this.logoBase64 !== null) return this.logoBase64;
    try {
      // Try multiple possible paths to locate the assets folder safely regardless of the execution environment (src vs dist)
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
        console.warn(
          'GiftFactoryLogo.png not found. Tried paths:',
          possiblePaths,
        );
        this.logoBase64 = '';
      }
    } catch (error) {
      console.warn('Error reading GiftFactoryLogo.png from assets:', error);
      this.logoBase64 = '';
    }
    return this.logoBase64;
  }

  /**
   * Safe HTML escaping function to prevent XSS injection.
   */
  private static escape(value: any): string {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private static formatCurrency(
    amount: number | string | null | undefined,
  ): string {
    if (amount == null) return '₹0.00';
    const num =
      typeof amount === 'number' ? amount : parseFloat(String(amount));
    return isNaN(num) ? '₹0.00' : `₹${num.toFixed(2)}`;
  }

  private static formatAddress(addr?: AddressSnapshot | null): string {
    if (!addr) return 'N/A';
    const parts = [
      addr.fullName ? `<strong>${this.escape(addr.fullName)}</strong>` : '',
      addr.phone ? `Phone: ${this.escape(addr.phone)}` : '',
      addr.addressLine1 ? this.escape(addr.addressLine1) : '',
      addr.addressLine2 ? this.escape(addr.addressLine2) : '',
      addr.landmark ? `Landmark: ${this.escape(addr.landmark)}` : '',
      [addr.city, addr.state, addr.zipCode]
        .filter(Boolean)
        .map((x) => this.escape(x))
        .join(', '),
      addr.country ? this.escape(addr.country) : 'India',
    ].filter(Boolean);
    return parts.join('<br>');
  }

  public static build(
    invoice: InvoiceViewModel,
    options?: { autoPrint?: boolean },
  ): string {
    const invoiceNumber = this.escape(invoice.invoiceNumber);
    const dateStr = invoice.issuedAt
      ? new Date(invoice.issuedAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      : 'N/A';
    const orderDateStr = invoice.orderDate
      ? new Date(invoice.orderDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      : 'N/A';
    const placeOfSupply = this.escape(
      invoice.placeOfSupply || invoice.shippingAddress?.state || 'N/A',
    );

    // 1. Gather Seller/Company Information (Pickup Address represents Seller for stock requests or platform)
    const sellerName = this.escape(invoice.storeName || 'UnBoxIO');
    const rawSellerName = invoice.storeName || 'UnBoxIO';
    const initials =
      rawSellerName
        .split(/\s+/)
        .map((word) => word[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'GF';
    const sellerGstin = this.escape(invoice.sellerGstin || '22AAAAA0000A1Z5'); // Placeholder for platform/seller GSTIN
    const buyerGstin = this.escape(invoice.buyerGstin || 'N/A');

    const logoData = this.getLogoBase64();
    const sellerHeaderHtml = logoData
      ? `
        <div style="display: flex; align-items: center; justify-content: flex-start; margin-bottom: 5px;">
          <img class="company-logo" src="data:image/png;base64,${logoData}" alt="UnBoxIO Logo" style="width: 420px; max-width: 100%; height: auto; max-height: 130px; object-fit: contain; object-position: left; display: block;">
        </div>
      `
      : `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; letter-spacing: -0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${initials}</div>
          <div>
            <div class="company-title" style="margin: 0; line-height: 1.1;">${sellerName}</div>
            <div class="company-gst" style="margin-top: 3px;">GSTIN: ${sellerGstin}</div>
          </div>
        </div>
      `;

    // Determine GST splitting (CGST + SGST vs IGST)
    // Intra-state standard: if Place of Supply matches Seller/Store State (defaults to Chhattisgarh where Central Hub is located)
    const sellerState = invoice.pickupAddress?.state || 'Chhattisgarh';
    const isIntraState =
      invoice.isInterState !== undefined
        ? !invoice.isInterState
        : placeOfSupply.toLowerCase().trim() ===
        sellerState.toLowerCase().trim();

    // 2. Build Item Rows & Calculate GST Breakdown Slabs
    let itemRows = '';
    const gstSlabs: Record<
      number,
      { taxableValue: number; gstAmount: number }
    > = {};

    (invoice.items || []).forEach((item, index) => {
      const qty = item.quantity || 1;
      const rate = Number(item.unitPrice) || 0;
      const discount = Number(item.discount || 0);
      const gstRate = Number(item.gstRate) || 0;

      // In the database, the item total / totalAmount represents the tax-inclusive price.
      // If taxableAmount was stored identical to rate * qty - discount (which is tax-inclusive),
      // we need to back out the GST so that Rate, Taxable Value, GST Amount, and Total are mathematically consistent.
      const lineTotal = Number(item.totalAmount) || (qty * rate - discount);
      let lineTaxable = Number(item.taxableAmount) || (qty * rate - discount);
      let lineGst = (lineTaxable * gstRate) / 100;

      // If taxable value + GST does not sum to the line total, or if taxable value matches line total (meaning it is inclusive of GST)
      if (Math.abs(lineTaxable + lineGst - lineTotal) > 0.05 || lineTaxable === lineTotal) {
        // Back out the tax:
        lineGst = (lineTotal * gstRate) / 100;
        lineTaxable = lineTotal - lineGst;
      }

      // Displayed rate (exclusive of GST)
      const displayRate = (lineTaxable + discount) / qty;

      // Accumulate for GST Summary Table
      if (!gstSlabs[gstRate]) {
        gstSlabs[gstRate] = { taxableValue: 0, gstAmount: 0 };
      }
      gstSlabs[gstRate].taxableValue += lineTaxable;
      gstSlabs[gstRate].gstAmount += lineGst;

      itemRows += `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td class="text-left">
            <div class="product-title">${this.escape(item.title)}</div>
          </td>
          <!-- <td class="text-center">${this.escape(item.hsnCode || 'N/A')}</td> -->
          <td class="text-center">${qty}</td>
          <td class="text-right">${this.formatCurrency(displayRate)}</td>
          <td class="text-right">${this.formatCurrency(discount)}</td>
          <td class="text-right">${this.formatCurrency(lineTaxable)}</td>
          <td class="text-center">${gstRate}%</td>
          <td class="text-right">${this.formatCurrency(lineGst)}</td>
          <td class="text-right">${this.formatCurrency(lineTotal)}</td>
        </tr>
      `;
    });

    // 3. Build GST Summary Breakdown rows
    let gstSummaryRows = '';
    let totalTaxableFromSlabs = 0;
    let totalGstFromSlabs = 0;

    Object.entries(gstSlabs).forEach(([rateStr, slab]) => {
      const rate = parseFloat(rateStr);
      const cgstRate = rate / 2;
      const sgstRate = rate / 2;

      totalTaxableFromSlabs += slab.taxableValue;
      totalGstFromSlabs += slab.gstAmount;

      if (isIntraState) {
        // CGST + SGST split
        gstSummaryRows += `
          <tr>
            <td class="text-left">GST ${rate}%</td>
            <td class="text-right">${this.formatCurrency(slab.taxableValue)}</td>
            <td class="text-center">${cgstRate}%</td>
            <td class="text-right">${this.formatCurrency(slab.gstAmount / 2)}</td>
            <td class="text-center">${sgstRate}%</td>
            <td class="text-right">${this.formatCurrency(slab.gstAmount / 2)}</td>
            <td class="text-center">0%</td>
            <td class="text-right">${this.formatCurrency(0)}</td>
            <td class="text-right">${this.formatCurrency(slab.gstAmount)}</td>
          </tr>
        `;
      } else {
        // IGST only
        gstSummaryRows += `
          <tr>
            <td class="text-left">GST ${rate}%</td>
            <td class="text-right">${this.formatCurrency(slab.taxableValue)}</td>
            <td class="text-center">0%</td>
            <td class="text-right">${this.formatCurrency(0)}</td>
            <td class="text-center">0%</td>
            <td class="text-right">${this.formatCurrency(0)}</td>
            <td class="text-center">${rate}%</td>
            <td class="text-right">${this.formatCurrency(slab.gstAmount)}</td>
            <td class="text-right">${this.formatCurrency(slab.gstAmount)}</td>
          </tr>
        `;
      }
    });

    // 4. Shipment details card html
    let shipmentSectionHtml = '';
    if (invoice.courierName || invoice.awb || invoice.shipmentProvider) {
      shipmentSectionHtml = `
        <div class="section-card">
          <div class="section-header">Shipment & Delivery Details</div>
          <table class="info-table">
            <tr>
              <td><strong>Courier Partner:</strong> ${this.escape(invoice.courierName || 'N/A')}</td>
              <td><strong>AWB / Tracking Number:</strong> ${this.escape(invoice.awb || 'N/A')}</td>
            </tr>
            <tr>
              <td><strong>Shipment Provider:</strong> ${this.escape(invoice.shipmentProvider || 'N/A')}</td>
              <td>
                <strong>Tracking Link:</strong> 
                ${invoice.trackingUrl ? `<a href="${this.escape(invoice.trackingUrl)}" target="_blank" class="tracking-link">${this.escape(invoice.trackingUrl)}</a>` : 'N/A'}
              </td>
            </tr>
          </table>
        </div>
      `;
    }

    // 5. Payment details card html
    const pMethod = this.escape(invoice.shipmentPaymentMode || 'N/A');
    const pStatus = this.escape(invoice.paymentStatus || 'PENDING');
    const pRef = this.escape(invoice.paymentReferenceId || 'N/A');

    const formatDateUnique = (date: any): string => {
      if (!date) return 'N/A';
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    };

    const paidTimeStr = invoice.paidAt
      ? formatDateUnique(invoice.paidAt)
      : (pStatus === 'PAID' ? formatDateUnique(invoice.issuedAt || new Date()) : 'N/A');

    const referenceTimeStr = invoice.issuedAt
      ? formatDateUnique(invoice.issuedAt)
      : formatDateUnique(new Date());

    // Theme values (slate corporate theme)
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice #${invoiceNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* Premium Global Styles */
    
    * {
      box-sizing: border-box;
    }
    
    body {
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 40px 20px;
      line-height: 1.5;
      font-size: 13px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    
    .invoice-container {
      max-width: 210mm; /* Fit inside standard A4 width */
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
      padding: 40px;
    }
    
    /* Toolbar for Browser Print */
    .print-toolbar {
      max-width: 210mm;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }
    
    .print-btn {
      background-color: #1e293b;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s;
    }
    
    .print-btn:hover {
      background-color: #334155;
    }

    /* Header Section */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      table-layout: fixed;
    }
    
    .header-table td {
      padding: 0;
      vertical-align: top;
    }
    
    .company-title {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      letter-spacing: -0.5px;
      margin: 0 0 5px 0;
    }
    
    .company-gst {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    
    .invoice-title {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: right;
      margin: 0 0 5px 0;
    }
    
    .meta-details {
      text-align: right;
      color: #475569;
      font-size: 11.5px;
    }
    
    .meta-details td {
      padding: 2px 0;
    }
    
    .meta-label {
      font-weight: 600;
      color: #64748b;
      text-align: right;
      padding-right: 10px !important;
      white-space: nowrap;
    }
    
    .meta-value {
      font-weight: 500;
      color: #1e293b;
      text-align: left;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Section Cards */
    .section-card {
      border: 1px solid #f1f5f9;
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 25px;
    }
    
    .section-header {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    /* Address Grid */
    .address-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    
    .address-table td {
      width: 33.33%;
      padding: 0 15px 0 0;
      vertical-align: top;
      font-size: 12px;
      line-height: 1.6;
      color: #334155;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .address-table td:last-child {
      padding-right: 0;
    }

    /* General Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      table-layout: fixed;
    }
    
    .data-table th {
      background-color: #1e293b;
      color: #ffffff;
      font-weight: 600;
      font-size: 9.5px;
      text-transform: none;
      letter-spacing: 0.5px;
      padding: 8px 4px;
      border: none;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .data-table td {
      padding: 8px 4px;
      border: none;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
      color: #334155;
      font-size: 9.5px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .data-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    
    .product-title {
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 3px;
    }
    
    .product-sku {
      font-size: 11px;
      color: #64748b;
    }

    /* Info Table inside cards */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    
    .info-table td {
      padding: 6px 0;
      vertical-align: top;
      font-size: 12px;
      color: #334155;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Summary Section */
    .summary-container {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    
    .payment-box {
      width: 48%;
    }
    
    .totals-box {
      width: 45%;
    }
    
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    
    .totals-table td {
      padding: 6px 0;
      font-size: 12px;
    }
    
    .totals-label {
      color: #64748b;
      font-weight: 500;
      text-align: left;
    }
    
    .totals-value {
      font-weight: 600;
      color: #1e293b;
      text-align: right;
    }
    
    .grand-total-row td {
      border-top: 2px solid #e2e8f0;
      padding-top: 12px;
    }
    
    .grand-total-label {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    
    .grand-total-value {
      font-size: 15px;
      font-weight: 800;
      color: #1e293b;
    }

    .text-left {
      text-align: left !important;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }

    .tracking-link {
      color: #3b82f6;
      text-decoration: none;
      word-break: break-all;
    }
    
    .tracking-link:hover {
      text-decoration: underline;
    }

    /* Footer Notes */
    .footer-notes {
      text-align: center;
      border-top: 1px dashed #cbd5e1;
      padding-top: 25px;
      margin-top: 35px;
      font-size: 12px;
      color: #64748b;
    }
    
    .footer-notes p {
      margin: 3px 0;
    }

    /* Print styling definitions */
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 15mm;
      }
      
      body {
        background-color: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        color: #000000 !important;
        font-size: 11px !important;
        overflow-x: hidden !important;
      }
      
      .invoice-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      
      .print-toolbar {
        display: none !important;
      }
      
      .company-logo {
        max-height: 95px !important;
        width: auto !important;
      }
      
      .header-table {
        margin-bottom: 10px !important;
      }
      
      .meta-details {
        font-size: 9.5px !important;
      }
      
      .meta-details td {
        padding: 1px 0 !important;
      }
      
      .invoice-title {
        font-size: 20px !important;
        margin-bottom: 2px !important;
      }
      
      .section-card {
        background: none !important;
        border: 1px solid #cbd5e1 !important;
        padding: 10px !important;
        margin-bottom: 10px !important;
      }
      
      .data-table {
        margin-bottom: 12px !important;
      }
      
      .data-table th {
        background-color: #f1f5f9 !important;
        color: #000000 !important;
        border: none !important;
        border-bottom: 2px solid #cbd5e1 !important;
        font-size: 8.5px !important;
        padding: 6px 3px !important;
        text-transform: none !important;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      
      .data-table td {
        border: none !important;
        border-bottom: 1px solid #cbd5e1 !important;
        padding: 6px 3px !important;
        font-size: 8.5px !important;
        vertical-align: middle !important;
      }
      
      .data-table tr:nth-child(even) {
        background-color: transparent !important;
      }
      
      .summary-container {
        margin-bottom: 10px !important;
      }
      
      .info-table td {
        font-size: 9.5px !important;
        padding: 4px 0 !important;
      }
      
      .totals-table td {
        font-size: 9.5px !important;
        padding: 4px 0 !important;
      }
      
      .grand-total-row td {
        border-top: 2px solid #000000 !important;
        padding-top: 8px !important;
      }
      
      .grand-total-label {
        font-size: 11px !important;
      }
      
      .grand-total-value {
        font-size: 12px !important;
      }
      
      .hide-on-print {
        display: none !important;
      }

      table { 
        page-break-inside: auto; 
        break-inside: auto;
      }
      
      tr { 
        page-break-inside: avoid !important; 
        break-inside: avoid !important;
        page-break-after: auto; 
        break-after: auto;
      }
      
      thead { 
        display: table-header-group; 
      }
      
      .section-card, .summary-container, .footer-notes { 
        page-break-inside: avoid !important; 
        break-inside: avoid !important;
      }
      
      .footer-notes {
        margin-top: 10px !important;
        padding-top: 10px !important;
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
      <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
      </svg>
      Print Invoice
    </button>
  </div>

  <div class="invoice-container">
    <!-- Header Block -->
    <table class="header-table">
      <tr>
        <td style="width: 50%; vertical-align: middle;">
          ${sellerHeaderHtml}
        </td>
        <td style="width: 50%;">
          <div class="invoice-title">Tax Invoice</div>
          <table align="right" class="meta-details" style="width: 100%; table-layout: fixed;">
            <tr>
              <td class="meta-label" style="width: 35%;">Invoice Number:</td>
              <td class="meta-value" style="width: 65%;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td class="meta-label" style="width: 35%;">Issue Date:</td>
              <td class="meta-value" style="width: 65%;">${dateStr}</td>
            </tr>
            <tr>
              <td class="meta-label" style="width: 35%;">Order Number:</td>
              <td class="meta-value" style="width: 65%;">${this.escape(invoice.shipmentOrderId || 'N/A')}</td>
            </tr>
            <tr>
              <td class="meta-label" style="width: 35%;">Order Date:</td>
              <td class="meta-value" style="width: 65%;">${orderDateStr}</td>
            </tr>
            <tr>
              <td class="meta-label" style="width: 35%;">Place of Supply:</td>
              <td class="meta-value" style="width: 65%;">${placeOfSupply}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Addresses section -->
    <div class="section-card">
      <div class="section-header">Address Details</div>
      <table class="address-table">
        <tr>
          <td>
            <div style="font-weight: 600; color: #475569; margin-bottom: 6px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Billed To (Customer)</div>
            ${this.formatAddress(invoice.billingAddress)}
            ${buyerGstin !== 'N/A' ? `<br><strong>GSTIN:</strong> ${buyerGstin}` : ''}
          </td>
          <td>
            <div style="font-weight: 600; color: #475569; margin-bottom: 6px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Shipped To (Delivery)</div>
            ${this.formatAddress(invoice.shippingAddress)}
          </td>
          <td>
            <div style="font-weight: 600; color: #475569; margin-bottom: 6px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Dispatched From (Seller Pickup)</div>
            ${this.formatAddress(invoice.pickupAddress)}
          </td>
        </tr>
      </table>
    </div>

    <!-- Items table -->
    <div class="section-card">
      <div class="section-header">Line Items</div>
      <table class="data-table" style="margin-bottom: 0;">
        <thead>
          <tr>
            <th class="text-center" style="width: 3%;">#</th>
            <th class="text-left" style="width: 22%;">Item Description</th>
            <!-- <th class="text-center" style="width: 8%;">HSN</th> -->
            <th class="text-center" style="width: 4%;">Qty</th>
            <th class="text-right" style="width: 10%;">Rate</th>
            <th class="text-right" style="width: 8%;">Discount</th>
            <th class="text-right" style="width: 13%;">Taxable Value</th>
            <th class="text-center" style="width: 6%;">GST %</th>
            <th class="text-right" style="width: 12%;">GST Amount</th>
            <th class="text-right" style="width: 16%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <!-- GST slab breakdown -->
    <div class="section-card">
      <div class="section-header">GST Tax Split Details</div>
      <table class="data-table" style="margin-bottom: 0;">
        <thead>
          <tr>
            <th class="text-left" style="width: 10%;">GST Slab</th>
            <th class="text-right" style="width: 16%;">Taxable Value</th>
            <th class="text-center" style="width: 7%;">CGST %</th>
            <th class="text-right" style="width: 11%;">CGST Amt</th>
            <th class="text-center" style="width: 7%;">SGST %</th>
            <th class="text-right" style="width: 11%;">SGST Amt</th>
            <th class="text-center" style="width: 7%;">IGST %</th>
            <th class="text-right" style="width: 11%;">IGST Amt</th>
            <th class="text-right" style="width: 14%;">Total Tax</th>
          </tr>
        </thead>
        <tbody>
          ${gstSummaryRows}
          <tr style="font-weight: bold; background-color: #f1f5f9;">
            <td class="text-left">Total</td>
            <td class="text-right">${this.formatCurrency(totalTaxableFromSlabs)}</td>
            <td colspan="2"></td>
            <td colspan="2"></td>
            <td colspan="2"></td>
            <td class="text-right">${this.formatCurrency(totalGstFromSlabs)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Shipment section -->
    ${shipmentSectionHtml}

    <!-- Totals and payment details -->
    <div class="summary-container">
      <div class="payment-box">
        <div class="section-card" style="height: 100%; margin-bottom: 0;">
          <div class="section-header">Payment Status</div>
          <table class="info-table">
            <tr>
              <td style="width: 40%;"><strong>Payment Method:</strong></td>
              <td><span style="font-weight: 600; color: #334155;">${pMethod}</span></td>
            </tr>
            <tr>
              <td><strong>Payment Status:</strong></td>
              <td>
                <span style="
                  display: inline-block;
                  padding: 3px 8px;
                  font-size: 10px;
                  font-weight: 700;
                  border-radius: 12px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  ${pStatus === 'PAID'
        ? 'background-color: #d1fae5; color: #065f46;'
        : 'background-color: #fef3c7; color: #92400e;'}
                ">${pStatus}</span>
              </td>
            </tr>
            <tr>
              <td><strong>Txn / Gateway Ref:</strong></td>
              <td style="word-break: break-all; font-family: monospace; font-size: 11px; color: #475569;">${pRef}</td>
            </tr>
            <tr>
              <td><strong>Paid Time:</strong></td>
              <td style="color: #475569;">${paidTimeStr}</td>
            </tr>
            <tr>
              <td><strong>Reference Time:</strong></td>
              <td style="color: #475569;">${referenceTimeStr}</td>
            </tr>
          </table>
        </div>
      </div>
      
      <div class="totals-box">
        <div class="section-card" style="height: 100%; margin-bottom: 0;">
          <div class="section-header">Invoice Summary</div>
          <table class="totals-table">
            <tr>
              <td class="totals-label" style="width: 70%;">Subtotal (Before Tax)</td>
              <td class="totals-value" style="width: 30%;">${this.formatCurrency(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td class="totals-label">Discount</td>
              <td class="totals-value">-${this.formatCurrency(invoice.discountAmount)}</td>
            </tr>
            <tr>
              <td class="totals-label">Shipping & Handling</td>
              <td class="totals-value">${this.formatCurrency(invoice.shippingFee)}</td>
            </tr>
            <tr>
              <td class="totals-label">Convenience / Platform Fee</td>
              <td class="totals-value">${this.formatCurrency(invoice.platformFee)}</td>
            </tr>
            <tr>
              <td class="totals-label">Total GST Tax</td>
              <td class="totals-value">${this.formatCurrency(invoice.gst)}</td>
            </tr>
            <tr class="grand-total-row">
              <td class="totals-label grand-total-label">Grand Total</td>
              <td class="totals-value grand-total-value">${this.formatCurrency(invoice.grandTotal)}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>

    <!-- Footer block -->
    <div class="footer-notes">
      <p>Whether you're shopping for yourself or sending a gift, thank you for choosing <strong>UnBoxIO</strong>!</p>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 10px;">This is a computer-generated tax invoice. No signature is required.</p>
    </div>
  </div>

  ${options?.autoPrint
        ? `
  <script type="text/javascript">
    window.onload = function() {
      // Trigger browser print dialog automatically
      window.print();
    };
  </script>
  `
        : ''
      }
</body>
</html>
    `;
  }
}
