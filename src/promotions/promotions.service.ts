import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionsQueryDto } from './dto/promotions-query.dto';
import { OrderType } from 'src/common/dto/query.dto';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { buildPrismaDateRangeFilter } from 'src/products/utils/range-filter.util';
import { generateSlug } from 'src/common/utils/generate-slug-sku.util';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { NotificationType } from 'src/notification/enums/notification-type.enum';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { fireAndForget } from 'src/common/utils/fireForgot.util';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleBasedNotificationService: RoleBasedNotificationService,
    private readonly audit: AuditService,
  ) { }
  private buildPromotionSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'startsAt', 'endsAt', 'name']);

  async list(query: PromotionsQueryDto) {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.percentOff !== null && query.percentOff !== undefined) {
      clauses.push({
        percentOff: q.percentOff,
      });
    }

    if (query.active !== null && query.active !== undefined) {
      clauses.push({
        active: q.active.includes('true') ? true : false,
      });
    }

    if (query.applyToAll !== null && query.applyToAll !== undefined) {
      clauses.push({
        applyToAll: q.applyToAll.includes('true') ? true : false,
      });
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

    if (query.startsAt || q.lastDate) {
      const startsAt = buildPrismaDateRangeFilter({
        fromDate: q.startsAt,
        toDate: q.lastDate,
      });
      if (startsAt) {
        clauses.push({ startsAt });
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildPromotionSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.promotion as any,
      where,
      orderBy,
      page,
      limit,
      include: { promotionProducts: { select: { productId: true } } },
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

    // return this.prisma.promotion.findMany({
    //   orderBy: { createdAt: 'desc' },
    //   include: { promotionProducts: { select: { productId: true } } },
    // });
  }

  async create(user: JwtUser, dto: CreatePromotionDto, ip: string) {
    const applyToAll =
      dto.applyToAll === undefined
        ? true
        : dto.applyToAll === BooleanEnum.TRUE;
    if (!applyToAll && (!dto.productIds || dto.productIds.length === 0)) {
      throw new BadRequestException(
        'When applyToAll is false, provide at least one productId',
      );
    }
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const uniqueSlug = dto.slug
          ? dto.slug
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with "-"
            .replace(/-+/g, '-') // collapse multiple "-"
            .replace(/^-+|-+$/g, '') // trim leading/trailing "-"
          : generateSlug(dto.name);

        const row = await tx.promotion.create({
          data: {
            name: dto.name,
            slug: uniqueSlug,
            description: dto.description,
            percentOff: new Prisma.Decimal(dto.percentOff),
            active:
              dto.active === undefined
                ? true
                : dto.active === BooleanEnum.TRUE,
            applyToAll,
            startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
            endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          },
        });
        if (dto.productIds?.length) {
          const uniq = [...new Set(dto.productIds)];
          await tx.promotionProduct.createMany({
            data: uniq.map((productId) => ({ promotionId: row.id, productId })),
            skipDuplicates: true,
          });
        }
        return tx.promotion.findUnique({
          where: { id: row.id },
          include: { promotionProducts: { select: { productId: true } } },
        });
      });

      if (result) {
        fireAndForget(
          this.audit.log({
            userId: user.sub,
            action: 'CREATE_PROMOTION',
            resource: 'Promotion',
            resourceId: result.id,
            metadata: {
              created: JSON.stringify(result),
            },
            ip,
          }),
          'CREATE_PROMOTION',
        );

        if (result.active) {
          void this.roleBasedNotificationService.notifyAllCustomers(
            'New Promotion Available!',
            `A new promotion "${result.name}" has been published! Check out the offers.`,
            NotificationType.SYSTEM,
            { promotionId: result.id, slug: result.slug },
          );
        }
      }

      return result;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Slug already used');
      }
      throw e;
    }
  }

  async update(
    user: JwtUser,
    id: string,
    dto: UpdatePromotionDto,
    ip: string,
  ) {
    const row = await this.prisma.promotion.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Promotion not found');
    }
    if (
      dto.applyToAll === BooleanEnum.FALSE &&
      dto.productIds !== undefined &&
      dto.productIds.length === 0
    ) {
      throw new BadRequestException(
        'When applyToAll is false, provide at least one productId',
      );
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.promotion.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          percentOff:
            dto.percentOff != null
              ? new Prisma.Decimal(dto.percentOff)
              : undefined,
          active:
            dto.active === undefined
              ? undefined
              : dto.active === BooleanEnum.TRUE,
          applyToAll:
            dto.applyToAll === undefined
              ? undefined
              : dto.applyToAll === BooleanEnum.TRUE,
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
      if (dto.productIds !== undefined) {
        await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
        const uniq = [...new Set(dto.productIds)];
        if (uniq.length) {
          await tx.promotionProduct.createMany({
            data: uniq.map((productId) => ({ promotionId: id, productId })),
            skipDuplicates: true,
          });
        }
      }
      return tx.promotion.findUnique({
        where: { id: updated.id },
        include: { promotionProducts: { select: { productId: true } } },
      });
    });

    if (result) {
      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'PROMOTION_UPDATE',
          resource: 'Promotion',
          resourceId: result.id,
          metadata: {
            name: result.name,
            active: result.active,
            applyToAll: result.applyToAll,
            startsAt: result.startsAt,
            endsAt: result.endsAt,
          },
          ip,
        }),
        'PROMOTION_UPDATE',
      );

      if (result.active && !row.active) {
        void this.roleBasedNotificationService.notifyAllCustomers(
          'New Promotion Available!',
          `A new promotion "${result.name}" has been published! Check out the offers.`,
          NotificationType.SYSTEM,
          { promotionId: result.id, slug: result.slug },
        );
      }
    }

    return result;
  }

  async remove(user: JwtUser, id: string, ip: string) {
    const row = await this.prisma.promotion.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Promotion not found');
    }

    await this.prisma.promotion.delete({ where: { id } });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'PROMOTION_DELETE',
        resource: 'Promotion',
        resourceId: row.id,
        metadata: {
          deleted: JSON.stringify(row),
        },
        ip,
      }),
      'PROMOTION_DELETE',
    );

    return { ok: true };
  }
}
