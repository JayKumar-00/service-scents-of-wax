import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtUser } from '../../../auth/types/jwt-user.type';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { ProcessRefundDto, FailRefundDto } from '../dto/process-refund.dto';
import { RefundExtensionService } from '../services/refund-extension.service';
import { PdfGenerator } from '../../../common/utils/pdf-generator.util';
import { QueryDto } from '../../../common/dto/query.dto';

@ApiTags('Returns Financial - Refunds')
@ApiBearerAuth('access-token')
@Controller('refunds')
export class RefundController {
  constructor(private readonly refundService: RefundExtensionService) {}

  @Post()
  @ApiOperation({
    summary: 'Initiate a refund request (sets status to PENDING)',
  })
  @ApiCreatedResponse({ description: 'Refund initiated successfully' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_OWNER)
  async createRefund(
    @Body() dto: CreateRefundDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.refundService.createRefund(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List all refund requests',
  })
  @ApiOkResponse({ description: 'List of refunds retrieved successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_AUDITOR,
  )
  async listRefunds(@Query() query: QueryDto, @CurrentUser() user: JwtUser) {
    return this.refundService.listRefunds(query, user);
  }

  @Get(':returnNumber')
  @ApiOperation({
    summary: 'Get details of a single refund request',
  })
  @ApiOkResponse({ description: 'Refund details retrieved successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_AUDITOR,
  )
  async getRefund(
    @Param('returnNumber') returnNumber: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.refundService.getRefund(returnNumber, user);
  }

  @Patch(':id/process')
  @ApiOperation({
    summary:
      'Process / Complete a pending refund request (sets status to PROCESSED, generates REFUND_RECEIPT)',
  })
  @ApiOkResponse({ description: 'Refund processed successfully' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  async processRefund(
    @Param('id') id: string,
    @Body() dto: ProcessRefundDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.refundService.processRefund(id, dto, user);
  }

  @Patch(':id/fail')
  @ApiOperation({
    summary: 'Mark a pending refund request as FAILED',
  })
  @ApiOkResponse({ description: 'Refund marked as FAILED' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  async failRefund(@Param('id') id: string, @Body() dto: FailRefundDto) {
    return this.refundService.failRefund(id, dto);
  }

  @Get(':id/receipt')
  @ApiOperation({
    summary: 'Get the JSON refund receipt for a processed refund',
  })
  @ApiOkResponse({ description: 'Refund receipt retrieved successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_AUDITOR,
  )
  async getRefundReceipt(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.refundService.getRefundReceipt(id, user);
  }

  @Get(':id/receipt/pdf')
  @ApiOperation({
    summary: 'Download the PDF refund receipt for a processed refund',
  })
  @ApiOkResponse({ description: 'PDF Refund receipt download initiated' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_AUDITOR,
  )
  async downloadRefundReceiptPdf(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: JwtUser,
  ) {
    const receipt = await this.refundService.getRefundReceipt(id, user);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Refund Receipt - ${receipt.invoiceNumber}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; }
          .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #d9534f; }
          .details { margin-bottom: 30px; }
          .details table { width: 100%; }
          .details td { padding: 5px 0; }
          .items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .items th { background: #f8f8f8; text-align: left; padding: 10px; border-bottom: 2px solid #eee; }
          .items td { padding: 10px; border-bottom: 1px solid #eee; }
          .footer { text-align: center; color: #aaa; font-size: 12px; margin-top: 50px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>REFUND RECEIPT</h1>
          <p>Receipt # ${receipt.invoiceNumber}</p>
        </div>
        <div class="details">
          <table>
            <tr>
              <td><strong>Customer Name:</strong> ${receipt.buyerName || 'N/A'}</td>
              <td style="text-align: right;"><strong>Date:</strong> ${new Date(receipt.issuedAt).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td><strong>Phone:</strong> ${receipt.buyerPhone || 'N/A'}</td>
              <td style="text-align: right;"><strong>Store:</strong> ${receipt.storeName || 'N/A'}</td>
            </tr>
          </table>
        </div>
        <table class="items">
          <thead>
            <tr>
              <th>Refund Reference</th>
              <th>Method</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(receipt.items as any[])
              .map(
                (item) => `
              <tr>
                <td>Refund #${item.refundNumber || 'N/A'} (Ref: ${item.refundReferenceId || 'N/A'})</td>
                <td>${item.refundMethod || 'N/A'}</td>
                <td style="text-align: right;">₹${item.refundAmount ? item.refundAmount.toFixed(2) : '0.00'}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
        <div style="text-align: right; font-size: 18px;">
          <strong>Total Refunded: ₹${receipt.grandTotal ? Number(receipt.grandTotal).toFixed(2) : '0.00'}</strong>
        </div>
        <div class="footer">
          <p>Thank you for shopping with UnBoxIO.</p>
        </div>
      </body>
      </html>
    `;

    const pdfBuffer = await this.generatePdfFromHtml(htmlContent);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="RefundReceipt-${receipt.invoiceNumber}.pdf"`,
    );
    return res.send(pdfBuffer);
  }

  private async generatePdfFromHtml(html: string): Promise<Buffer> {
    return PdfGenerator.generateFromHtml(html, { noHeaderFooter: true });
  }
}
