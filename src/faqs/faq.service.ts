import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { FaqAudience, FaqStatus, Prisma, Role } from '@prisma/client';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { QueryDto } from 'src/common/dto/query.dto';
import {
  buildDateFilter,
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { buildPrismaTextSearchFilter } from 'src/common/utils/search.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { BooleanString, FaqQueryDto } from './dto/faq-query.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { RedisService } from 'src/redis/redis.service';
import {
  FaqItem,
  FaqListResult,
  FaqPaginationMeta,
} from './interfaces/faq.interface';
import { AuditService } from 'src/audit/audit.service';

type FaqMutationAction =
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'published'
  | 'unpublished';

@Injectable()
export class FaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly audit: AuditService,
  ) {}

  private readonly faqSelect = {
    id: true,
    question: true,
    answer: true,
    audience: true,
    status: true,
    isVisible: true,
    isDeleted: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.FaqSelect;

  private readonly sortableFields = [
    'createdAt',
    'updatedAt',
    'question',
    'status',
    'audience',
  ] as const;

  private toPaginationMeta(meta: {
    count: number;
    totalPages?: number;
    page?: number;
    limit?: number;
  }): FaqPaginationMeta {
    return {
      count: meta.count,
      total: meta.count,
      page: meta.page ?? 1,
      limit: meta.limit ?? 10,
      totalPages: meta.totalPages ?? 0,
    };
  }

  private buildSearchClause(
    search: string | undefined,
    fields: string[],
  ): Prisma.FaqWhereInput | Record<string, never> {
    const searchFilter = buildPrismaTextSearchFilter(search, fields);
    return Object.keys(searchFilter).length > 0 ? searchFilter : {};
  }

  private buildListOrderBy(query?: Pick<FaqQueryDto, 'sortBy' | 'order'>) {
    return buildSortOrder(query?.sortBy, query?.order, [
      ...this.sortableFields,
    ]);
  }

  private mapBooleanString(value?: BooleanString): boolean | undefined {
    switch (value) {
      case BooleanString.TRUE:
        return true;
      case BooleanString.FALSE:
        return false;
      default:
        return undefined;
    }
  }

  private assertMutationAllowed(faq: FaqItem, user: JwtUser): void {
    if (user.role === Role.SUPERADMIN) {
      return;
    }

    if (faq.createdById !== user.sub) {
      throw new ForbiddenException('You are not allowed to modify this FAQ');
    }
  }

  private ensureFranchiseActor(user: JwtUser): void {
    if (
      user.role !== Role.FRANCHISE_OWNER &&
      user.role !== Role.FRANCHISE_STAFF
    ) {
      throw new ForbiddenException(
        'Only franchise users can access this resource',
      );
    }
  }

  private async findFaqOrThrow(
    id: string,
    where: Prisma.FaqWhereInput = {},
  ): Promise<FaqItem> {
    const faq = await this.prisma.faq.findFirst({
      where: {
        id,
        ...where,
      },
      select: this.faqSelect,
    });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    return faq;
  }

  private async runMutation(
    id: string,
    user: JwtUser,
    action: FaqMutationAction,
    data: Prisma.FaqUpdateInput,
    lookupWhere: Prisma.FaqWhereInput = { isDeleted: false },
  ): Promise<FaqItem> {
    const result = await this.prisma.$transaction(async (tx) => {
      const faq = await tx.faq.findFirst({
        where: {
          id,
          ...lookupWhere,
        },
        select: this.faqSelect,
      });

      if (!faq) {
        throw new NotFoundException('FAQ not found');
      }

      this.assertMutationAllowed(faq, user);

      if (action === 'restored' && !faq.isDeleted) {
        throw new NotFoundException('FAQ not found');
      }

      if (action !== 'restored' && faq.isDeleted) {
        throw new NotFoundException('FAQ not found');
      }

      const updated = await tx.faq.update({
        where: { id: faq.id },
        data,
        select: this.faqSelect,
      });

      return updated;
    });

    fireAndForget(
      this.redisService.clearCacheByPrefix('faqs:'),
      'faq mutation',
    );

    return result;
  }

  async create(user: JwtUser, dto: CreateFaqDto, ip: string): Promise<FaqItem> {
    const created = await this.prisma.faq.create({
      data: {
        question: dto.question.trim(),
        answer: dto.answer.trim(),
        audience: dto.audience ?? FaqAudience.ALL,
        isVisible: dto.isVisible ?? true,
        status: FaqStatus.DRAFT,
        createdById: user.sub,
      },
      select: this.faqSelect,
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'FAQ_CREATE',
        resource: 'Faq',
        resourceId: created.id,
        metadata: { created: JSON.stringify(created) },
        ip,
      }),
      'FAQ_CREATE',
    );

    fireAndForget(this.redisService.clearCacheByPrefix('faqs:'), 'faq create');

    return created;
  }

  async update(
    user: JwtUser,
    id: string,
    dto: UpdateFaqDto,
    ip: string,
  ): Promise<FaqItem> {
    const result = await this.runMutation(id, user, 'updated', {
      ...(dto.question !== undefined ? { question: dto.question.trim() } : {}),
      ...(dto.answer !== undefined ? { answer: dto.answer.trim() } : {}),
      ...(dto.audience !== undefined ? { audience: dto.audience } : {}),
      ...(dto.visibility !== undefined
        ? { isVisible: this.mapBooleanString(dto.visibility) ?? true }
        : {}),
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'FAQ_UPDATE',
        resource: 'Faq',
        resourceId: id,
        metadata: { updated: JSON.stringify(result) },
        ip,
      }),
      'FAQ_UPDATE',
    );

    return result;
  }

  async remove(user: JwtUser, id: string, ip: string): Promise<FaqItem> {
    const faq = await this.runMutation(id, user, 'deleted', {
      isDeleted: true,
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'FAQ_DELETE',
        resource: 'Faq',
        resourceId: id,
        metadata: { deleted: JSON.stringify(faq) },
        ip,
      }),
      'FAQ_DELETE',
    );
    return faq;
  }

  async restore(user: JwtUser, id: string): Promise<FaqItem> {
    return this.runMutation(
      id,
      user,
      'restored',
      {
        isDeleted: false,
      },
      { isDeleted: true },
    );
  }

  async publish(user: JwtUser, id: string): Promise<FaqItem> {
    return this.runMutation(id, user, 'published', {
      status: FaqStatus.PUBLISHED,
    });
  }

  async unpublish(user: JwtUser, id: string): Promise<FaqItem> {
    return this.runMutation(id, user, 'unpublished', {
      status: FaqStatus.DRAFT,
    });
  }

  async publicList(query: FaqQueryDto): Promise<FaqListResult> {
    const cacheKey = `faqs:list:${JSON.stringify(query)}`;
    try {
      const cached = await this.redisService.get<FaqListResult>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored for production resilience
    }

    const clauses: Prisma.FaqWhereInput[] = [
      {
        status: FaqStatus.PUBLISHED,
        isVisible: true,
        isDeleted: false,
      },
    ];

    const searchFilter = this.buildSearchClause(query.search, ['question']);
    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.audience) {
      clauses.push({ audience: query.audience });
    }

    const createdAtFilter = buildDateFilter(
      'createdAt',
      query.fromDate,
      query.lastDate,
    );
    if (Object.keys(createdAtFilter).length > 0) {
      clauses.push(createdAtFilter);
    }

    const visibility = this.mapBooleanString(query.visibility);
    if (visibility !== undefined) {
      clauses.push({ isVisible: visibility });
    }

    const deletion = this.mapBooleanString(query.deletion);
    if (deletion !== undefined) {
      clauses.push({ isDeleted: deletion });
    }

    const where = clauses.length > 1 ? { AND: clauses } : clauses[0];

    const paged = await paginatePrisma<FaqItem>({
      model: this.prisma.faq as any,
      where,
      orderBy: this.buildListOrderBy(query),
      page: query.page,
      limit: query.limit,
      select: this.faqSelect,
    });

    const result = {
      data: paged.data,
      meta: this.toPaginationMeta(paged.meta),
    };

    fireAndForget(
      this.redisService.set(cacheKey, result, 3600),
      'cache faq list',
    );

    return result;
  }

  async publicDetails(id: string): Promise<FaqItem> {
    const cacheKey = `faqs:detail:${id}`;
    try {
      const cached = await this.redisService.get<FaqItem>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored for production resilience
    }

    const details = await this.findFaqOrThrow(id, {
      status: FaqStatus.PUBLISHED,
      isVisible: true,
      isDeleted: false,
    });

    fireAndForget(
      this.redisService.set(cacheKey, details, 3600),
      'cache faq details',
    );

    return details;
  }

  async adminList(query: FaqQueryDto): Promise<FaqListResult> {
    const clauses: Prisma.FaqWhereInput[] = [];

    const searchFilter = this.buildSearchClause(query.search, [
      'question',
      'answer',
    ]);
    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.audience) {
      clauses.push({ audience: query.audience });
    }

    if (query.status) {
      clauses.push({ status: query.status });
    }

    const createdAtFilter = buildDateFilter(
      'createdAt',
      query.fromDate,
      query.lastDate,
    );
    if (Object.keys(createdAtFilter).length > 0) {
      clauses.push(createdAtFilter);
    }

    const visibility = this.mapBooleanString(query.visibility);
    if (visibility !== undefined) {
      clauses.push({ isVisible: visibility });
    }

    const deletion = this.mapBooleanString(query.deletion);
    if (deletion !== undefined) {
      clauses.push({ isDeleted: deletion });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const paged = await paginatePrisma<FaqItem>({
      model: this.prisma.faq as any,
      where,
      orderBy: this.buildListOrderBy(query),
      page: query.page,
      limit: query.limit,
      select: this.faqSelect,
    });

    return {
      data: paged.data,
      meta: this.toPaginationMeta(paged.meta),
    };
  }

  async franchiseList(
    user: JwtUser,
    query: FaqQueryDto,
  ): Promise<FaqListResult> {
    this.ensureFranchiseActor(user);

    const clauses: Prisma.FaqWhereInput[] = [
      {
        createdById: user.sub,
      },
    ];

    const searchFilter = this.buildSearchClause(query.search, ['question']);
    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.audience) {
      clauses.push({ audience: query.audience });
    }

    if (query.status) {
      clauses.push({ status: query.status });
    }

    const createdAtFilter = buildDateFilter(
      'createdAt',
      query.fromDate,
      query.lastDate,
    );
    if (Object.keys(createdAtFilter).length > 0) {
      clauses.push(createdAtFilter);
    }

    const visibility = this.mapBooleanString(query.visibility);
    if (visibility !== undefined) {
      clauses.push({ isVisible: visibility });
    }

    const deletion = this.mapBooleanString(query.deletion);
    if (deletion !== undefined) {
      clauses.push({ isDeleted: deletion });
    }

    const where = clauses.length > 1 ? { AND: clauses } : clauses[0];

    const paged = await paginatePrisma<FaqItem>({
      model: this.prisma.faq as any,
      where,
      orderBy: this.buildListOrderBy(query),
      page: query.page,
      limit: query.limit,
      select: this.faqSelect,
    });

    return {
      data: paged.data,
      meta: this.toPaginationMeta(paged.meta),
    };
  }
}
