import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NoticeAudience, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import { franchiseHasReadAccess } from '../common/franchise-roles';
import { CreateFranchiseNoticeDto } from './dto/create-franchise-notice.dto';
import { NoticeQueryDto } from './dto/franchise-notice-query.dto';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { buildPrismaDateRangeFilter } from 'src/products/utils/range-filter.util';
import { NoticeQueue } from './queues/notice.queue';
import { AuditService } from '../audit/audit.service';
import { NOTICE_JOB } from './constants/notice.constants';
import { chunkArray } from './utils/chunk.util';
import { randomUUID } from 'crypto';

@Injectable()
export class FranchiseNoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly noticeQueue: NoticeQueue,
    private readonly audit: AuditService,
  ) {}

  private buildNoticeSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['publishedAt', 'title'], 'publishedAt');

  private async resolveTargetFranchiseIds(dto: CreateFranchiseNoticeDto) {
    const franchiseIds = dto.franchiseIds
      ?.map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (franchiseIds?.length) {
      const uniqueFranchiseIds = [...new Set(franchiseIds)];
      const existingFranchises = await this.prisma.franchise.findMany({
        where: { id: { in: uniqueFranchiseIds } },
        select: { id: true },
      });

      if (existingFranchises.length !== uniqueFranchiseIds.length) {
        throw new NotFoundException('One or more franchises not found');
      }

      return uniqueFranchiseIds;
    }

    if (dto.audience === NoticeAudience.ALL_FRANCHISES) {
      const allFranchises = await this.prisma.franchise.findMany({
        select: { id: true },
      });

      if (allFranchises.length === 0) {
        throw new BadRequestException('No franchises found');
      }

      return allFranchises.map((franchise) => franchise.id);
    }

    throw new BadRequestException('franchiseIds is required for this audience');
  }

  // Notifications are handled asynchronously by the NoticeProcessor worker.
  // This avoids doing user lookups and queueing inside the HTTP request lifecycle.

  async create(dto: CreateFranchiseNoticeDto, user: JwtUser, ip?: string) {
    // if (user.role !== Role.SUPERADMIN) {
    //   throw new ForbiddenException();
    // }
    if (
      dto.audience === NoticeAudience.SINGLE_FRANCHISE &&
      (!dto.franchiseIds || dto.franchiseIds.length === 0)
    ) {
      throw new BadRequestException(
        'franchiseIds is required for single-franchise notices',
      );
    }
    const targetFranchiseIds = await this.resolveTargetFranchiseIds(dto);
    const title = dto.title.trim();
    const body = dto.body.trim();

    // ALL_FRANCHISES: create a single notice row and enqueue a global job.
    if (dto.audience === NoticeAudience.ALL_FRANCHISES) {
      const notice = await this.prisma.franchiseNotice.create({
        data: {
          title,
          body,
          audience: NoticeAudience.ALL_FRANCHISES,
          franchiseId: null,
          createdByUserId: user.sub,
        },
        include: {
          createdBy: { select: { email: true } },
        },
      });

      try {
        await this.audit.log({
          userId: user.sub,
          action: 'franchise_notice.create_global',
          resource: 'FranchiseNotice',
          resourceId: notice.id,
          metadata: { title: notice.title },
          ip: ip ?? null,
        });
      } catch (err) {
        // Ignore or log
      }

      // Enqueue background job to deliver the notice to all franchise users
      await this.noticeQueue.add(NOTICE_JOB.SEND_GLOBAL, {
        noticeId: notice.id,
        title,
        body,
      });

      return notice;
    }

    // SINGLE_FRANCHISE: create per-franchise notice rows in safe chunks using createMany
    // We generate stable ids for each notice so that downstream workers can reference them.
    const mapping = targetFranchiseIds.map((franchiseId) => ({
      franchiseId,
      noticeId: randomUUID(),
    }));

    const chunks = chunkArray(mapping, 500);
    let total = 0;
    for (const chunk of chunks) {
      const data = chunk.map((m) => ({
        id: m.noticeId,
        title,
        body,
        audience: NoticeAudience.SINGLE_FRANCHISE,
        franchiseId: m.franchiseId,
        createdByUserId: user.sub,
      }));

      // createMany is efficient and avoids large transactions; doing it per-chunk
      // keeps memory and transaction sizes bounded.
      const res = await this.prisma.franchiseNotice.createMany({ data });
      total += res.count ?? data.length;
    }

    try {
      await this.audit.log({
        userId: user.sub,
        action: 'franchise_notice.create_franchise',
        resource: 'FranchiseNotice',
        resourceId: null,
        metadata: {
          title,
          count: targetFranchiseIds.length,
          franchiseIds: targetFranchiseIds,
        },
        ip: ip ?? null,
      });
    } catch (err) {
      // Ignore or log
    }

    // enqueue background job to deliver notifications for these franchise notices
    await this.noticeQueue.add(NOTICE_JOB.SEND_FRANCHISE, {
      mapping,
      title,
      body,
    });

    return { created: total };
  }

  async list(query: NoticeQueryDto) {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { body: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.audience) {
      clauses.push({ audience: q.audience });
    }

    // if (query.franchiseId) {
    //   clauses.push({ franchise: { id: q.franchiseId } });
    // }

    if (query.fromPublishedAt || query.toPublishedAt) {
      const publishedAt = buildPrismaDateRangeFilter({
        fromDate: q.fromPublishedAt,
        toDate: q.toPublishedAt,
      });
      if (publishedAt) {
        clauses.push({ publishedAt });
      }
    }

    if (query.franchiseId) {
      if (query.includeGlobal) {
        clauses.push({
          OR: [{ franchiseId: query.franchiseId }, { franchiseId: null }],
        });
      } else {
        clauses.push({ franchiseId: query.franchiseId });
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildNoticeSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.franchiseNotice as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        franchise: { select: { id: true, name: true, code: true } },
        createdBy: { select: { email: true } },
        _count: { select: { reads: true } },
      },
    });

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;

    // return this.prisma.franchiseNotice.findMany({
    //   orderBy: { publishedAt: 'desc' },
    //   take: 200,
    //   include: {
    //     franchise: { select: { id: true, name: true, code: true } },
    //     createdBy: { select: { email: true } },
    //     _count: { select: { reads: true } },
    //   },
    // });
  }

  // async listForFranchiseUser(user: JwtUser, query: FranchiseNoticeQueryDto) {
  //   if (!franchiseHasReadAccess(user.role) || !user.franchiseId) {
  //     return [];
  //   }
  //   const fid = user.franchiseId;
  //   return this.prisma.franchiseNotice.findMany({
  //     where: {
  //       OR: [
  //         { audience: NoticeAudience.ALL_FRANCHISES },
  //         { audience: NoticeAudience.SINGLE_FRANCHISE, franchiseId: fid },
  //       ],
  //     },
  //     orderBy: { publishedAt: 'desc' },
  //     take: 100,
  //     include: {
  //       reads: { where: { userId: user.sub }, select: { readAt: true } },
  //       createdBy: { select: { email: true } },
  //     },
  //   });
  // }

  async markRead(id: string, user: JwtUser) {
    const notice = await this.prisma.franchiseNotice.findUnique({
      where: { id },
    });

    if (!notice) throw new NotFoundException('Notice not found');

    const visible =
      notice.audience === NoticeAudience.ALL_FRANCHISES ||
      (notice.audience === NoticeAudience.SINGLE_FRANCHISE &&
        [user.franchiseId, user.franchiseOwnerId].includes(
          notice.franchiseId ?? '',
        ));

    if (!visible) throw new NotFoundException('Notice not found');

    if (user.role === Role.FRANCHISE_STAFF) {
      if (user.franchiseOwnerId) {
        const franchiseOwner = await this.prisma.user.findUnique({
          where: { id: user.franchiseOwnerId },
          select: {
            id: true,
            franchiseId: true,
          },
        });

        if (franchiseOwner) {
          user.sub = franchiseOwner.id;
        }
      }
    }

    return this.prisma.franchiseNoticeRead.upsert({
      where: { noticeId_userId: { noticeId: id, userId: user.sub } },
      create: { noticeId: id, userId: user.sub },
      update: { readAt: new Date() },
    });
  }
}
