import { ForbiddenException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettlementQueryDto } from './dto/settlement-query.dto';
import { paginatePrisma } from 'src/common/utils/pagination.util';
import { OrderType } from 'src/common/dto/query.dto';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { Prisma, Role } from '@prisma/client';
import { OrderSettlementService } from 'src/orders/services/order-settlement.service';
import { RedisService } from 'src/redis/redis.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';

@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrderSettlementService))
    private readonly orderSettlementService: OrderSettlementService,
    private readonly redisService: RedisService,
    private readonly audit: AuditService,
  ) {}

  async getSettlementsForAdmin(query: SettlementQueryDto) {
    const cacheKey = `settlements:admin:list:${JSON.stringify(query)}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored
    }

    const where = await this.buildWhereClause(query);

    const result = await paginatePrisma({
      model: this.prisma.orderSettlement,
      where,
      orderBy: { createdAt: query.order ?? OrderType.DESC },
      page: query.page,
      limit: query.limit,
      include: {
        order: {
          include: {
            franchise: true,
            customer: {
              include: {
                user: { select: { email: true } },
              },
            },
            items: true,
          },
        },
      },
    });

    const mappedData = await this.mapSettlements(result.data);
    const response = {
      data: mappedData,
      meta: result.meta,
    };

    fireAndForget(
      this.redisService.set(cacheKey, response, 300),
      'cache settlements admin list',
    );

    return response;
  }

  async getSettlementsForFranchise(franchiseId: string, query: SettlementQueryDto) {
    const cacheKey = `settlements:franchise:${franchiseId}:list:${JSON.stringify(query)}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored
    }

    const where = await this.buildWhereClause(query);
    // Enforce franchiseId scoping
    const orderWhere = (where.order ?? {}) as Prisma.OrderWhereInput;
    where.order = { ...orderWhere, franchiseId };

    const result = await paginatePrisma({
      model: this.prisma.orderSettlement,
      where,
      orderBy: { createdAt: query.order ?? OrderType.DESC },
      page: query.page,
      limit: query.limit,
      include: {
        order: {
          include: {
            franchise: true,
            customer: {
              include: {
                user: { select: { email: true } },
              },
            },
            items: true,
          },
        },
      },
    });

    const mappedData = await this.mapSettlements(result.data);
    const response = {
      data: mappedData,
      meta: result.meta,
    };

    fireAndForget(
      this.redisService.set(cacheKey, response, 300),
      'cache settlements franchise list',
    );

    return response;
  }

  async getSettlementsForAffiliate(affiliateCustomerId: string, query: SettlementQueryDto) {
    const cacheKey = `settlements:affiliate:${affiliateCustomerId}:list:${JSON.stringify(query)}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored
    }

    const where = await this.buildWhereClause(query);
    // Enforce affiliateCustomerId scoping
    where.affiliateCustomerId = affiliateCustomerId;

    const result = await paginatePrisma({
      model: this.prisma.orderSettlement,
      where,
      orderBy: { createdAt: query.order ?? OrderType.DESC },
      page: query.page,
      limit: query.limit,
      include: {
        order: {
          include: {
            franchise: true,
            customer: {
              include: {
                user: { select: { email: true } },
              },
            },
            items: true,
          },
        },
      },
    });

    const mappedData = await this.mapSettlements(result.data);
    const response = {
      data: mappedData,
      meta: result.meta,
    };

    fireAndForget(
      this.redisService.set(cacheKey, response, 300),
      'cache settlements affiliate list',
    );

    return response;
  }

  async getSettlementById(id: string, user: JwtUser) {
    const cacheKey = `settlements:id:${id}`;
    let settlement: any = null;
    try {
      settlement = await this.redisService.get<any>(cacheKey);
    } catch (e) {
      // Ignored
    }

    if (!settlement) {
      settlement = await this.prisma.orderSettlement.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              franchise: true,
              customer: {
                include: {
                  user: { select: { email: true } },
                },
              },
              items: true,
            },
          },
        },
      });

      if (!settlement) {
        throw new NotFoundException(`Order settlement with ID ${id} not found`);
      }

      fireAndForget(
        this.redisService.set(cacheKey, settlement, 300),
        'cache settlement by id',
      );
    }

    // Role-based access control check
    const isSuperAdminOrAdminStaff =
      user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF || user.role === Role.FRANCHISE_AUDITOR;

    if (!isSuperAdminOrAdminStaff) {
      if (settlement.type === 'FRANCHISE') {
        const franchiseId = user.franchiseId ?? user.franchiseOwnerId;
        if (settlement.order?.franchiseId !== franchiseId) {
          throw new ForbiddenException(
            'You do not have permission to access this settlement record',
          );
        }
      } else if (settlement.type === 'AFFILIATE') {
        if (settlement.affiliateCustomerId !== user.customerId) {
          throw new ForbiddenException(
            'You do not have permission to access this settlement record',
          );
        }
      } else {
        throw new ForbiddenException(
          'You do not have permission to access this settlement record',
        );
      }
    }

    const mapped = await this.mapSettlements([settlement]);
    return mapped[0];
  }

  private async buildWhereClause(query: SettlementQueryDto): Promise<Prisma.OrderSettlementWhereInput> {
    const { status, type, franchiseId, affiliateCustomerId, search, fromDate, lastDate } = query;
    const where: Prisma.OrderSettlementWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (franchiseId) {
      where.order = { franchiseId };
    }
    if (affiliateCustomerId) {
      where.affiliateCustomerId = affiliateCustomerId;
    }

    if (fromDate || lastDate) {
      const dateRange: any = {};
      if (fromDate) {
        dateRange.gte = new Date(fromDate);
      }
      if (lastDate) {
        const end = new Date(lastDate);
        end.setHours(23, 59, 59, 999);
        dateRange.lte = end;
      }
      where.createdAt = dateRange;
    }

    if (search) {
      const searchLower = search.trim();

      // Find matching customer IDs for affiliate mapping
      const matchingCustomers = await this.prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: searchLower, mode: 'insensitive' } },
            { phone: { contains: searchLower, mode: 'insensitive' } },
            { user: { email: { contains: searchLower, mode: 'insensitive' } } },
          ],
        },
        select: { id: true },
      });
      const matchingCustomerIds = matchingCustomers.map((c) => c.id);

      where.OR = [
        {
          order: {
            orderNumber: { contains: searchLower, mode: 'insensitive' },
          },
        },
        {
          order: {
            franchise: {
              OR: [
                { name: { contains: searchLower, mode: 'insensitive' } },
                { code: { contains: searchLower, mode: 'insensitive' } },
                { ownerFullName: { contains: searchLower, mode: 'insensitive' } },
                { businessName: { contains: searchLower, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          order: {
            customer: {
              OR: [
                { name: { contains: searchLower, mode: 'insensitive' } },
                { phone: { contains: searchLower, mode: 'insensitive' } },
                { user: { email: { contains: searchLower, mode: 'insensitive' } } },
              ],
            },
          },
        },
        ...(matchingCustomerIds.length > 0
          ? [
              {
                affiliateCustomerId: { in: matchingCustomerIds },
              },
            ]
          : []),
      ];
    }

    return where;
  }

  private async mapSettlements(settlements: any[]) {
    const affiliateCustomerIds = settlements
      .map((s) => s.affiliateCustomerId)
      .filter((id): id is string => !!id);

    const affiliatesMap = new Map<string, any>();
    if (affiliateCustomerIds.length > 0) {
      const affiliates = await this.prisma.customer.findMany({
        where: { id: { in: affiliateCustomerIds } },
        include: {
          user: { select: { email: true } },
          addresses: { where: { isDefault: true } },
        },
      });
      for (const affiliate of affiliates) {
        affiliatesMap.set(affiliate.id, affiliate);
      }
    }

    return settlements.map((settlement) => {
      const order = settlement.order;
      const franchise = order?.franchise;
      const customer = order?.customer;

      let userCode: string | null = null;
      let name: string | null = null;
      let email: string | null = null;
      let storeName: string | null = null;
      let contact: string | null = null;
      let address: string | null = null;

      if (settlement.type === 'FRANCHISE') {
        userCode = franchise?.code ?? null;
        name = franchise?.ownerFullName ?? franchise?.name ?? null;
        email = franchise?.ownerEmail ?? null;
        storeName = franchise?.name ?? null;
        contact = franchise?.ownerPhone ?? null;
        if (franchise) {
          address = [
            franchise.addressLine1,
            franchise.city,
            franchise.state,
            franchise.postalCode,
            franchise.country,
          ]
            .filter(Boolean)
            .join(', ');
        }
      } else if (settlement.type === 'AFFILIATE') {
        const affiliate = affiliatesMap.get(settlement.affiliateCustomerId ?? '');
        userCode = affiliate?.userId ?? settlement.affiliateCustomerId ?? null;
        name = affiliate?.name ?? null;
        email = affiliate?.user?.email ?? affiliate?.altEmail ?? null;
        storeName = null;
        contact = affiliate?.phone ?? null;

        const defaultAddress = affiliate?.addresses?.[0];
        if (defaultAddress) {
          address = [
            defaultAddress.addressLine1,
            defaultAddress.addressLine2,
            defaultAddress.city,
            defaultAddress.state,
            defaultAddress.postalCode,
            defaultAddress.country,
          ]
            .filter(Boolean)
            .join(', ');
        }
      }

      const products = (order?.items ?? []).map((item: any) => ({
        name: item.productName ?? null,
        price: item.unitPrice ? Number(item.unitPrice) : null,
        qty: item.quantity,
      }));

      const customerInfo = customer
        ? {
            id: customer.id,
            name: customer.name,
            email: customer.user?.email ?? customer.altEmail ?? null,
            phone: customer.phone,
          }
        : null;

      const direction = 'CREDIT';

      return {
        id: settlement.id,
        orderId: settlement.orderId,
        type: settlement.type,
        amount: Number(settlement.amount),
        status: settlement.status,
        creditTransactionId: settlement.creditTransactionId,
        affiliateCustomerId: settlement.affiliateCustomerId,
        errorReason: settlement.errorReason,
        processedAt: settlement.processedAt,
        createdAt: settlement.createdAt,
        updatedAt: settlement.updatedAt,
        userCode,
        name,
        email,
        storeName,
        contact,
        address,
        orderNumber: order?.orderNumber ?? null,
        products,
        customer: customerInfo,
        direction,
        orderPaymentInitiatedDate: order?.paidAt ?? order?.createdAt ?? null,
        settlementDate: settlement.processedAt ?? settlement.createdAt,
      };
    });
  }

  async manuallySettleOrder(orderNumber: string, user?: JwtUser, ip?: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { settlements: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with number ${orderNumber} not found`);
    }

    const hasFranchiseSettlement = order.settlements.some((s) => s.type === 'FRANCHISE');
    const hasAffiliateSettlement = order.settlements.some((s) => s.type === 'AFFILIATE');

    if (!hasFranchiseSettlement) {
      await this.orderSettlementService.settleFranchise(order.id);
    }

    if (!hasAffiliateSettlement) {
      await this.orderSettlementService.settleAffiliate(order.id);
    }

    // Retrieve and map the settlements for this order
    const settlements = await this.prisma.orderSettlement.findMany({
      where: { orderId: order.id },
      include: {
        order: {
          include: {
            franchise: true,
            customer: {
              include: {
                user: { select: { email: true } },
              },
            },
            items: true,
          },
        },
      },
    });

    const mappedData = await this.mapSettlements(settlements);

    if (user) {
      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'settlement.manual_settle',
          resource: 'OrderSettlement',
          resourceId: order.id,
          metadata: {
            role: user.role,
            orderNumber: order.orderNumber,
            franchiseSettled: !hasFranchiseSettlement,
            affiliateSettled: !hasAffiliateSettlement,
          },
          ip,
        }),
        'audit manual settlement',
      );
    }

    return {
      message: 'Settlement run completed',
      data: mappedData,
    };
  }
}
