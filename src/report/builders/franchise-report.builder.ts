import { Injectable } from '@nestjs/common';
import { BaseReportBuilder } from './base-report.builder';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveUserFranchiseId } from '../constants/report.constants';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  ReportFilter,
  ReportSummaryCard,
  ReportFieldRegistryItem,
} from '../interfaces/report.interface';
import { FranchiseStatus, Role } from '@prisma/client';
import { FranchiseReportFieldEnum } from '../enums/franchise-report-field.enum';

@Injectable()
export class FranchiseReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'franchises';
  }

  getTitle(): string {
    return 'Franchises Report';
  }

  getPrimaryEntity(): string {
    return 'Franchise';
  }

  getRelatedEntities(): string[] {
    return ['FranchiseDocument', 'User', 'Order', 'Payout', 'CreditAccount'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: FranchiseReportFieldEnum.NAME,
        label: 'Franchise Name',
        field: 'name',
        type: 'string',
        category: 'Franchise Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { name: true },
      },
      {
        key: FranchiseReportFieldEnum.CODE,
        label: 'Franchise Code',
        field: 'code',
        type: 'string',
        category: 'Franchise Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { code: true },
      },
      {
        key: FranchiseReportFieldEnum.STATUS,
        label: 'Status',
        field: 'status',
        type: 'status',
        category: 'Franchise Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { status: true },
      },
      {
        key: FranchiseReportFieldEnum.ACCEPTING_ORDERS,
        label: 'Accepting Orders',
        field: 'acceptingOrders',
        type: 'status',
        category: 'Franchise Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { acceptingOrders: true },
      },
      {
        key: FranchiseReportFieldEnum.CITY,
        label: 'City',
        field: 'city',
        type: 'string',
        category: 'Franchise Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { city: true },
      },
      {
        key: FranchiseReportFieldEnum.STATE,
        label: 'State',
        field: 'state',
        type: 'string',
        category: 'Franchise Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { state: true },
      },
      {
        key: FranchiseReportFieldEnum.KYC_STATUS,
        label: 'KYC Status',
        field: 'kycStatus',
        type: 'status',
        category: 'Franchise Details',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { kycStatus: true },
      },
      {
        key: FranchiseReportFieldEnum.CREATED_AT,
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Franchise Details',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { createdAt: true },
      },
      {
        key: FranchiseReportFieldEnum.OWNER_FULL_NAME,
        label: 'Owner Name',
        field: 'ownerFullName',
        type: 'string',
        category: 'Owner Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { ownerFullName: true },
      },
      {
        key: FranchiseReportFieldEnum.OWNER_PHONE,
        label: 'Owner Phone',
        field: 'ownerPhone',
        type: 'string',
        category: 'Owner Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { ownerPhone: true },
      },
      {
        key: FranchiseReportFieldEnum.OWNER_EMAIL,
        label: 'Owner Email',
        field: 'ownerEmail',
        type: 'string',
        category: 'Owner Info',
        default: false,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { ownerEmail: true },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: Object.values(FranchiseStatus).map((status) => ({
          label: status,
          value: status,
        })),
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const userFranchiseId = resolveUserFranchiseId(user);
    const clauses: any[] = [];

    // Franchise scoping
    if (
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF
    ) {
      if (userFranchiseId) {
        clauses.push({ id: userFranchiseId });
      }
    }

    // Status filter
    if (query.status) {
      clauses.push({ status: query.status as FranchiseStatus });
    }

    // Date filters
    const dateRange = this.buildDateRangeFilter(
      query.fromDate,
      query.toDate ?? query.lastDate,
    );
    if (dateRange) {
      clauses.push({ createdAt: dateRange });
    }

    // Search filter
    if (query.search?.trim()) {
      const search = query.search.trim();
      clauses.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { ownerFullName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    // Sort logic
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || query.order || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    return {
      where,
      orderBy,
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const counts = await prisma.franchise.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    const totalFranchises = counts.reduce((acc, c) => acc + c._count._all, 0);
    const activeFranchises =
      counts.find((c) => c.status === FranchiseStatus.ACTIVE)?._count._all ?? 0;
    const inactiveFranchises =
      counts.find((c) => c.status === FranchiseStatus.INACTIVE)?._count._all ??
      0;
    const blockedFranchises =
      counts.find((c) => c.status === FranchiseStatus.BLOCKED)?._count._all ??
      0;

    return {
      totalFranchises: {
        label: 'Total Franchises',
        value: totalFranchises,
        type: 'number',
      },
      activeFranchises: {
        label: 'Active Franchises',
        value: activeFranchises,
        type: 'number',
      },
      inactiveFranchises: {
        label: 'Inactive Franchises',
        value: inactiveFranchises,
        type: 'number',
      },
      blockedFranchises: {
        label: 'Blocked Franchises',
        value: blockedFranchises,
        type: 'number',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => ({
      name: r.name,
      code: r.code,
      status: r.status,
      acceptingOrders: r.acceptingOrders ? 'YES' : 'NO',
      city: r.city,
      state: r.state ?? 'N/A',
      kycStatus: r.kycStatus,
      ownerFullName: r.ownerFullName ?? 'N/A',
      ownerPhone: r.ownerPhone ?? 'N/A',
      ownerEmail: r.ownerEmail ?? 'N/A',
      createdAt: r.createdAt,
    }));
  }
}
