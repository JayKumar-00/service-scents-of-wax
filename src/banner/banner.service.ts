import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import {
  BannerPlatform,
  BannerRedirectType,
  BannerStatus,
  Prisma,
} from '@prisma/client';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildDateFilter,
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { BannerQueryDto } from './dto/banner-query.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';
import { UploadsService } from 'src/uploads/uploads.service';

@Injectable()
export class BannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly audit: AuditService,
    private readonly uploadsService: UploadsService,
  ) {}

  private readonly bannerSelect = {
    id: true,
    title: true,
    subTitle: true,
    description: true,
    type: true,
    imageUrl: true,
    mobileImageUrl: true,
    ctaText: true,
    redirectType: true,
    redirectId: true,
    redirectUrl: true,
    shortCode: true,
    platform: true,
    position: true,
    priority: true,
    startDate: true,
    endDate: true,
    clickCount: true,
    impressionCount: true,
    conversionCount: true,
    status: true,
    campaignId: true,
    archivedAt: true,
    createdById: true,
    updatedById: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.BannerSelect;

  private formatBannerUrls<
    T extends { imageUrl: string; mobileImageUrl?: string | null },
  >(banner: T): T {
    const prefix = process.env.AWS_PREFIX_URL;
    if (!prefix) return banner;

    const formatUrl = (url?: string | null) => {
      if (!url) return url;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      return `${prefix.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    };

    return {
      ...banner,
      imageUrl: formatUrl(banner.imageUrl) as string,
      mobileImageUrl: formatUrl(banner.mobileImageUrl) as
        | string
        | null
        | undefined,
    };
  }

  private sanitize(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private parseDate(value: string | undefined): Date | undefined {
    if (!value) {
      return undefined;
    }

    return new Date(value);
  }

  private validateSchedule(startDate?: Date, endDate?: Date): void {
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be greater than startDate');
    }
  }

  private validateRedirect(
    redirectType: BannerRedirectType,
    dto: {
      redirectId?: string;
      redirectUrl?: string;
    },
  ): void {
    if (redirectType === BannerRedirectType.URL && !dto.redirectUrl) {
      throw new BadRequestException(
        'redirectUrl is required when redirectType is URL',
      );
    }

    if (redirectType !== BannerRedirectType.URL && !dto.redirectId) {
      throw new BadRequestException(
        'redirectId is required for PRODUCT/BRAND/CATEGORY redirects',
      );
    }
  }

  private buildWhere(query: BannerQueryDto): Prisma.BannerWhereInput {
    const clauses: Prisma.BannerWhereInput[] = [];

    if (!query.includeArchived) {
      clauses.push({ archivedAt: null });
    }

    if (query.search) {
      const search = query.search.trim();
      if (search.length > 0) {
        clauses.push({
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { subTitle: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        });
      }
    }

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.type) {
      clauses.push({ type: query.type });
    }

    if (query.platform) {
      clauses.push({ platform: query.platform });
    }

    if (query.position) {
      clauses.push({ position: query.position });
    }

    const createdAtFilter = buildDateFilter(
      'createdAt',
      query.fromDate,
      query.lastDate,
    );

    if (Object.keys(createdAtFilter).length > 0) {
      clauses.push(createdAtFilter as Prisma.BannerWhereInput);
    }

    if (query.isRedirectType === 'true') {
      clauses.push({
        OR: [
          { type: 'PRODUCT', redirectType: 'PRODUCT' },
          { type: 'BRAND', redirectType: 'BRAND' },
          { type: 'CATEGORY', redirectType: 'CATEGORY' },
        ],
      });
    }

    return clauses.length > 0 ? { AND: clauses } : {};
  }

  private getPublicWhere(query: BannerQueryDto): Prisma.BannerWhereInput {
    const now = new Date();
    const clauses: Prisma.BannerWhereInput[] = [
      { archivedAt: null },
      {
        OR: [
          { status: BannerStatus.ACTIVE },
          { status: BannerStatus.SCHEDULED },
        ],
      },
      {
        OR: [{ startDate: null }, { startDate: { lte: now } }],
      },
      {
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    ];

    if (query.search) {
      const search = query.search.trim();
      if (search.length > 0) {
        clauses.push({
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { subTitle: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        });
      }
    }

    if (query.type) {
      clauses.push({ type: query.type });
    }

    if (query.platform) {
      if (query.platform === BannerPlatform.WEB) {
        clauses.push({
          OR: [
            { platform: BannerPlatform.WEB },
            { platform: BannerPlatform.BOTH },
          ],
        });
      } else if (query.platform === BannerPlatform.MOBILE) {
        clauses.push({
          OR: [
            { platform: BannerPlatform.MOBILE },
            { platform: BannerPlatform.BOTH },
          ],
        });
      } else {
        clauses.push({ platform: query.platform });
      }
    }

    if (query.position) {
      clauses.push({ position: query.position });
    }

    if (query.isRedirectType === 'true') {
      clauses.push({
        OR: [
          { type: 'PRODUCT', redirectType: 'PRODUCT' },
          { type: 'BRAND', redirectType: 'BRAND' },
          { type: 'CATEGORY', redirectType: 'CATEGORY' },
        ],
      });
    }

    return { AND: clauses };
  }

  private async findByIdOrThrow(id: string) {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
      select: this.bannerSelect,
    });

    if (!banner) {
      throw new NotFoundException('Banner not found');
    }

    return this.formatBannerUrls(banner);
  }

  async create(user: JwtUser, dto: CreateBannerDto, ip: string) {
    const startDate = this.parseDate(dto.startDate);
    const endDate = this.parseDate(dto.endDate);
    this.validateSchedule(startDate, endDate);

    const redirectId = this.sanitize(dto.redirectId);
    const redirectUrl = this.sanitize(dto.redirectUrl);
    this.validateRedirect(dto.redirectType, { redirectId, redirectUrl });

    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title.trim(),
        subTitle: this.sanitize(dto.subTitle),
        description: this.sanitize(dto.description),
        type: dto.type,
        imageUrl: dto.imageUrl.trim(),
        mobileImageUrl: this.sanitize(dto.mobileImageUrl),
        ctaText: this.sanitize(dto.ctaText),
        redirectType: dto.redirectType,
        redirectId,
        redirectUrl,
        shortCode: this.sanitize(dto.shortCode),
        platform: dto.platform,
        position: dto.position,
        priority: dto.priority ?? 0,
        startDate,
        endDate,
        status: dto.status,
        campaignId: this.sanitize(dto.campaignId),
        createdById: user.sub,
        updatedById: user.sub,
      },
      select: this.bannerSelect,
    });

    const result = this.formatBannerUrls(banner);

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'CREATE',
        resource: 'BANNER',
        resourceId: banner.id,
        metadata: { newBanner: JSON.stringify(banner) },
        ip,
      }),
      'BANNER_CREATE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('banners:'),
      'banner create',
    );

    return result;
  }

  async findAll(query: BannerQueryDto) {
    const result = await paginatePrisma({
      model: this.prisma.banner as any,
      where: this.buildWhere(query),
      orderBy: buildSortOrder(query.sortBy, query.order, [
        'createdAt',
        'updatedAt',
        'priority',
        'title',
      ]),
      page: query.page,
      limit: query.limit,
      select: this.bannerSelect,
    });

    result.data = result.data.map((banner: any) =>
      this.formatBannerUrls(banner),
    );
    return result;
  }

  async findPublic(query: BannerQueryDto) {
    const cacheKey = `banners:public:${JSON.stringify(query)}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored for production resilience
    }

    const result = await paginatePrisma({
      model: this.prisma.banner as any,
      where: this.getPublicWhere(query),
      orderBy: {
        priority: OrderType.DESC,
      },
      page: query.page,
      limit: query.limit,
      select: this.bannerSelect,
    });

    result.data = result.data.map((banner: any) =>
      this.formatBannerUrls(banner),
    );

    fireAndForget(
      this.redisService.set(cacheKey, result, 3600),
      'cache banner public list',
    );

    return result;
  }

  async findOne(id: string) {
    const cacheKey = `banners:detail:${id}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored for production resilience
    }

    const banner = await this.prisma.banner.findUniqueOrThrow({
      where: { id },
      select: this.bannerSelect,
    });

    banner.imageUrl = this.formatBannerUrls(banner).imageUrl;
    banner.mobileImageUrl = this.formatBannerUrls(banner).mobileImageUrl;

    fireAndForget(
      this.redisService.set(cacheKey, banner, 3600),
      'cache banner details',
    );

    return banner;
  }

  async update(user: JwtUser, id: string, dto: UpdateBannerDto, ip: string) {
    const current = await this.findByIdOrThrow(id);

    const startDate =
      dto.startDate !== undefined
        ? this.parseDate(dto.startDate)
        : (current.startDate ?? undefined);
    const endDate =
      dto.endDate !== undefined
        ? this.parseDate(dto.endDate)
        : (current.endDate ?? undefined);
    this.validateSchedule(startDate, endDate);

    const redirectType = dto.redirectType ?? current.redirectType;
    const redirectId =
      dto.redirectId !== undefined
        ? this.sanitize(dto.redirectId)
        : (current.redirectId ?? undefined);
    const redirectUrl =
      dto.redirectUrl !== undefined
        ? this.sanitize(dto.redirectUrl)
        : (current.redirectUrl ?? undefined);
    this.validateRedirect(redirectType, { redirectId, redirectUrl });

    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.subTitle !== undefined
          ? { subTitle: this.sanitize(dto.subTitle) ?? null }
          : {}),
        ...(dto.description !== undefined
          ? { description: this.sanitize(dto.description) ?? null }
          : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl.trim() }
          : {}),
        ...(dto.mobileImageUrl !== undefined
          ? { mobileImageUrl: this.sanitize(dto.mobileImageUrl) ?? null }
          : {}),
        ...(dto.ctaText !== undefined
          ? { ctaText: this.sanitize(dto.ctaText) ?? null }
          : {}),
        ...(dto.redirectType !== undefined
          ? { redirectType: dto.redirectType }
          : {}),
        ...(dto.redirectId !== undefined
          ? { redirectId: this.sanitize(dto.redirectId) ?? null }
          : {}),
        ...(dto.redirectUrl !== undefined
          ? { redirectUrl: this.sanitize(dto.redirectUrl) ?? null }
          : {}),
        ...(dto.shortCode !== undefined
          ? { shortCode: this.sanitize(dto.shortCode) ?? null }
          : {}),
        ...(dto.platform !== undefined ? { platform: dto.platform } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: startDate ?? null }
          : {}),
        ...(dto.endDate !== undefined ? { endDate: endDate ?? null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.campaignId !== undefined
          ? { campaignId: this.sanitize(dto.campaignId) ?? null }
          : {}),
        updatedById: user.sub,
      },
      select: this.bannerSelect,
    });

    const result = this.formatBannerUrls(banner);

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'UPDATE',
        resource: 'BANNER',
        resourceId: banner.id,
        metadata: { from: JSON.stringify(current), to: JSON.stringify(banner) },
        ip,
      }),
      'BANNER_UPDATE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('banners:'),
      'banner update',
    );

    return result;
  }

  private async deleteFileFromS3(urlOrKey: string | null | undefined, user: JwtUser, ip: string) {
    if (!urlOrKey) return;

    let key: string | null = null;
    const index = urlOrKey.indexOf('banner__');
    if (index !== -1) {
      key = urlOrKey.substring(index);
    } else if (urlOrKey.startsWith('banner__')) {
      key = urlOrKey;
    }

    if (key) {
      try {
        await this.uploadsService.deleteBanner('banner', key, {
          userId: user.sub,
          ip,
        });
      } catch (err) {
        console.error(`Failed to delete S3 file for key ${key}:`, err);
      }
    }
  }

  async remove(user: JwtUser, id: string, ip: string) {
    const banner = await this.findByIdOrThrow(id);

    await this.prisma.banner.delete({
      where: { id },
    });

    await this.deleteFileFromS3(banner.imageUrl, user, ip);
    await this.deleteFileFromS3(banner.mobileImageUrl, user, ip);

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'DELETE',
        resource: 'BANNER',
        resourceId: banner.id,
        metadata: { deletedBanner: JSON.stringify(banner) },
        ip,
      }),
      'BANNER_DELETE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('banners:'),
      'banner remove',
    );

    return banner;
  }

  async trackImpression(id: string) {
    await this.findByIdOrThrow(id);

    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        impressionCount: { increment: 1 },
      },
      select: this.bannerSelect,
    });

    return this.formatBannerUrls(banner);
  }

  async trackClick(id: string) {
    await this.findByIdOrThrow(id);

    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        clickCount: { increment: 1 },
      },
      select: this.bannerSelect,
    });

    return this.formatBannerUrls(banner);
  }
}
