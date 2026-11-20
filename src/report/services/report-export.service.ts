import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportQueryService } from './report-query.service';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { ReportQueryDto } from '../dto/report-query.dto';
import { HtmlExporter } from '../exporters/html.exporter';
import { PdfExporter } from '../exporters/pdf.exporter';
import { ExcelExporter } from '../exporters/excel.exporter';
import { TEMP_REPORTS_DIR_NAME } from '../constants/report.constants';
import { ReportFormat } from '../enums/report-format.enum';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportExportService {
  private readonly reportsDir = path.join(process.cwd(), TEMP_REPORTS_DIR_NAME);

  constructor(
    private readonly reportService: ReportService,
    private readonly reportQueryService: ReportQueryService,
  ) {
    // Ensure the output folder exists inside the workspace
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  public async generateReportFile(
    moduleName: string,
    query: ReportQueryDto,
    format: ReportFormat,
    user: JwtUser,
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    // Run cleanup asynchronously to prevent disk bloat
    this.cleanupOldReports().catch((err) =>
      console.error('Error in reports background cleanup:', err),
    );

    const builder = this.reportService.getBuilder(moduleName);
    const data = await this.reportQueryService.getExportData(
      moduleName,
      query,
      user,
    );

    const fieldsSelected = builder.parseAndValidateFields(query.fields);
    const title = builder.getTitle();
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

    const timestamp = Date.now();
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const fileName = `${moduleName}_REPORT_${timestamp}_${uniqueId}.${format}`;
    const filePath = path.join(this.reportsDir, fileName);

    const generatedBy = user.email || 'System';

    if (format === ReportFormat.HTML) {
      const htmlContent = HtmlExporter.export({
        title,
        columns,
        records: data.records,
        summary: data.summary,
        filters: this.extractActiveFilters(query),
        generatedBy,
      });
      await fs.promises.writeFile(filePath, htmlContent, 'utf8');
      return { filePath, fileName, mimeType: 'text/html' };
    }

    if (format === ReportFormat.PDF) {
      const htmlContent = HtmlExporter.export({
        title,
        columns,
        records: data.records,
        summary: data.summary,
        filters: this.extractActiveFilters(query),
        generatedBy,
      });
      await PdfExporter.export(htmlContent, filePath);
      return { filePath, fileName, mimeType: 'application/pdf' };
    }

    if (format === ReportFormat.XLSX) {
      const excelXmlContent = ExcelExporter.export({
        title,
        columns,
        records: data.records,
        summary: data.summary,
        filters: this.extractActiveFilters(query),
        generatedBy,
      });
      await fs.promises.writeFile(filePath, excelXmlContent, 'utf8');
      // Using standard Excel XML format mime type
      return { filePath, fileName, mimeType: 'application/vnd.ms-excel' };
    }

    if (format === ReportFormat.CSV) {
      const csvContent = this.generateCsvContent(columns, data.records);
      await fs.promises.writeFile(filePath, csvContent, 'utf8');
      return { filePath, fileName, mimeType: 'text/csv' };
    }

    if (format === ReportFormat.JSON) {
      const jsonContent = JSON.stringify(
        {
          title,
          summary: data.summary,
          records: data.records,
          filters: this.extractActiveFilters(query),
          generatedAt: nowStr(),
          generatedBy,
        },
        null,
        2,
      );
      await fs.promises.writeFile(filePath, jsonContent, 'utf8');
      return { filePath, fileName, mimeType: 'application/json' };
    }

    throw new InternalServerErrorException(
      `Format '${format}' is not supported yet.`,
    );
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

  private generateCsvContent(columns: any[], records: any[]): string {
    const headerRow = columns
      .map((col) => `"${col.label.replace(/"/g, '""')}"`)
      .join(',');
    const rows = records.map((rec) => {
      return columns
        .map((col) => {
          const val = rec[col.name];
          if (val === null || val === undefined) return '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',');
    });
    return [headerRow, ...rows].join('\n');
  }

  private async cleanupOldReports(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.reportsDir);
      const now = Date.now();
      const oneHourMs = 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.reportsDir, file);
        const stat = await fs.promises.stat(filePath);
        // Delete files older than 1 hour
        if (now - stat.mtimeMs > oneHourMs) {
          await fs.promises.unlink(filePath).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Failed to cleanup reports directory:', error);
    }
  }
}

function nowStr(): string {
  return new Date().toISOString();
}
