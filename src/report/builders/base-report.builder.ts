import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  ReportColumn,
  ReportFilter,
  ReportSummaryCard,
  ReportFieldRegistryItem,
} from '../interfaces/report.interface';
import { REPORT_FIELD_BLACKLIST } from '../constants/report.constants';
import { BadRequestException } from '@nestjs/common';

export function mergePrismaSelect(target: any, source: any): any {
  if (!target) return source;
  if (!source) return target;

  const merged = { ...target };

  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (merged[key] && typeof merged[key] === 'object') {
        merged[key] = mergePrismaSelect(merged[key], val);
      } else {
        merged[key] = val;
      }
    } else {
      merged[key] = val;
    }
  }
  return merged;
}

export abstract class BaseReportBuilder {
  abstract getModuleName(): string;
  abstract getTitle(): string;
  abstract getFilters(): ReportFilter[];
  abstract getAvailableFields(): ReportFieldRegistryItem[];
  abstract getPrimaryEntity(): string;
  abstract getRelatedEntities(): string[];

  public getDefaultFields(): string[] {
    return this.getAvailableFields()
      .filter((f) => f.default)
      .map((f) => f.key);
  }

  public getFieldMappings(): Record<string, ReportFieldRegistryItem> {
    const mappings: Record<string, ReportFieldRegistryItem> = {};
    for (const item of this.getAvailableFields()) {
      mappings[item.key] = item;
    }
    return mappings;
  }

  public getColumns(): ReportColumn[] {
    return this.getAvailableFields().map((c) => ({
      name: c.key,
      label: c.label,
      type: c.type,
    }));
  }

  public getDefaultColumns(): string[] {
    return this.getAvailableFields()
      .filter((c) => c.default)
      .map((c) => c.key);
  }

  public validateFieldsOrThrow(requestedKeys: string[]): void {
    const mappings = this.getFieldMappings();
    for (const key of requestedKeys) {
      const fieldMeta = mappings[key];
      if (!fieldMeta) {
        throw new BadRequestException(
          `Unknown field key: '${key}' for module '${this.getModuleName()}'.`,
        );
      }
      if (
        REPORT_FIELD_BLACKLIST.includes(fieldMeta.field) ||
        REPORT_FIELD_BLACKLIST.includes(key.toLowerCase())
      ) {
        throw new BadRequestException(
          `Access denied: Field '${key}' contains sensitive data and cannot be retrieved.`,
        );
      }
    }
  }

  public parseAndValidateFields(queryFields: any): string[] {
    let fieldsSelected: string[] = [];
    if (queryFields) {
      if (typeof queryFields === 'string') {
        fieldsSelected = queryFields
          .split(',')
          .map((f) => f.trim().toUpperCase());
      } else if (Array.isArray(queryFields)) {
        fieldsSelected = queryFields.map((f) => String(f).trim().toUpperCase());
      }
    }
    if (fieldsSelected.length === 0) {
      fieldsSelected = this.getDefaultFields();
    }
    this.validateFieldsOrThrow(fieldsSelected);
    return fieldsSelected;
  }

  public buildPrismaSelect(requestedKeys: string[]): any {
    const mappings = this.getFieldMappings();
    let selectObject: any = {};

    for (const key of requestedKeys) {
      const fieldMeta = mappings[key];
      if (fieldMeta && fieldMeta.dbSelect) {
        selectObject = mergePrismaSelect(selectObject, fieldMeta.dbSelect);
      }
    }

    return selectObject;
  }

  abstract buildQuery(
    query: ReportQueryDto,
    user: JwtUser,
  ): {
    where: any;
    orderBy?: any;
    select?: any;
    include?: any;
  };

  abstract getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>>;

  abstract transformData(records: any[]): Promise<any[]>;

  /**
   * Helper to filter out blacklisted fields and fields not in the report columns
   */
  public sanitizeColumns(records: any[], requestedKeys: string[]): any[] {
    const mappings = this.getFieldMappings();
    const activeKeys = requestedKeys.filter(
      (key) =>
        mappings[key] && !REPORT_FIELD_BLACKLIST.includes(mappings[key].field),
    );

    return records.map((record) => {
      const sanitized: any = {};
      for (const key of activeKeys) {
        const fieldMeta = mappings[key];
        sanitized[key] =
          record[fieldMeta.field] !== undefined
            ? record[fieldMeta.field]
            : null;
      }
      return sanitized;
    });
  }

  protected buildDateRangeFilter(fromDate?: string, toDate?: string): any {
    const cleanFrom = fromDate?.trim();
    const cleanTo = toDate?.trim();
    if (!cleanFrom && !cleanTo) return undefined;

    const filter: any = {};
    if (cleanFrom) {
      const parsed = new Date(cleanFrom);
      if (!isNaN(parsed.getTime())) {
        filter.gte = parsed;
      }
    }
    if (cleanTo) {
      const parsed = new Date(cleanTo);
      if (!isNaN(parsed.getTime())) {
        if (cleanTo.length === 10) {
          parsed.setUTCHours(23, 59, 59, 999);
        }
        filter.lte = parsed;
      }
    }

    if (Object.keys(filter).length === 0) return undefined;
    return filter;
  }
}
