import { Injectable, NotFoundException, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryQueryDto, SortBy } from './dto/category-query.dto';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { IFlatCategory } from './interfaces/category-list.interface';
import { buildPrismaTextSearchFilter } from 'src/common/utils/search.util';
import { OrderType } from 'src/common/dto/query.dto';
import { buildSortOrder } from 'src/common/utils/pagination.util';
import { RedisService } from 'src/redis/redis.service';
import { randomUUID } from 'crypto';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

export type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  level?: number;
  children: CategoryTreeNode[];
};

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private redisService: RedisService,
    private audit: AuditService,
  ) {}

  private buildCategorySortOrder = (
    sortBy: string,
    order: OrderType,
  ): Record<string, OrderType> => buildSortOrder(sortBy, order, ['name']);

  // async categoriesFlat(query: CategoryQueryDto): Promise<any[]> {
  //   const categories = await this.prisma.category.findMany({
  //     orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  //   });

  //   const tree = buildCategoryTree(categories); // step 1
  //   const result = addLevel(tree); // step 2

  //   return result;
  // }

  async categoriesFlat(
    query: CategoryQueryDto,
  ): Promise<{ data: IFlatCategory[]; meta: IMeta }> {
    const q = query ?? {};
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const cacheKey = `categories:flat:page=${page}:limit=${limit}:order=${
      q.order ?? ''
    }:sortBy=${q.sortBy ?? ''}:search=${encodeURIComponent(
      String(q.search ?? ''),
    )}:level=${q.level ?? ''}`;

    let cached: any = null;
    try {
      cached = await this.redisService.get<{
        data: IFlatCategory[];
        meta: IMeta;
      }>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const clauses: Record<string, unknown>[] = [];

    // text search using shared utility
    const searchFilter = buildPrismaTextSearchFilter(q.search, [
      'name',
      'slug',
    ]);

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const orderBy = this.buildCategorySortOrder(
      q.sortBy || SortBy.NAME,
      q.order || OrderType.DESC,
    );

    const categories = await this.prisma.category.findMany({
      where,
      orderBy: orderBy,
    });

    const map = new Map(categories.map((c) => [c.id, c]));

    const getLevel = (cat: any): number => {
      let level = 0;
      let current = cat;

      while (current && current.parentId) {
        level++;
        current = map.get(current.parentId);
      }

      return level;
    };

    let result = categories.map((cat) => ({
      ...cat,
      level: getLevel(cat),
    }));

    // apply level filter in-memory since DB doesn't store level
    if (q.level !== undefined && q.level !== null) {
      result = result.filter((r) => Number(r.level) === Number(q.level));
    }

    const total = result.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const start = (page - 1) * limit;
    const paged = result.slice(start, start + limit);

    const response = {
      data: paged,
      meta: {
        count: total,
        page,
        limit,
        totalPages,
      },
    };

    fireAndForget(
      this.redisService.set(cacheKey, response),
      'set categories flat cache',
    );

    return response;
  }

  async categoryTree(
    @Query() query: CategoryQueryDto,
  ): Promise<{ data: CategoryTreeNode[]; meta: IMeta }> {
    const q = query ?? {};
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const cacheKey = `categories:tree:page=${page}:limit=${limit}:order=${
      q.order ?? ''
    }:sortBy=${q.sortBy ?? ''}:search=${encodeURIComponent(
      String(q.search ?? ''),
    )}:level=${q.level ?? ''}`;

    let cached: any = null;
    try {
      cached = await this.redisService.get<{
        data: CategoryTreeNode[];
        meta: IMeta;
      }>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const clauses: Record<string, unknown>[] = [];

    // text search using shared utility
    const searchFilter = buildPrismaTextSearchFilter(q.search, [
      'name',
      'slug',
    ]);

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const orderBy = this.buildCategorySortOrder(
      q.sortBy || SortBy.NAME,
      q.order || OrderType.DESC,
    );

    const all = await this.prisma.category.findMany({
      where,
      orderBy: orderBy,
    });

    const map = new Map<string | null, typeof all>();
    for (const c of all) {
      const k = c.parentId;
      if (!map.has(k)) {
        map.set(k, []);
      }
      map.get(k)!.push(c);
    }

    const build = (parentId: string | null, level = 0): CategoryTreeNode[] => {
      const rows = map.get(parentId) ?? [];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        sortOrder: r.sortOrder,
        level,
        children: build(r.id, level + 1),
      }));
    };

    const tree = build(null, 0);

    // If level filter provided, collect nodes at that level (along with their subtrees)
    let nodes: CategoryTreeNode[] = [];
    if (q.level === undefined || q.level === null) {
      nodes = tree;
    } else {
      const target = Number(q.level);
      const collect = (nodesArr: CategoryTreeNode[]) => {
        for (const n of nodesArr) {
          if (n.level === target) {
            nodes.push(n);
          } else if ((n.children ?? []).length > 0) {
            collect(n.children);
          }
        }
      };
      collect(tree);
    }

    const total = nodes.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const start = (page - 1) * limit;
    const paged = nodes.slice(start, start + limit);

    const response = {
      data: paged,
      meta: {
        count: total,
        page,
        limit,
        totalPages,
      },
    };

    fireAndForget(
      this.redisService.set(cacheKey, response),
      'set categories tree cache',
    );

    return response;
  }

  async createCategory(
    user: JwtUser,
    dto: {
      name: string;
      slug: string;
      parentId?: string;
      sortOrder?: number;
    },
    ip: string,
  ) {
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }
    const created = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug: randomUUID(), // dto.slug.trim(),
        parentId: dto.parentId?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'CREATE',
        resource: 'Category',
        resourceId: created.id,
        metadata: {
          created: JSON.stringify(created),
        },
        ip,
      }),
      'CATEGORY_CREATE',
    );

    // invalidate category caches
    fireAndForget(
      this.redisService.clearCacheByPrefix('categories'),
      'category create cache clear',
    );

    return created;
  }

  async getCategoryBySlug(sl: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug: sl },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateCategory(
    user: JwtUser,
    id: string,
    dto: {
      name?: string;
      slug?: string;
      parentId?: string;
      sortOrder?: number;
    },
    ip: string,
  ) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    if (dto.parentId && dto.parentId === id) {
      throw new NotFoundException('Category cannot be its own parent');
    }
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }
    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.slug?.trim(),
        parentId: dto.parentId === '' ? null : dto.parentId,
        sortOrder: dto.sortOrder,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'UPDATE',
        resource: 'Category',
        resourceId: id,
        metadata: {
          from: JSON.stringify(existing),
          to: JSON.stringify(updated),
        },
        ip,
      }),
      'CATEGORY_CREATE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('categories:'),
      'category update',
    );

    return updated;
  }

  async deleteCategory(user: JwtUser, id: string, ip: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!existing) throw new NotFoundException('Category not found');
    if (existing._count.products > 0 || existing._count.children > 0) {
      throw new NotFoundException(
        'Cannot delete category with products or child categories',
      );
    }
    await this.prisma.category.delete({ where: { id } });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'DELETE',
        resource: 'Category',
        resourceId: existing.id,
        metadata: {
          deleted: JSON.stringify(existing),
        },
        ip,
      }),
      'CATEGORY_CREATE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('categories:'),
      'category delete',
    );

    return { ok: true };
  }
}
