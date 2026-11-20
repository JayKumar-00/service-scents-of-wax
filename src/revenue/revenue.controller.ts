import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { PdfGenerator } from '../common/utils/pdf-generator.util';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { RevenueResponseDto } from './dto/revenue-response.dto';
import { RevenueService } from './revenue.service';
import { RevenueHtmlBuilder } from './templates/revenue-html.builder';

@ApiTags('Revenue')
@ApiBearerAuth('access-token')
@Controller('revenue')
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Get('admin')
  @ApiOperation({
    summary:
      'Get overall system revenue metrics for Admin (DAY | WEEK | MONTHLY | YEARLY) with optional limit for graph data and custom date filter (fromDate, toDate)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  async getAdminRevenue(
    @Query() query: RevenueQueryDto,
  ): Promise<RevenueResponseDto> {
    return this.revenueService.getAdminRevenue(query);
  }

  @Get('admin/preview')
  @ApiOperation({
    summary: 'Preview Admin revenue report HTML in-browser',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  async previewAdminRevenue(
    @Query() query: RevenueQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.revenueService.getAdminRevenue(query);
    const html = RevenueHtmlBuilder.build(data, { isFranchiseView: false });
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  @Get('admin/download')
  @ApiOperation({
    summary: 'Download Admin revenue report as PDF',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  async downloadAdminRevenue(
    @Query() query: RevenueQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.revenueService.getAdminRevenue(query);
    const html = RevenueHtmlBuilder.build(data, { isFranchiseView: false });
    const pdfBuffer = await PdfGenerator.generateFromHtml(html, {
      noHeaderFooter: true,
    });
    const fileName = `Admin-Revenue-Report-${data.period || 'DAY'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(pdfBuffer);
  }

  @Get('franchise')
  @ApiOperation({
    summary:
      'Get franchise-specific revenue metrics including POSRevanue and OnlineCustomerRevanue (DAY | WEEK | MONTHLY | YEARLY) with optional limit and date filter',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  async getFranchiseRevenue(
    @CurrentUser() user: JwtUser,
    @Query() query: RevenueQueryDto,
  ): Promise<RevenueResponseDto> {
    return this.revenueService.getFranchiseRevenue(user, query);
  }

  @Get('franchise/preview')
  @ApiOperation({
    summary: 'Preview Franchise revenue report HTML in-browser',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  async previewFranchiseRevenue(
    @CurrentUser() user: JwtUser,
    @Query() query: RevenueQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.revenueService.getFranchiseRevenue(user, query);
    const html = RevenueHtmlBuilder.build(data, { isFranchiseView: true });
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  @Get('franchise/download')
  @ApiOperation({
    summary: 'Download Franchise revenue report as PDF',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  async downloadFranchiseRevenue(
    @CurrentUser() user: JwtUser,
    @Query() query: RevenueQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.revenueService.getFranchiseRevenue(user, query);
    const html = RevenueHtmlBuilder.build(data, { isFranchiseView: true });
    const pdfBuffer = await PdfGenerator.generateFromHtml(html, {
      noHeaderFooter: true,
    });
    const fileName = `Franchise-Revenue-Report-${data.franchiseCode || data.franchiseId || 'all'}-${data.period || 'DAY'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(pdfBuffer);
  }

  @Get('preview')
  @ApiOperation({
    summary:
      'Generic preview revenue report HTML (Admin or Franchise based on query/role)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  async previewRevenue(
    @CurrentUser() user: JwtUser,
    @Query() query: RevenueQueryDto,
    @Res() res: Response,
  ) {
    const isFranchiseRole =
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF ||
      user.role === Role.FRANCHISE_AUDITOR;

    const isFranchiseView = isFranchiseRole || !!query.franchiseId;

    const data = isFranchiseView
      ? await this.revenueService.getFranchiseRevenue(user, query)
      : await this.revenueService.getAdminRevenue(query);

    const html = RevenueHtmlBuilder.build(data, { isFranchiseView });
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  @Get('download')
  @ApiOperation({
    summary:
      'Generic download revenue report as PDF (Admin or Franchise based on query/role)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  async downloadRevenue(
    @CurrentUser() user: JwtUser,
    @Query() query: RevenueQueryDto,
    @Res() res: Response,
  ) {
    const isFranchiseRole =
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF ||
      user.role === Role.FRANCHISE_AUDITOR;

    const isFranchiseView = isFranchiseRole || !!query.franchiseId;

    const data = isFranchiseView
      ? await this.revenueService.getFranchiseRevenue(user, query)
      : await this.revenueService.getAdminRevenue(query);

    const html = RevenueHtmlBuilder.build(data, { isFranchiseView });
    const pdfBuffer = await PdfGenerator.generateFromHtml(html, {
      noHeaderFooter: true,
    });
    const prefix = isFranchiseView
      ? `Franchise-Revenue-Report-${data.franchiseCode || data.franchiseId || 'all'}`
      : 'Admin-Revenue-Report';
    const fileName = `${prefix}-${data.period || 'DAY'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(pdfBuffer);
  }
}

