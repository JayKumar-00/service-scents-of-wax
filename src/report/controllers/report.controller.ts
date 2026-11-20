import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  ForbiddenException,
  Ip,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { ReportQueryDto, ExportQueryDto } from '../dto/report-query.dto';
import { ReportService } from '../services/report.service';
import { ReportQueryService } from '../services/report-query.service';
import { ReportExportService } from '../services/report-export.service';
import { HtmlExporter } from '../exporters/html.exporter';
import { ReportModuleEnum } from '../enums/report-module.enum';
import {
  mergePermissionGrants,
  normalizePermissionModuleName,
} from '../../common/utils/permission.util';
import * as fs from 'fs';
import { AuditService } from 'src/audit/audit.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';

@ApiTags('Reports <- SuperAdmin, Admin Staff, Franchise Owner, Franchise Staff')
@ApiBearerAuth('access-token')
@Controller('reports')
@Roles(
  Role.SUPERADMIN,
  Role.ADMIN_STAFF,
  Role.FRANCHISE_OWNER,
  Role.FRANCHISE_STAFF,
)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly reportQueryService: ReportQueryService,
    private readonly reportExportService: ReportExportService,
    private readonly audit: AuditService,
  ) {}

  @Get(':moduleName/meta')
  @ApiOperation({
    summary: 'Get report columns, default selections, and filters metadata',
  })
  @ApiParam({
    name: 'moduleName',
    enum: ReportModuleEnum,
    description: 'Reporting module name',
  })
  async getMetadata(
    @Param('moduleName') moduleName: ReportModuleEnum,
    @CurrentUser() user: JwtUser,
  ) {
    this.checkPermissionOrThrow(user, moduleName, 'canRead');
    return this.reportService.getMetadata(moduleName);
  }

  @Get(':moduleName/data')
  @ApiOperation({
    summary: 'Get report metrics summary and paginated data records',
  })
  @ApiParam({
    name: 'moduleName',
    enum: ReportModuleEnum,
    description: 'Reporting module name',
  })
  async getReportData(
    @Param('moduleName') moduleName: ReportModuleEnum,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    console.log('[DEBUG] Report query received:', { moduleName, query, user });
    this.checkPermissionOrThrow(user, moduleName, 'canRead');
    const res = await this.reportQueryService.getReportData(
      moduleName,
      query,
      user,
    );
    console.log(
      '[DEBUG] Report query result records count:',
      res.records.length,
    );
    return res;
  }

  @Get(':moduleName/view')
  @ApiOperation({ summary: 'Render HTML report in-browser' })
  @ApiParam({
    name: 'moduleName',
    enum: ReportModuleEnum,
    description: 'Reporting module name',
  })
  async viewReportHtml(
    @Param('moduleName') moduleName: ReportModuleEnum,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    this.checkPermissionOrThrow(user, moduleName, 'canRead');

    const builder = this.reportService.getBuilder(moduleName);
    const data = await this.reportQueryService.getExportData(
      moduleName,
      query,
      user,
    );
    const fieldsSelected = builder.parseAndValidateFields(query.fields);

    let columns = builder
      .getColumns()
      .filter((c) => fieldsSelected.includes(c.name));

    if (moduleName.toLowerCase() === 'retention') {
      const topLimit = query.limit ? Number(query.limit) : 10;
      columns = columns.map((col) => ({
        ...col,
        label: col.label.replace('Top', `Top ${topLimit}`),
      }));
    }

    const html = HtmlExporter.export({
      title: builder.getTitle(),
      columns,
      records: data.records,
      summary: data.summary,
      filters: this.extractActiveFilters(query),
      generatedBy: user.email || 'System',
    });

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  @Get(':moduleName/export')
  @ApiOperation({ summary: 'Export report to file (pdf, xlsx, csv, json)' })
  @ApiParam({
    name: 'moduleName',
    enum: ReportModuleEnum,
    description: 'Reporting module name',
  })
  async exportReport(
    @Param('moduleName') moduleName: ReportModuleEnum,
    @Query() query: ExportQueryDto,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Ip() ip: string,
  ) {
    console.log('[DEBUG] Report export received:', { moduleName, query, user });
    this.checkPermissionOrThrow(user, moduleName, 'canExport');

    const format = query.format.toLowerCase() as any;

    const { filePath, fileName, mimeType } =
      await this.reportExportService.generateReportFile(
        moduleName,
        query,
        format,
        user,
      );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: `Report_${moduleName}_exported`,
        resource: 'Report',
        resourceId: `Report_${moduleName}_exported`,
        metadata: {
          moduleName: moduleName,
          format: format,
        },
        ip,
      }),
      'REPORT_EXPORTED',
    );

    // Stream download and cleanup path on finish
    return res.download(filePath, fileName, (err) => {
      if (err) {
        console.error(`Error sending export download file: ${err.message}`);
      }
      // Delete local temp export file once sent
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            `Failed to delete sent report file ${filePath}: ${unlinkErr.message}`,
          );
        }
      });
    });
  }

  private checkPermissionOrThrow(
    user: JwtUser,
    moduleName: string,
    action: 'canRead' | 'canExport',
  ): void {
    // SuperAdmin and FranchiseOwner bypass appRole checks
    if (user.role === Role.SUPERADMIN || user.role === Role.FRANCHISE_OWNER) {
      return;
    }

    if (!user.appRole || !user.appRole.isActive) {
      throw new ForbiddenException(
        'Access denied: Active RBAC profile is not assigned to staff account.',
      );
    }

    const permissionMap = mergePermissionGrants(user.appRole.permissions);
    const normalized = normalizePermissionModuleName(moduleName);
    const permission =
      permissionMap.get(normalized) || permissionMap.get('reports');

    if (!permission || !permission[action]) {
      throw new ForbiddenException(
        `Access denied: Missing '${action}' permission for module '${moduleName}'.`,
      );
    }
  }

  private extractActiveFilters(query: ReportQueryDto): Record<string, any> {
    const filters: Record<string, any> = {};
    if (query.status) filters.status = query.status;
    if (query.fromDate) filters.fromDate = query.fromDate;
    if (query.toDate || query.lastDate)
      filters.toDate = query.toDate || query.lastDate;
    if (query.search) filters.search = query.search;
    return filters;
  }
}
