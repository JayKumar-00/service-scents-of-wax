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
import { Role } from '@prisma/client';
import { StaffReportFieldEnum } from '../enums/staff-report-field.enum';

@Injectable()
export class StaffReportBuilder extends BaseReportBuilder {
  getModuleName(): string {
    return 'staff';
  }

  getTitle(): string {
    return 'Staff Report';
  }

  getPrimaryEntity(): string {
    return 'User';
  }

  getRelatedEntities(): string[] {
    return ['AdminProfile', 'FranchiseStaffProfile', 'Franchise', 'AppRole'];
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return [
      {
        key: StaffReportFieldEnum.EMAIL,
        label: 'Email',
        field: 'email',
        type: 'string',
        category: 'Account Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { email: true },
      },
      {
        key: StaffReportFieldEnum.ROLE,
        label: 'Role',
        field: 'role',
        type: 'string',
        category: 'Account Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { role: true, appRole: { select: { roleName: true } } },
      },
      {
        key: StaffReportFieldEnum.IS_ACTIVE,
        label: 'Status',
        field: 'isActive',
        type: 'status',
        category: 'Account Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { isActive: true },
      },
      {
        key: StaffReportFieldEnum.CREATED_AT,
        label: 'Created At',
        field: 'createdAt',
        type: 'date',
        category: 'Account Info',
        default: true,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect: { createdAt: true },
      },
      {
        key: StaffReportFieldEnum.NAME,
        label: 'Name',
        field: 'name',
        type: 'string',
        category: 'Profile Details',
        default: true,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: {
          adminProfile: { select: { name: true } },
          staffFranchise: { select: { name: true } },
        },
      },
      {
        key: StaffReportFieldEnum.DESIGNATION,
        label: 'Designation',
        field: 'designation',
        type: 'string',
        category: 'Profile Details',
        default: false,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: {
          adminProfile: { select: { designation: true } },
          staffFranchise: { select: { designation: true } },
        },
      },
      {
        key: StaffReportFieldEnum.PHONE_NUMBER,
        label: 'Phone Number',
        field: 'phoneNumber',
        type: 'string',
        category: 'Profile Details',
        default: false,
        sortable: false,
        filterable: true,
        exportable: true,
        dbSelect: {
          staffFranchise: { select: { phoneNumber: true } },
        },
      },
    ];
  }

  getFilters(): ReportFilter[] {
    return [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
    ];
  }

  buildQuery(query: ReportQueryDto, user: JwtUser): any {
    const userFranchiseId = resolveUserFranchiseId(user);
    const clauses: any[] = [];

    // Franchise scoping: franchise staff, owners, and auditors can only see staff in their franchise
    if (
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF
    ) {
      if (userFranchiseId) {
        clauses.push({
          OR: [
            { franchiseId: userFranchiseId },
            { franchiseOwnerId: userFranchiseId },
          ],
        });
      }
      clauses.push({ role: { not: Role.FRANCHISE_AUDITOR } });
    } else {
      // Exclude CUSTOMER role users from Staff report for admin users
      clauses.push({ role: { not: Role.CUSTOMER } });
    }

    // Status filter
    if (query.status) {
      const activeState = query.status.toLowerCase() === 'active';
      clauses.push({ isActive: activeState });
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
          { email: { contains: search, mode: 'insensitive' } },
          { adminProfile: { name: { contains: search, mode: 'insensitive' } } },
          {
            staffFranchise: { name: { contains: search, mode: 'insensitive' } },
          },
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
      include: {
        adminProfile: { select: { name: true, designation: true } },
        staffFranchise: {
          select: { name: true, designation: true, phoneNumber: true },
        },
        appRole: { select: { roleName: true } },
      },
    };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const counts = await prisma.user.groupBy({
      by: ['isActive'],
      where,
      _count: { _all: true },
    });

    const totalStaff = counts.reduce((acc, c) => acc + c._count._all, 0);
    const activeStaff =
      counts.find((c) => c.isActive === true)?._count._all ?? 0;
    const inactiveStaff =
      counts.find((c) => c.isActive === false)?._count._all ?? 0;

    return {
      totalStaff: {
        label: 'Total Staff',
        value: totalStaff,
        type: 'number',
      },
      activeStaff: {
        label: 'Active Staff',
        value: activeStaff,
        type: 'number',
      },
      inactiveStaff: {
        label: 'Inactive Staff',
        value: inactiveStaff,
        type: 'number',
      },
    };
  }

  async transformData(records: any[]): Promise<any[]> {
    return records.map((r) => {
      const name = r.adminProfile?.name ?? r.staffFranchise?.name ?? 'N/A';
      const designation =
        r.adminProfile?.designation ?? r.staffFranchise?.designation ?? 'N/A';
      const phone = r.staffFranchise?.phoneNumber ?? 'N/A';
      return {
        email: r.email,
        role: r.appRole?.roleName ?? r.role,
        isActive: r.isActive ? 'ACTIVE' : 'INACTIVE',
        name,
        designation,
        phoneNumber: phone,
        createdAt: r.createdAt,
      };
    });
  }
}
