import { Body, Controller, Get, Header, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateQcDto } from './dto/create-qc.dto';
import { QcQueryDto } from './dto/qc-query.dto';
import { UpdateQcStatusDto } from './dto/update-qc-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { QcService } from './qc.service';

@ApiTags('Procurement QC')
@ApiBearerAuth('access-token')
@Controller('procurement/qc')
export class QcController {
  constructor(private readonly qcService: QcService) {}

  @Post('inspections')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  create(@Body() dto: CreateQcDto) {
    return this.qcService.create(dto);
  }

  @Get('inspections')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'List quality control inspections with filters, search, sorting, and pagination',
  })
  list(@Query() query: QcQueryDto) {
    return this.qcService.list(query);
  }


  @Patch('inspections/:id/approve')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  approve(@Param('id') id: string) {
    return this.qcService.approve(id);
  }

  @Patch('inspections/:id/status')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateQcStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.qcService.updateStatus(id, dto.status, user.sub);
  }

  @Get('report/:poNumber')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Generate HTML receipt report for Quality Control inspections of a Purchase Order',
  })
  @ApiQuery({ name: 'type', required: false, enum: ['BASIC', 'COMPLETE'], schema: { default: 'BASIC' }, example: 'BASIC', description: 'Report detail level' })
  @Header('Content-Type', 'text/html')
  generateReport(
    @Param('poNumber') poNumber: string,
    @Query('type') type?: 'BASIC' | 'COMPLETE',
  ) {
    return this.qcService.generateReport(poNumber, type);
  }

  @Get('report/:poNumber/download')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Download PDF receipt report for Quality Control inspections of a Purchase Order',
  })
  @ApiQuery({ name: 'type', required: false, enum: ['BASIC', 'COMPLETE'], schema: { default: 'BASIC' }, example: 'BASIC', description: 'Report detail level' })
  async downloadReport(
    @Param('poNumber') poNumber: string,
    @Query('type') type: 'BASIC' | 'COMPLETE' | undefined,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.qcService.generatePdfReport(poNumber, type);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="QC_Report_${poNumber}.pdf"`);
    return res.send(pdfBuffer);
  }
}


