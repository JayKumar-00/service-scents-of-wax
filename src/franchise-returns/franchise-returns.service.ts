import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { FranchiseReturnStatus, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import {
  franchiseCanMutate,
  franchiseHasReadAccess,
} from '../common/franchise-roles';
import { CreateFranchiseReturnDto } from './dto/create-franchise-return.dto';
import { UpdateFranchiseReturnDto } from './dto/update-franchise-return.dto';
import { FranchiseReturnQueryDto } from './dto/franchise-return-query.dto';
import { buildPrismaDateRangeFilter } from 'src/products/utils/range-filter.util';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';

@Injectable()
export class FranchiseReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private buildFranchiseReturnSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'status']);

  async list(user: JwtUser, query: FranchiseReturnQueryDto) {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
          OR: [
            {
              reason: { contains: search, mode: 'insensitive' },
            },
            {
              franchise: {
                name: { contains: search, mode: 'insensitive' },
                code: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.franchiseId !== null && q.franchiseId !== undefined) {
      clauses.push({
        franchise: { franchise: { id: q.franchiseId } },
      });
    }

    if (query.status) {
      clauses.push({ status: q.status });
    }

    if (query.orderStatus) {
      clauses.push({ order: { status: q.orderStatus } });
    }

    if (query.refundRequested !== null && query.refundRequested !== undefined) {
      clauses.push({
        refundRequested: q.refundRequested.includes('true') ? true : false,
      });
    }

    if (query.refundRequested !== null && query.refundRequested !== undefined) {
      clauses.push({ carrier: { contains: q.carrier, mode: 'insensitive' } });
    }

    if (user.role !== Role.SUPERADMIN && franchiseHasReadAccess(user.role)) {
      clauses.push({ franchise: { id: user.franchiseId } });
    }

    if (query.fromDate || q.lastDate) {
      const createdAt = buildPrismaDateRangeFilter({
        fromDate: q.fromDate,
        toDate: q.lastDate,
      });
      if (createdAt) {
        clauses.push({ createdAt });
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildFranchiseReturnSortOrder(q.sortBy, q.order);
    const include = Role.SUPERADMIN
      ? {
          franchise: { select: { id: true, name: true, code: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
        }
      : { order: { select: { id: true, orderNumber: true, status: true } } };

    const paged = await paginatePrisma<any>({
      model: this.prisma.franchiseReturn as any,
      where,
      orderBy,
      page,
      limit,
      include,
    });

    // paged.data = paged.data.map((p: any) =>
    //   this.mapProductResponse(this.applyAwsPrefixToProduct(p)),
    // );

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;

    // if (user.role === Role.SUPERADMIN) {
    //   return this.prisma.franchiseReturn.findMany({
    //     orderBy: { createdAt: 'desc' },
    //     take: 200,
    //     include: {
    //       franchise: { select: { id: true, name: true, code: true } },
    //       order: { select: { id: true, orderNumber: true, status: true } },
    //     },
    //   });
    // }
    // if (franchiseHasReadAccess(user.role)) {
    //   if (!user.franchiseId) return [];
    //   return this.prisma.franchiseReturn.findMany({
    //     where: { franchiseId: user.franchiseId },
    //     orderBy: { createdAt: 'desc' },
    //     include: {
    //       order: { select: { id: true, orderNumber: true, status: true } },
    //     },
    //   });
    // }
    // return [];
  }

  async create(
    dto: CreateFranchiseReturnDto,
    user: JwtUser,
    actor: { userId: string; ip?: string | null },
  ) {
    if (!franchiseCanMutate(user.role)) {
      throw new ForbiddenException();
    }
    if (!user.franchiseId) {
      throw new NotFoundException('No franchise linked');
    }
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
      });
      if (!order || order.franchiseId !== user.franchiseId) {
        throw new NotFoundException('Order not found for this outlet');
      }
    }
    const row = await this.prisma.franchiseReturn.create({
      data: {
        franchiseId: user.franchiseId,
        orderId: dto.orderId ?? null,
        reason: dto.reason,
        refundRequested: dto.refundRequested ?? false,
        status: FranchiseReturnStatus.PENDING,
      },
      include: {
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });
    fireAndForget(
      this.audit.log({
        userId: actor.userId,
        action: 'franchise_return.create',
        resource: 'FranchiseReturn',
        resourceId: row.id,
        metadata: {
          franchiseId: row.franchiseId,
          orderId: row.orderId,
          refundRequested: row.refundRequested,
        } as Prisma.InputJsonValue,
        ip: actor.ip,
      }),
      'franchise_return.create',
    );
    return row;
  }

  async update(
    id: string,
    dto: UpdateFranchiseReturnDto,
    actor: { userId: string; ip?: string | null },
  ) {
    const row = await this.prisma.franchiseReturn.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Return not found');
    }
    const updated = await this.prisma.franchiseReturn.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNote: dto.resolutionNote ?? undefined,
      },
      include: {
        franchise: { select: { id: true, name: true, code: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });
    fireAndForget(
      this.audit.log({
        userId: actor.userId,
        action: 'franchise_return.update',
        resource: 'FranchiseReturn',
        resourceId: id,
        metadata: {
          status: dto.status,
          resolutionNote: dto.resolutionNote ?? null,
          franchiseId: row.franchiseId,
        } as Prisma.InputJsonValue,
        ip: actor.ip,
      }),
      'franchise_return.update',
    );
    return updated;
  }
}
