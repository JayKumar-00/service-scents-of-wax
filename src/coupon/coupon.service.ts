import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { DiscountScope, DiscountType, Prisma } from '@prisma/client';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Injectable()
export class CouponService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly audit: AuditService,
  ) {}

  private readonly sortableFields = [
    'createdAt',
    'startsAt',
    'endsAt',
    'name',
    'code',
    'usedCount',
  ] as const;

  private normalizeCode(code?: string | null) {
    const normalized = code?.trim();

    if (!normalized) {
      return null;
    }

    return normalized.toUpperCase();
  }

  private toDecimal(value: number | string | null | undefined) {
    if (value === null || value === undefined) {
      return undefined;
    }

    return new Prisma.Decimal(value);
  }

  private buildWhere(
    query: CouponQueryDto,
    options?: {
      excludeExpired?: boolean;
      customerId?: string;
      isWeb?: boolean;
      pendingDiscountCodes?: string[];
    },
  ) {
    const clauses: Record<string, unknown>[] = [];

    const search = query.search?.trim();
    if (search) {
      clauses.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.type) {
      clauses.push({ type: query.type });
    }

    if (query.scope) {
      clauses.push({ scope: query.scope });
    }

    if (query.active !== undefined) {
      clauses.push({ active: query.active });
    }

    if (query.fromDate || query.lastDate) {
      const createdAt: Record<string, Date> = {};

      if (query.fromDate) {
        createdAt.gte = new Date(query.fromDate);
      }

      if (query.lastDate) {
        const endDate = new Date(query.lastDate);
        endDate.setHours(23, 59, 59, 999);
        createdAt.lte = endDate;
      }

      clauses.push({ createdAt });
    }

    if (options?.excludeExpired) {
      clauses.push({
        OR: [
          { endsAt: null },
          { endsAt: { gte: new Date() } },
        ],
      });
    }

    if (options?.isWeb) {
      if (options.customerId) {
        clauses.push({
          OR: [
            { createdBy: null },
            { createdBy: options.customerId, usedCount: 0 },
          ],
        });
      } else {
        clauses.push({ createdBy: null });
      }

      if (options.pendingDiscountCodes && options.pendingDiscountCodes.length > 0) {
        clauses.push({
          code: { notIn: options.pendingDiscountCodes },
        });
      }
    }

    return clauses.length > 0 ? { AND: clauses } : {};
  }

  private buildOrderBy(
    sortBy: string | undefined,
    order: OrderType | undefined,
  ) {
    return buildSortOrder(sortBy, order, [...this.sortableFields], 'createdAt');
  }

  async list(
    query: CouponQueryDto,
    options?: { excludeExpired?: boolean; customerId?: string; isWeb?: boolean },
  ) {
    const cacheKey = `coupon:active:${JSON.stringify({ query, options })}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored for production resilience
    }

    let pendingDiscountCodes: string[] = [];
    if (options?.isWeb && options.customerId) {
      const pendingRequests = await this.prisma.orderRequest.findMany({
        where: {
          customerId: options.customerId,
          status: { in: ['SEARCHING_FRANCHISE', 'PROPOSAL_SENT'] },
          discountCode: { not: null },
        },
        select: { discountCode: true },
      });
      pendingDiscountCodes = pendingRequests
        .map((r) => r.discountCode)
        .filter((c): c is string => Boolean(c));
    }

    const where = this.buildWhere(query, { ...options, pendingDiscountCodes });
    const orderBy = this.buildOrderBy(query.sortBy, query.order);

    const result = await paginatePrisma({
      model: this.prisma.discount,
      where,
      orderBy,
      page: query.page,
      limit: query.limit,
      include: {
        createdByCustomer: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    const mappedData = result.data.map((discount: any) => {
      const { createdByCustomer, ...rest } = discount;
      return {
        ...rest,
        createdBy: createdByCustomer
          ? {
              id: createdByCustomer.id,
              name: createdByCustomer.name,
              email: createdByCustomer.user?.email,
            }
          : null,
      };
    });

    const mappedResult = {
      ...result,
      data: mappedData,
    };

    fireAndForget(
      this.redisService.set(cacheKey, mappedResult, 300),
      'cache coupon list',
    );

    return mappedResult;
  }

  async getById(
    code: string,
    options?: { customerId?: string; isWeb?: boolean },
  ) {
    const result = await this.prisma.discount.findUnique({
      where: { code: code.trim() },
      include: {
        createdByCustomer: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException('Coupon not found');
    }

    if (options?.isWeb) {
      if (result.createdBy && result.createdBy !== options.customerId) {
        throw new NotFoundException('Coupon not found');
      }
      if (result.createdBy && result.usedCount > 0) {
        throw new NotFoundException('Coupon not found');
      }
      if (options.customerId) {
        const isPending = await this.prisma.orderRequest.findFirst({
          where: {
            customerId: options.customerId,
            status: { in: ['SEARCHING_FRANCHISE', 'PROPOSAL_SENT'] },
            discountCode: result.code,
          },
        });
        if (isPending) {
          throw new BadRequestException(
            'Coupon is currently in use in a pending order request',
          );
        }
      }
    }

    const { createdByCustomer, ...rest } = result as any;
    return {
      ...rest,
      createdBy: createdByCustomer
        ? {
            id: createdByCustomer.id,
            name: createdByCustomer.name,
            email: createdByCustomer.user?.email,
          }
        : null,
    };
  }

  async create(user: JwtUser, dto: CreateCouponDto, ip: string) {
    const code = this.normalizeCode(dto.code);

    if (
      dto.type === DiscountType.BUY_X_GET_Y &&
      dto.scope === DiscountScope.SHIPPING
    ) {
      throw new BadRequestException(
        'BUY_X_GET_Y is not valid for shipping scope',
      );
    }

    try {
      const result = await this.prisma.discount.create({
        data: {
          name: dto.name.trim(),
          code,
          type: dto.type,
          scope: dto.scope,
          value: new Prisma.Decimal(dto.value),
          minOrderAmount: this.toDecimal(dto.minOrderAmount),
          maxDiscountAmount: this.toDecimal(dto.maxDiscountAmount),
          usageLimit: dto.usageLimit,
          active: dto.active ?? true,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        },
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'CREATE',
          resource: 'COUPON',
          resourceId: result.id,
          metadata: { coupon: JSON.stringify(result) },
          ip,
        }),
        'COUPON_CREATE',
      );

      fireAndForget(
        this.redisService.clearCacheByPrefix('coupon:'),
        'coupon create',
      );

      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Coupon code already exists');
      }

      throw error;
    }
  }

  async update(user: JwtUser, id: string, dto: UpdateCouponDto, ip: string) {
    const row = await this.prisma.discount.findUnique({ where: { id } });

    if (!row) {
      throw new NotFoundException('Coupon not found');
    }

    if (row.createdBy && row.createdBy !== user.customerId) {
      throw new BadRequestException(
        "Coupon is created by customer using loyalty point can't edit it",
      );
    }

    if (
      dto.type === DiscountType.BUY_X_GET_Y &&
      dto.scope === DiscountScope.SHIPPING
    ) {
      throw new BadRequestException(
        'BUY_X_GET_Y is not valid for shipping scope',
      );
    }

    try {
      const result = await this.prisma.discount.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          code:
            dto.code === undefined ? undefined : this.normalizeCode(dto.code),
          type: dto.type,
          scope: dto.scope,
          value:
            dto.value !== undefined ? new Prisma.Decimal(dto.value) : undefined,
          minOrderAmount:
            dto.minOrderAmount !== undefined
              ? this.toDecimal(dto.minOrderAmount)
              : undefined,
          maxDiscountAmount:
            dto.maxDiscountAmount !== undefined
              ? this.toDecimal(dto.maxDiscountAmount)
              : undefined,
          usageLimit: dto.usageLimit,
          active: dto.active,
          startsAt:
            dto.startsAt === undefined
              ? undefined
              : dto.startsAt
                ? new Date(dto.startsAt)
                : null,
          endsAt:
            dto.endsAt === undefined
              ? undefined
              : dto.endsAt
                ? new Date(dto.endsAt)
                : null,
        },
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'UPDATE',
          resource: 'COUPON',
          resourceId: result.id,
          metadata: { from: JSON.stringify(row), to: JSON.stringify(result) },
          ip,
        }),
        'COUPON_UPDATE',
      );

      fireAndForget(
        this.redisService.clearCacheByPrefix('coupon:'),
        'coupon update',
      );

      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Coupon code already exists');
      }

      throw error;
    }
  }

  async remove(@CurrentUser() user: JwtUser, id: string, ip: string) {
    const row = await this.prisma.discount.findUnique({ where: { id } });

    if (!row) {
      throw new NotFoundException('Coupon not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.discountUsage.deleteMany({ where: { discountId: id } });
      await tx.discount.delete({ where: { id } });
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'DELETE',
        resource: 'COUPON',
        resourceId: id,
        metadata: { deleted: JSON.stringify(row) },
        ip,
      }),
      'COUPON_CREATE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('coupon:'),
      'coupon remove',
    );

    return { ok: true };
  }
}
