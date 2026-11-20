import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransportLane } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { AuditService } from '../audit/audit.service';
import { TransportLaneQueryDto } from './dto/transport-lane-query.dto';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';

@Injectable()
export class TransportLanesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private buildTransportLaneSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'name', 'allocationPriority']);

  async list(
    user: JwtUser,
    query: TransportLaneQueryDto,
  ): Promise<{ data: TransportLane[]; meta: IMeta }> {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
          OR: [
            {
              name: { contains: search, mode: 'insensitive' },
            },
            // {
            //   franchise: {
            //     name: { contains: search, mode: 'insensitive' },
            //   },
            // },
          ],
        }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.active !== null && query.active !== undefined) {
      clauses.push({
        active: query.active.includes('true') ? true : false,
      });
    }

    if (query.originNodeId) {
      clauses.push({ originNodeId: q.originNodeId });
    }

    if (query.destNodeId) {
      clauses.push({ destNodeId: q.destNodeId });
    }

    if (query.allocationPriority !== undefined) {
      clauses.push({ allocationPriority: query.allocationPriority });
    }

    // if (user.role !== Role.SUPERADMIN) {
    //   clauses.push({ franchise: { id: user.franchiseId } });
    // }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildTransportLaneSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.transportLane as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        originNode: {
          select: { id: true, code: true, name: true, type: true },
        },
        destNode: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;

    // return this.prisma.transportLane.findMany({
    //   orderBy: [{ allocationPriority: 'desc' }, { code: 'asc' }],
    //   include: {
    //     originNode: {
    //       select: { id: true, code: true, name: true, type: true },
    //     },
    //     destNode: { select: { id: true, code: true, name: true, type: true } },
    //   },
    // });
  }

  async create(
    data: {
      code: string;
      name: string;
      originNodeId: string;
      destNodeId: string;
      defaultSlaHours?: number;
      allocationPriority?: number;
    },
    actor?: { userId: string; ip?: string | null },
  ) {
    if (data.originNodeId === data.destNodeId) {
      throw new BadRequestException('Origin and destination must differ');
    }
    const [a, b] = await Promise.all([
      this.prisma.stockingNode.findUnique({ where: { id: data.originNodeId } }),
      this.prisma.stockingNode.findUnique({ where: { id: data.destNodeId } }),
    ]);
    if (!a || !b) throw new BadRequestException('Unknown stocking node');
    try {
      const lane = await this.prisma.transportLane.create({
        data: {
          code: data.code.trim(),
          name: data.name.trim(),
          originNodeId: data.originNodeId,
          destNodeId: data.destNodeId,
          defaultSlaHours: data.defaultSlaHours ?? 72,
          allocationPriority: data.allocationPriority ?? 0,
        },
        include: {
          originNode: {
            select: { id: true, code: true, name: true, type: true },
          },
          destNode: {
            select: { id: true, code: true, name: true, type: true },
          },
        },
      });

      if (actor) {
        await this.audit.log({
          userId: actor.userId,
          action: 'transport_lane.create',
          resource: 'SupplyChain',
          resourceId: lane.id,
          metadata: {
            code: lane.code,
            name: lane.name,
            originNodeId: lane.originNodeId,
            destNodeId: lane.destNodeId,
          },
          ip: actor.ip,
        });
      }

      return lane;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('Lane code already exists');
      }
      throw e;
    }
  }

  async get(id: string) {
    const row = await this.prisma.transportLane.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lane not found');
    return row;
  }
}
