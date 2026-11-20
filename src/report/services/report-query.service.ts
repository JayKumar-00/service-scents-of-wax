import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportService } from './report.service';
import {
  mapModuleToPrismaModel,
  resolveUserFranchiseId,
} from '../constants/report.constants';
import { ReportQueryDto } from '../dto/report-query.dto';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { ReportDataResponse } from '../interfaces/report.interface';
import {
  Role,
  CustomerLifecycleStage,
  LoyaltyTier,
  ReferralStatus,
} from '@prisma/client';

@Injectable()
export class ReportQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportService: ReportService,
  ) {}

  public async getReportData(
    moduleName: string,
    query: ReportQueryDto,
    user: JwtUser,
  ): Promise<ReportDataResponse> {
    // Check if custom retention module
    if (moduleName.toLowerCase() === 'retention') {
      const customData = await this.getRetentionCustomData(user, query);
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      const paginatedRecords = customData.records.slice(skip, skip + limit);

      return {
        summary: customData.summary,
        records: paginatedRecords,
        pagination: {
          total: customData.records.length,
          page,
          limit,
          pages: Math.ceil(customData.records.length / limit) || 1,
        },
      };
    }

    const builder = this.reportService.getBuilder(moduleName);

    // Enforce franchise isolation
    const userFranchiseId = resolveUserFranchiseId(user);
    if (
      (user.role === Role.FRANCHISE_OWNER ||
        user.role === Role.FRANCHISE_STAFF) &&
      !userFranchiseId
    ) {
      throw new ForbiddenException(
        'Access denied: Franchise is not assigned to user profile.',
      );
    }

    // Parse and validate field selection
    const fieldsSelected = builder.parseAndValidateFields(query.fields);

    // Build prisma query
    const prismaQuery = builder.buildQuery(query, user);

    // Dynamic select query optimization
    const select = builder.buildPrismaSelect(fieldsSelected);
    if (Object.keys(select).length > 0) {
      prismaQuery.select = select;
      delete prismaQuery.include;
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const prismaModelName = mapModuleToPrismaModel(builder.getModuleName());
    const dbClient = (this.prisma as any)[prismaModelName];
    if (!dbClient) {
      throw new Error(
        `Prisma model client for '${prismaModelName}' is not defined.`,
      );
    }

    // Execute queries
    const [records, total] = await Promise.all([
      dbClient.findMany({
        ...prismaQuery,
        skip,
        take: limit,
      }),
      dbClient.count({
        where: prismaQuery.where,
      }),
    ]);

    // Format fields
    const transformed = await builder.transformData(records);

    // Sanitize columns to filter outputs matching selected keys
    const sanitized = builder.sanitizeColumns(transformed, fieldsSelected);
    const summary = await builder.getSummary(this.prisma, prismaQuery.where);

    return {
      summary,
      records: sanitized,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async getExportData(
    moduleName: string,
    query: ReportQueryDto,
    user: JwtUser,
  ): Promise<{ summary: any; records: any[] }> {
    // Check if custom retention module
    if (moduleName.toLowerCase() === 'retention') {
      const customData = await this.getRetentionCustomData(user, query);
      return customData;
    }

    const builder = this.reportService.getBuilder(moduleName);

    // Enforce franchise isolation
    const userFranchiseId = resolveUserFranchiseId(user);
    if (
      (user.role === Role.FRANCHISE_OWNER ||
        user.role === Role.FRANCHISE_STAFF) &&
      !userFranchiseId
    ) {
      throw new ForbiddenException(
        'Access denied: Franchise is not assigned to user profile.',
      );
    }

    // Parse and validate field selection
    const fieldsSelected = builder.parseAndValidateFields(query.fields);

    const prismaQuery = builder.buildQuery(query, user);

    // Dynamic select query optimization
    const select = builder.buildPrismaSelect(fieldsSelected);
    if (Object.keys(select).length > 0) {
      prismaQuery.select = select;
      delete prismaQuery.include;
    }

    const prismaModelName = mapModuleToPrismaModel(builder.getModuleName());
    const dbClient = (this.prisma as any)[prismaModelName];

    // Read max 50,000 records to prevent Heap out of memory on huge databases
    const records = await dbClient.findMany({
      ...prismaQuery,
      take: 50000,
    });

    const transformed = await builder.transformData(records);
    const sanitized = builder.sanitizeColumns(transformed, fieldsSelected);
    const summary = await builder.getSummary(this.prisma, prismaQuery.where);

    return { summary, records: sanitized };
  }

  private async getRetentionCustomData(user: JwtUser, query: ReportQueryDto) {
    const builder = this.reportService.getBuilder('retention');
    const fieldsSelected = builder.parseAndValidateFields(query.fields);
    const topLimit = query.limit ? Number(query.limit) : 10;

    // Run the queries directly
    const rawStages = await this.prisma.retentionSnapshot.groupBy({
      by: ['stage'],
      _count: { customerId: true },
    });

    const stages = Object.values(CustomerLifecycleStage).reduce(
      (acc, stage) => {
        const found = rawStages.find((r) => r.stage === stage);
        acc[stage] = found ? found._count.customerId : 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    const rawTiers = await this.prisma.retentionSnapshot.groupBy({
      by: ['tier'],
      _count: { customerId: true },
    });

    const tiers = Object.values(LoyaltyTier).reduce(
      (acc, tier) => {
        const found = rawTiers.find((r) => r.tier === tier);
        acc[tier] = found ? found._count.customerId : 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalCustomers = await this.prisma.retentionSnapshot.count();
    const aggregateData = await this.prisma.retentionSnapshot.aggregate({
      _sum: { totalSpend: true, loyaltyPoints: true },
      _avg: { totalSpend: true },
    });

    const totalSpendSum = Number(aggregateData._sum.totalSpend || 0);
    const averageCLV = Number(aggregateData._avg.totalSpend || 0);
    const totalPointsSum = aggregateData._sum.loyaltyPoints || 0;

    const orderAggregate = await this.prisma.order.aggregate({
      where: { status: { not: 'CANCELLED' } },
      _count: { id: true },
      _sum: { total: true },
    });

    const activeOrdersCount = orderAggregate._count.id;
    const activeOrdersSum = Number(orderAggregate._sum.total || 0);
    const averageOrderValue =
      activeOrdersCount > 0
        ? Number((activeOrdersSum / activeOrdersCount).toFixed(2))
        : 0;

    const subscribersCount = await this.prisma.newsletterSubscriber.count({
      where: { status: 'SUBSCRIBED' },
    });

    const completedReferrals = await this.prisma.referral.count({
      where: { status: ReferralStatus.COMPLETED },
    });

    // 1. Dynamic Top Customers
    const topCustomersList = await this.prisma.retentionSnapshot.findMany({
      orderBy: { totalSpend: 'desc' },
      include: { customer: { select: { name: true } } },
      take: topLimit,
    });

    // 2. Dynamic Top Products
    const topProductsGroup = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: topLimit,
    });
    const productIds = topProductsGroup
      .map((g) => g.productId)
      .filter(Boolean) as string[];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    // 3. Dynamic Top Franchises
    const topFranchisesGroup = await this.prisma.order.groupBy({
      by: ['franchiseId'],
      _sum: { total: true },
      where: { status: { not: 'CANCELLED' } },
      orderBy: { _sum: { total: 'desc' } },
      take: topLimit,
    });
    const franchiseIds = topFranchisesGroup
      .map((g) => g.franchiseId)
      .filter(Boolean) as string[];
    const franchises = await this.prisma.franchise.findMany({
      where: { id: { in: franchiseIds } },
      select: { id: true, name: true },
    });
    const franchiseMap = new Map(franchises.map((f) => [f.id, f.name]));

    // 4. Dynamic Top Brands
    const topBrandsGroup = await this.prisma.customerBrandInterest.groupBy({
      by: ['brandId'],
      _sum: { score: true },
      orderBy: { _sum: { score: 'desc' } },
      take: topLimit,
    });
    const brandIds = topBrandsGroup
      .map((g) => g.brandId)
      .filter(Boolean) as string[];
    const brands = await this.prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, name: true },
    });
    const brandMap = new Map(brands.map((b) => [b.id, b.name]));

    // 5. Dynamic Top Categories
    const topCategoriesGroup =
      await this.prisma.customerCategoryInterest.groupBy({
        by: ['categoryId'],
        _sum: { score: true },
        orderBy: { _sum: { score: 'desc' } },
        take: topLimit,
      });
    const categoryIds = topCategoriesGroup
      .map((g) => g.categoryId)
      .filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const records: any[] = [];
    for (let i = 0; i < topLimit; i++) {
      const customerVal = topCustomersList[i]
        ? `${topCustomersList[i].customer?.name ?? 'N/A'} (Spend: ₹${Number(topCustomersList[i].totalSpend).toFixed(2)})`
        : '';

      const productVal =
        topProductsGroup[i] && topProductsGroup[i].productId
          ? `${productMap.get(topProductsGroup[i].productId) ?? 'Unknown Product'} (${topProductsGroup[i]._sum?.quantity ?? 0} sold)`
          : '';

      const franchiseVal =
        topFranchisesGroup[i] && topFranchisesGroup[i].franchiseId
          ? `${franchiseMap.get(topFranchisesGroup[i].franchiseId) ?? 'Unknown Franchise'} (Revenue: ₹${Number(topFranchisesGroup[i]._sum?.total ?? 0).toFixed(2)})`
          : '';

      const brandVal =
        topBrandsGroup[i] && topBrandsGroup[i].brandId
          ? `${brandMap.get(topBrandsGroup[i].brandId) ?? 'Unknown Brand'} (Score: ${topBrandsGroup[i]._sum?.score ?? 0})`
          : '';

      const categoryVal =
        topCategoriesGroup[i] && topCategoriesGroup[i].categoryId
          ? `${categoryMap.get(topCategoriesGroup[i].categoryId) ?? 'Unknown Category'} (Score: ${topCategoriesGroup[i]._sum?.score ?? 0})`
          : '';

      if (
        customerVal ||
        productVal ||
        franchiseVal ||
        brandVal ||
        categoryVal
      ) {
        records.push({
          topCustomer: customerVal,
          topProduct: productVal,
          topFranchise: franchiseVal,
          topBrand: brandVal,
          topCategory: categoryVal,
        });
      }
    }

    const sanitized = builder.sanitizeColumns(records, fieldsSelected);

    return {
      summary: {
        totalCustomers: {
          label: 'Total Customers',
          value: totalCustomers,
          type: 'number' as const,
        },
        totalSpend: {
          label: 'Total Spend',
          value: Number(totalSpendSum).toFixed(2),
          type: 'currency' as const,
        },
        activeOrders: {
          label: 'Active Orders',
          value: activeOrdersCount,
          type: 'number' as const,
        },
      },
      records: sanitized,
    };
  }
}
