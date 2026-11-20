import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FinancialReportQueryDto } from '../dto/report-query.dto';
import { ReportingService } from '../services/reporting.service';

@ApiTags('Returns Financial - Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportingController {
  // constructor(private readonly reportingService: ReportingService) {}
  // @Get('sales')
  // @ApiOperation({
  //   summary:
  //     'Get optimized Net Sales report (PAYMENT + DEBIT_NOTE - CREDIT_NOTE)',
  // })
  // @ApiOkResponse({ description: 'Sales report generated successfully' })
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_AUDITOR)
  // async getSalesReport(@Query() query: FinancialReportQueryDto) {
  //   return this.reportingService.getSalesReport(query);
  // }
  // @Get('returns')
  // @ApiOperation({
  //   summary: 'Get Returns report',
  // })
  // @ApiOkResponse({ description: 'Returns report generated successfully' })
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_AUDITOR)
  // async getReturnsReport(@Query() query: FinancialReportQueryDto) {
  //   return this.reportingService.getReturnsReport(query);
  // }
  // @Get('refunds')
  // @ApiOperation({
  //   summary: 'Get Refunds report',
  // })
  // @ApiOkResponse({ description: 'Refunds report generated successfully' })
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_AUDITOR)
  // async getRefundsReport(@Query() query: FinancialReportQueryDto) {
  //   return this.reportingService.getRefundsReport(query);
  // }
  // @Get('credit-notes')
  // @ApiOperation({
  //   summary: 'Get Credit Notes report',
  // })
  // @ApiOkResponse({ description: 'Credit Notes report generated successfully' })
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_AUDITOR)
  // async getCreditNotesReport(@Query() query: FinancialReportQueryDto) {
  //   return this.reportingService.getCreditNotesReport(query);
  // }
  // @Get('exchanges')
  // @ApiOperation({
  //   summary: 'Get Exchanges report',
  // })
  // @ApiOkResponse({ description: 'Exchanges report generated successfully' })
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_AUDITOR)
  // async getExchangesReport(@Query() query: FinancialReportQueryDto) {
  //   return this.reportingService.getExchangesReport(query);
  // }
  // @Get('receipts')
  // @ApiOperation({
  //   summary: 'Get Receipts report',
  // })
  // @ApiOkResponse({ description: 'Receipts report generated successfully' })
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_AUDITOR)
  // async getReceiptsReport(@Query() query: FinancialReportQueryDto) {
  //   return this.reportingService.getReceiptsReport(query);
  // }
}
