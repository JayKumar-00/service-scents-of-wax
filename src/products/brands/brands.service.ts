import { Injectable, NotFoundException } from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { buildPrismaTextSearchFilter } from 'src/common/utils/search.util';
import {
  paginatePrisma,
  buildSortOrder,
} from 'src/common/utils/pagination.util';
import { OrderType } from 'src/common/dto/query.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { generateSlug } from 'src/common/utils/generate-slug-sku.util';
import { Brand } from '@prisma/client';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private redisService: RedisService,
    private audit: AuditService,
  ) {}

  private buildBrandSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'name']);

  async create(user: JwtUser, dto: CreateBrandDto, ip: string): Promise<Brand> {
    const uniqueSlug = dto.slug
      ? dto.slug
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with "-"
          .replace(/-+/g, '-') // collapse multiple "-"
          .replace(/^-+|-+$/g, '') // trim leading/trailing "-"
      : generateSlug(dto.name);

    const brand = await this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: uniqueSlug,
        description: dto?.description || `${dto.name} brand`,
        imageUrl: dto?.imageUrl || null,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'CREATE',
        resource: 'Brand',
        resourceId: brand.id,
        metadata: {
          role: user.role,
          name: brand.name,
          slug: brand.slug,
        },
        ip,
      }),
      'BRAND_CREATE',
    );

    // invalidate brand list caches
    fireAndForget(
      this.redisService.clearCacheByPrefix('brands:'),
      'clear brand list caches',
    );
    return brand;
  }

  async list(query?: any) {
    const q: any = query ?? {};

    const clauses: Record<string, unknown>[] = [];

    const searchFilter = buildPrismaTextSearchFilter(q.search, [
      'name',
      'slug',
    ]);

    if (Object.keys(searchFilter).length > 0) clauses.push(searchFilter);

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildBrandSortOrder(q.sortBy, q.order);

    const cacheKey = `brands:page=${page}:limit=${limit}:order=${q.order ?? ''}:sortBy=${q.sortBy ?? ''}:search=${encodeURIComponent(
      String(q.search ?? ''),
    )}`;

    let cached: any = null;
    try {
      cached = await this.redisService.get<any>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const result = await paginatePrisma<any>({
      model: this.prisma.brand as any,
      where,
      orderBy,
      page,
      limit,
    });

    fireAndForget(
      this.redisService.set(cacheKey, result),
      'set brand list cache',
    );

    return result;
  }

  async findBySlug(slug: string) {
    const cacheKey = `brand:slug:${slug}`;
    let cached: any = null;
    try {
      cached = await this.redisService.get<any>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const brand = await this.prisma.brand.findUnique({ where: { slug } });
    if (!brand) throw new NotFoundException('Brand not found');

    fireAndForget(
      this.redisService.set(cacheKey, brand),
      'set brand slug cache',
    );
    return brand;
  }

  async findById(id: string) {
    const cacheKey = `brand:${id}`;
    let cached: any = null;
    try {
      cached = await this.redisService.get<any>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');

    fireAndForget(this.redisService.set(cacheKey, brand), 'set brand id cache');
    return brand;
  }

  async update(
    user: JwtUser,
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description?: string;
      imageUrl?: string;
    }>,
    ip: string,
  ) {
    const existed = await this.findById(id);
    const brand = await this.prisma.brand.update({ where: { id }, data });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'UPDATE',
        resource: 'Brand',
        resourceId: brand.id,
        metadata: {
          from: JSON.stringify(existed),
          to: JSON.stringify(brand),
        },
        ip,
      }),
      'UPDATE_BRAND',
    );

    // invalidate caches for lists and this brand
    fireAndForget(
      Promise.all([
        this.redisService.clearCacheByPrefix('brands:'),
        this.redisService.del([`brand:${id}`, `brand:slug:${brand.slug}`]),
      ]),
      'invalidate updated brand cache',
    );

    return brand;
  }

  async delete(user: JwtUser, id: string, ip: string) {
    const result = await this.findById(id);
    await this.prisma.brand.delete({ where: { id } });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'DELETE',
        resource: 'Brand',
        resourceId: result.id,
        metadata: {
          role: user.role,
          name: result.name,
          slug: result.slug,
        },
        ip,
      }),
      'BRAND_DELETE',
    );

    // invalidate caches for lists and this brand
    fireAndForget(
      Promise.all([
        this.redisService.clearCacheByPrefix('brands:'),
        this.redisService.del([`brand:${id}`]),
      ]),
      'invalidate deleted brand cache',
    );

    return { success: true };
  }
}
