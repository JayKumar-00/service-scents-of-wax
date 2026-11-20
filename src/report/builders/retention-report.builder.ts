import { Injectable } from '@nestjs/common';
import { BaseReportBuilder } from './base-report.builder';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  ReportFilter,
  ReportSummaryCard,
  ReportFieldRegistryItem,
} from '../interfaces/report.interface';

@Injectable()
export class RetentionReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'retention';
  }

  getTitle(): string {
    return 'Retention & Analytics Summary Report';
  }

  getPrimaryEntity(): string {
    return 'RetentionSnapshot';
  }

  getRelatedEntities(): string[] {
    return [];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: 'TOP_CUSTOMER',
        label: 'Top Customer',
        field: 'topCustomer',
        type: 'string',
        category: 'Rankings',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
      },
      {
        key: 'TOP_PRODUCT',
        label: 'Top Product',
        field: 'topProduct',
        type: 'string',
        category: 'Rankings',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
      },
      {
        key: 'TOP_FRANCHISE',
        label: 'Top Franchise',
        field: 'topFranchise',
        type: 'string',
        category: 'Rankings',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
      },
      {
        key: 'TOP_BRAND',
        label: 'Top Brand',
        field: 'topBrand',
        type: 'string',
        category: 'Rankings',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
      },
      {
        key: 'TOP_CATEGORY',
        label: 'Top Category',
        field: 'topCategory',
        type: 'string',
        category: 'Rankings',
        default: true,
        sortable: false,
        filterable: false,
        exportable: true,
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    return {
      where: {},
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    return {};
  }

  async transformData(records: any[]): Promise<any[]> {
    return records;
  }
}
