import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update.attribute.dto';
import { AttributeQueryDto, SortBy } from './dto/attribute-query.dto';
import {
  paginatePrisma,
  buildSearchFilter,
  buildSortOrder,
  PaginationResult,
} from 'src/common/utils/pagination.util';
import { generateSlug } from 'src/common/utils/generate-slug-sku.util';
import { OrderType } from 'src/common/dto/query.dto';
import { AuditService } from 'src/audit/audit.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';

export interface IAttributeValue {
  id?: string;
  title: string;
  slug: string;
  attributeNameId: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAttributeNameValue {
  id: string;
  title: string;
  slug: string;
  isActive?: boolean;
  values?: IAttributeValue[];
}

@Injectable()
export class AttributesService {
  private static readonly CACHE_KEY = 'attributes';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly audit: AuditService,
  ) {}

  async create(
    user: JwtUser,
    dto: CreateAttributeDto,
    ip: string,
  ): Promise<IAttributeNameValue> {
    const slug = generateSlug(dto.title);

    const created = await this.prisma.$transaction(async (tx) => {
      const attribute = await tx.attributeName.create({
        data: {
          title: dto.title,
          slug,
        },
      });

      if (dto.values && dto.values.length > 0) {
        const valuesData = dto.values.map((v) => ({
          title: v.title,
          slug: generateSlug(v.title),
          attributeNameId: attribute.id,
        }));

        await tx.attributeValue.createMany({ data: valuesData });
      }

      const result = await tx.attributeName.findUnique({
        where: { id: attribute.id },
        include: { values: true },
      });

      return result as unknown as IAttributeNameValue;
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'CREATE_ATTRIBUTE',
        resource: 'Attribute',
        resourceId: created.id,
        metadata: {
          role: user.role,
          title: created.title,
          slug: created.slug,
        },
        ip,
      }),
      'CREATE_ATTRIBUTE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix(AttributesService.CACHE_KEY),
      'clear attributes cache',
    );
    return created;
  }

  async findAll(query: AttributeQueryDto): Promise<{
    data: IAttributeNameValue[];
    meta: PaginationResult<IAttributeNameValue>['meta'];
  }> {
    const cacheKey = `${AttributesService.CACHE_KEY}:list:${JSON.stringify(query)}`;

    let cached: any = null;
    try {
      cached = await this.redisService.get<{
        data: IAttributeNameValue[];
        meta: any;
      }>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const {
      sortBy = SortBy.CREATED_AT,
      order,
      search,
      page = 1,
      limit = 10,
    } = query as any;

    const where = buildSearchFilter(search, ['title', 'slug']);

    const orderBy = buildSortOrder(
      sortBy as string,
      order as OrderType,
      ['createdAt'],
      'createdAt',
    );

    const res = await paginatePrisma<IAttributeNameValue>({
      model: this.prisma.attributeName,
      where,
      orderBy,
      page,
      limit,
      include: { values: true },
    });

    const result = { data: res.data as IAttributeNameValue[], meta: res.meta };
    fireAndForget(
      this.redisService.set(cacheKey, result),
      'set attributes list cache',
    );
    return result;
  }

  async findOne(attributeId: string): Promise<IAttributeNameValue> {
    const cacheKey = `${AttributesService.CACHE_KEY}:id:${attributeId}`;
    let cached: any = null;
    try {
      cached = await this.redisService.get<IAttributeNameValue>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const attribute = await this.prisma.attributeName.findUnique({
      where: { id: attributeId },
      include: { values: true },
    });

    if (!attribute) throw new NotFoundException('Attribute not found');

    fireAndForget(
      this.redisService.set(cacheKey, attribute),
      'set attribute details cache',
    );
    return attribute as unknown as IAttributeNameValue;
  }

  async findBySlug(slug: string): Promise<IAttributeNameValue> {
    const cacheKey = `${AttributesService.CACHE_KEY}:slug:${slug}`;
    let cached: any = null;
    try {
      cached = await this.redisService.get<IAttributeNameValue>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const attribute = await this.prisma.attributeName.findUnique({
      where: { slug },
      include: { values: true },
    });

    if (!attribute) throw new NotFoundException('Attribute not found');

    fireAndForget(
      this.redisService.set(cacheKey, attribute),
      'set attribute slug cache',
    );
    return attribute as unknown as IAttributeNameValue;
  }

  async findOneValueById(attributeValueId: string): Promise<IAttributeValue> {
    const cacheKey = `${AttributesService.CACHE_KEY}:valueId:${attributeValueId}`;
    let cached: any = null;
    try {
      cached = await this.redisService.get<IAttributeValue>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }
    if (cached) return cached;

    const attributeValue = await this.prisma.attributeValue.findUnique({
      where: { id: attributeValueId },
    });

    if (!attributeValue)
      throw new NotFoundException('Attribute value not found');

    fireAndForget(
      this.redisService.set(cacheKey, attributeValue),
      'set attribute value cache',
    );
    return attributeValue as unknown as IAttributeValue;
  }

  async update(
    user: JwtUser,
    attributeId: string,
    dto: UpdateAttributeDto,
    ip: string,
  ): Promise<IAttributeNameValue> {
    const existing = await this.prisma.attributeName.findUnique({
      where: { id: attributeId },
      include: { values: true },
    });

    if (!existing) {
      throw new NotFoundException('Attribute not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // ✅ 1. Update attribute name (if needed)

      if (dto.title && dto.title !== existing.title) {
        await tx.attributeName.update({
          where: { id: attributeId },
          data: {
            title: dto.title,
            slug: generateSlug(dto.title),
          },
        });
      }

      // ✅ 2. Handle values (SMART SYNC)
      if (dto.values) {
        const incomingValues = dto.values.map((v) => ({
          title: v.title,
          slug: generateSlug(v.title),
        }));

        const incomingSlugs = incomingValues.map((v) => v.slug);

        const existingValues = await tx.attributeValue.findMany({
          where: { attributeNameId: attributeId },
        });

        const existingSlugMap = new Map<
          string,
          (typeof existingValues)[number]
        >(existingValues.map((v: any) => [v.slug, v]));

        // A. DELETE values that are removed (but ONLY if not used)
        const valuesToDelete = existingValues.filter(
          (v: IAttributeValue) => !incomingSlugs.includes(v.slug),
        );

        for (const val of valuesToDelete) {
          const usageCount = await tx.variantAttribute.count({
            where: { attributeValueId: val.id },
          });

          if (usageCount > 0) {
            throw new BadRequestException(
              `Cannot delete "${val.title}" because it is used in variants`,
            );
          }
        }

        if (valuesToDelete.length) {
          await tx.attributeValue.deleteMany({
            where: {
              id: { in: valuesToDelete.map((v: IAttributeValue) => v.id) },
            },
          });
        }

        // B. UPSERT (update existing OR create new)
        for (const val of incomingValues) {
          if (existingSlugMap.has(val.slug)) {
            // update title if needed
            await tx.attributeValue.update({
              where: {
                id: existingSlugMap.get(val.slug)!.id,
              },
              data: {
                title: val.title,
              },
            });
          } else {
            // create new
            await tx.attributeValue.create({
              data: {
                title: val.title,
                slug: val.slug,
                attributeNameId: attributeId,
              },
            });
          }
        }
      }

      // 3. Return final result
      const final = await tx.attributeName.findUnique({
        where: { id: attributeId },
        include: { values: true },
      });

      return final as unknown as IAttributeNameValue;
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'UPDATE_ATTRIBUTE',
        resource: 'Attribute',
        resourceId: updated.id,
        metadata: {
          from: JSON.stringify(existing),
          to: JSON.stringify(updated),
        },
        ip,
      }),
      'UPDATE_ATTRIBUTE',
    );

    // 4. Clear cache
    fireAndForget(
      this.redisService.clearCacheByPrefix(AttributesService.CACHE_KEY),
      'clear attributes cache',
    );

    return updated;
  }

  async updateValue(user: JwtUser, valueId: string, title: string, ip: string) {
    const updated = await this.prisma.attributeValue.update({
      where: { id: valueId },
      data: {
        title,
        slug: generateSlug(title),
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'UPDATE_ATTRIBUTE_VALUE',
        resource: 'Attribute',
        resourceId: updated.id,
        metadata: {
          role: user.role,
          title: updated.title,
          slug: updated.slug,
        },
        ip,
      }),
      'UPDATE_ATTRIBUTE',
    );

    // 4. Clear cache
    fireAndForget(
      this.redisService.clearCacheByPrefix(AttributesService.CACHE_KEY),
      'clear attributes cache',
    );

    return updated;
  }

  async delete(
    user: JwtUser,
    attributeId: string,
    ip: string,
  ): Promise<IAttributeNameValue> {
    const attribute = await this.prisma.attributeName.findUnique({
      where: { id: attributeId },
      include: { values: true },
    });
    if (!attribute) throw new NotFoundException('Attribute not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.attributeValue.deleteMany({
        where: { attributeNameId: attributeId },
      });
      await tx.attributeName.delete({ where: { id: attributeId } });
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'DELETE_ATTRIBUTE',
        resource: 'Attribute',
        resourceId: attributeId,
        metadata: {
          role: user.role,
          title: attribute.title,
          slug: attribute.slug,
        },
        ip,
      }),
      'DELETE_ATTRIBUTE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix(AttributesService.CACHE_KEY),
      'clear attributes cache',
    );
    return attribute as unknown as IAttributeNameValue;
  }
}
