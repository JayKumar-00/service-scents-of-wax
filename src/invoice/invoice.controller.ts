import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoiceService } from './invoice.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Role } from '@prisma/client';
import {
  InvoiceQueryDto,
  SingleInvocieQueryDto,
} from './dto/invoice-query.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { PlatformInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceViewModel } from './interfaces/invoice.interface';
import { InvoiceHtmlBuilder } from './template/invoice-html.builder';
import { PdfGenerator } from '../common/utils/pdf-generator.util';
import { Public } from '../common/decorators/public.decorator';
import * as crypto from 'crypto';

@ApiTags('Invoice <- SuperAdmin, Franchise, Customer')
@ApiBearerAuth('access-token')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}
  @Get()
  @ApiOperation({ summary: 'List invoices with optional filters' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  async findAll(@CurrentUser() user: JwtUser, @Query() query: InvoiceQueryDto) {
    return this.invoiceService.findAll({
      ...query,
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : user.role === Role.FRANCHISE_STAFF
          ? { franchiseId: user.franchiseOwnerId }
          : user.role === Role.CUSTOMER
            ? { customerId: user.customerId }
            : {}),
    });
  }

  @Post()
  @ApiOperation({ summary: 'New invoice generation' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  async upsertInvoice(@Body() dto: PlatformInvoiceDto) {
    return this.invoiceService.generatedInvoice(dto);
  } // We to manage here

  // @Get('generated')
  // @ApiOperation({ summary: 'To get invoice' })
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.ADMIN_STAFF,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_STAFF,
  //   Role.CUSTOMER,
  // )
  // async getInvoices(
  //   @CurrentUser() user: JwtUser,
  //   @Query() query: SingleInvocieQueryDto,
  // ) {
  //   return this.invoiceService.findAll({
  //     ...query,
  //     ...(user.role === Role.FRANCHISE_OWNER
  //       ? { franchiseId: user.franchiseId }
  //       : user.role === Role.FRANCHISE_STAFF
  //         ? { franchiseId: user.franchiseOwnerId }
  //         : user.role === Role.CUSTOMER
  //           ? { customerId: user.customerId }
  //           : {}),
  //   });
  // } // We have to delete and manage here (because of the same findAll method)

  // @Patch(':id')
  // @ApiOperation({ summary: 'Update invoice details' })
  // @Roles(Role.SUPERADMIN, Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  // async update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
  //   return this.invoiceService.update(id, dto);
  // }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an invoice' })
  @Roles(Role.SUPERADMIN, Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  async remove(@Param('id') id: string, @Query('deletedBy') deletedBy: string) {
    if (!deletedBy) {
      throw new NotFoundException(
        'deletedBy query parameter is required for deletion',
      );
    }
    return this.invoiceService.remove(id, deletedBy);
  }

  @Get(':invoiceNumber/download')
  @ApiOperation({ summary: 'Download invoice HTML or send via email' })
  @ApiQuery({
    name: 'view',
    required: false,
    enum: ['CUSTOMER', 'FRANCHISE', 'SUPERADMIN'],
    description:
      'Override invoice view. E.g., Admin can request CUSTOMER view.',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  async downloadInvoice(
    @Param('invoiceNumber') invoiceNumber: string,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('sendEmail') sendEmail?: boolean | string,
    @Query('view') view?: string,
  ) {
    const invoice = await this.invoiceService.getInvoiceByNumber(
      invoiceNumber,
      user,
    );
    const htmlContent = this.buildInvoiceHtml(invoice, user, view, false);
    if (sendEmail === true || String(sendEmail).toLowerCase() === 'true') {
      // TODO: Connect your NotificationService / MailerService here
      return res.json({
        success: true,
        message: 'Invoice email triggered successfully',
        invoiceNumber: invoice.invoiceNumber,
        recipientEmail: invoice.buyerEmail,
      });
    }
    const pdfBuffer = await this.generatePdfFromHtml(htmlContent);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
    );
    return res.send(pdfBuffer);
  }

  @Get(':invoiceNumber/public-download')
  @Public()
  @ApiOperation({ summary: 'Public invoice download via secure hash' })
  async publicDownloadInvoice(
    @Param('invoiceNumber') invoiceNumber: string,
    @Query('hash') hash: string,
    @Res() res: Response,
  ) {
    if (!hash) {
      throw new ForbiddenException('Secure download hash is required');
    }
    const secret =
      process.env.JWT_SECRET ||
      'dev-secret-change-in-production-min-32-chars!!';
    const computed = crypto
      .createHmac('sha256', secret)
      .update(invoiceNumber)
      .digest('hex');

    if (hash !== computed) {
      throw new ForbiddenException('Invalid or expired download link');
    }

    const invoice = await this.invoiceService.getInvoiceByNumber(
      invoiceNumber,
      { role: Role.SUPERADMIN } as any,
    );
    const htmlContent = this.buildInvoiceHtml(
      invoice,
      { role: Role.SUPERADMIN } as any,
      undefined,
      false,
    );
    const pdfBuffer = await this.generatePdfFromHtml(htmlContent);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
    );
    return res.send(pdfBuffer);
  }

  @Get(':invoiceNumber')
  @ApiOperation({ summary: 'Get a single invoice by its invoice number' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  async getInvoiceByNumber(
    @Param('invoiceNumber') invoiceNumber: string,
    @CurrentUser() user: JwtUser,
  ): Promise<InvoiceViewModel> {
    return this.invoiceService.getInvoiceByNumber(invoiceNumber, user);
  }

  @Get(':invoiceNumber/view')
  @ApiOperation({ summary: 'View invoice rendered as HTML' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  async viewInvoice(
    @Param('invoiceNumber') invoiceNumber: string,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const invoice = await this.invoiceService.getInvoiceByNumber(
      invoiceNumber,
      user,
    );
    const html = this.buildInvoiceHtml(invoice, user, undefined, false);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  private async generatePdfFromHtml(html: string): Promise<Buffer> {
    return PdfGenerator.generateFromHtml(html, { noHeaderFooter: true });
  }
  // Utility method to build invoice HTML using the InvoiceHtmlBuilder
  private buildInvoiceHtml(
    invoice: InvoiceViewModel,
    user: JwtUser,
    roleOverride?: string,
    autoPrint = false,
  ): string {
    return InvoiceHtmlBuilder.build(invoice, { autoPrint });
  }
}
