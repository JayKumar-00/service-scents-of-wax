import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { RedisService } from 'src/redis/redis.service';
import { MediaQueryDto } from './dto/media-query.dto';
import { CreateMediaItemDto } from './dto/create-media.dto';
import { UpdateMediaItemDto } from './dto/update-media.dto';
import { OrderType } from 'src/common/dto/query.dto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaLibrary } from '@prisma/client';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { buildPrismaTextSearchFilter } from 'src/common/utils/search.util';
import { UploadsService } from 'src/uploads/uploads.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { AuditService } from 'src/audit/audit.service';

export type MediaItem = {
  id: string;
  url: string;
  key: string;
  mimeType: string;
  size: string;
  createdAt: Date;
  updatedAt: Date;
};

const MEDIA_STORAGE: Map<string, MediaItem> = new Map();
let COUNTER = 1;
const MEDIA_LIBRARY_CACHE_PREFIX = 'media-library:v2:';

@Injectable()
export class MediaLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => UploadsService))
    private readonly uploadsService: UploadsService,
    private readonly audit: AuditService,
  ) {}

  private resolvePublicUrl(key: string, storedUrl?: string | null) {
    const awsPrefix =
      this.configService.get<string>('AWS_PREFIX_URL') ??
      process.env.AWS_PREFIX_URL;
    const normalizedPrefix = awsPrefix?.replace(/\/$/, '');

    if (normalizedPrefix) {
      return `${normalizedPrefix}/${key}`;
    }

    if (storedUrl && /^https?:\/\//i.test(storedUrl)) {
      return storedUrl;
    }

    return storedUrl ?? key;
  }

  private buildMediaSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['tag', 'mimeType', 'key']);

  async createMap(dto: CreateMediaItemDto): Promise<MediaItem> {
    const id = `media_${COUNTER++}`;
    const now = new Date();
    const item: MediaItem = {
      id,
      url: dto.url ?? `Not-Provided`,
      key: dto.key,
      mimeType: dto.mimeType,
      size: dto.size,
      createdAt: now,
      updatedAt: now,
    };

    MEDIA_STORAGE.set(id, item);

    // invalidate cache
    fireAndForget(
      this.redisService.clearCacheByPrefix(MEDIA_LIBRARY_CACHE_PREFIX),
      'clear media library cache',
    );

    return item;
  }

  async create(
    userOrDto: JwtUser | CreateMediaItemDto,
    dtoOrUndefined?: CreateMediaItemDto,
    ipOrUndefined?: string,
  ): Promise<MediaLibrary> {
    let dto: CreateMediaItemDto;
    let user: Partial<JwtUser> | undefined;
    let ip: string | undefined;

    if (userOrDto && 'sub' in userOrDto) {
      user = userOrDto as Partial<JwtUser>;
      dto = dtoOrUndefined!;
      ip = ipOrUndefined;
    } else if (userOrDto && !dtoOrUndefined) {
      dto = userOrDto as CreateMediaItemDto;
    } else {
      user = userOrDto as Partial<JwtUser> | undefined;
      dto = dtoOrUndefined!;
      ip = ipOrUndefined;
    }

    const result = await this.prisma.mediaLibrary.create({
      data: {
        url: dto.url ?? `Not-Provided`,
        key: dto.key,
        mimeType: dto.mimeType,
        tag: dto.tag ?? undefined,
        size: dto.size,
      },
    });

    if (user?.sub) {
      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'CREATE',
          resource: 'MediaLibrary',
          resourceId: result.id,
          metadata: {
            role: user.role,
            key: result.key,
          },
          ip,
        }),
        'CREATE',
      );
    }

    // Invalidate media list caches after creation
    fireAndForget(
      this.redisService.clearCacheByPrefix(MEDIA_LIBRARY_CACHE_PREFIX),
      'clear media library cache',
    );

    return result;
  }

  async listAcutal(query?: MediaQueryDto): Promise<{
    data: MediaLibrary[];
    meta: IMeta;
  }> {
    const q = query ?? ({} as MediaQueryDto);

    const clauses: Record<string, unknown>[] = [];

    const searchFilter = buildPrismaTextSearchFilter(q.search, [
      'tag',
      'mimeType',
      'key',
    ]);

    if (Object.keys(searchFilter).length > 0) clauses.push(searchFilter);

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildMediaSortOrder(q.sortBy, q.order);

    const cacheKey = `${MEDIA_LIBRARY_CACHE_PREFIX}page=${page}:limit=${limit}:order=${q.order ?? ''}:sortBy=${q.sortBy ?? ''}:search=${encodeURIComponent(
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
      model: this.prisma.mediaLibrary as any,
      where,
      orderBy,
      page,
      limit,
    });

    const awsPrefix = this.configService
      .get<string>('AWS_PREFIX_URL')
      ?.replace(/\/$/, '');

    const data = result.data.map((fr) => ({
      ...fr,
      url: awsPrefix
        ? `${awsPrefix}/${fr.key}`
        : this.resolvePublicUrl(fr.key, fr.url),
    }));

    const payload = {
      data,
      meta: result.meta,
    };

    fireAndForget(
      this.redisService.set(cacheKey, payload),
      'set media list cache',
    );

    return payload;
  }

  // async list(query: MediaQueryDto): Promise<{
  //   data: MediaItem[];
  //   meta: { count: number; totalPages: number; page: number; limit: number };
  // }> {
  //   const q = query ?? {};
  //   const cacheKey = `media-library:page=${q.page ?? 1}:limit=${q.limit ?? 10}:search=${encodeURIComponent(
  //     String(q.search ?? ''),
  //   )}:folder=${q.folder ?? ''}:tag=${q.tag ?? ''}`;

  //   const cached =
  //     await this.redisService.get<PaginationResult<MediaItem>>(cacheKey);
  //   if (cached) {
  //     return cached;
  //   }

  //   let items = Array.from(MEDIA_STORAGE.values());

  //   // text search against key and url
  //   if (q.search) {
  //     const searchLower = q.search.toLowerCase().trim();
  //     items = items.filter(
  //       (item) =>
  //         item.key.toLowerCase().includes(searchLower) ||
  //         item.url.toLowerCase().includes(searchLower),
  //     );
  //   }

  //   // mimeType filter
  //   if (q.mimeType) {
  //     items = items.filter((item) => item.mimeType === q.mimeType);
  //   }

  //   // sort
  //   const orderByField =
  //     q.sortBy === MediaSortBy.KEY ? 'key' : q.sortBy || 'createdAt';
  //   const order = q.order || OrderType.DESC;
  //   items.sort((a, b) => {
  //     const aVal = (a as any)[orderByField];
  //     const bVal = (b as any)[orderByField];
  //     if (aVal < bVal) return order === OrderType.ASC ? -1 : 1;
  //     if (aVal > bVal) return order === OrderType.ASC ? 1 : -1;
  //     return 0;
  //   });

  //   // paginate
  //   const page = Math.max(1, Number(q.page) || 1);
  //   const limit = Math.max(1, Number(q.limit) || 10);
  //   const skip = (page - 1) * limit;
  //   const total = items.length;
  //   const totalPages = Math.ceil(total / limit);
  //   const data = items.slice(skip, skip + limit);

  //   console.log('data', data);
  //   const awsPrefix = this.configService
  //     .get<string>('AWS_PREFIX_URL')
  //     ?.replace(/\/$/, '');

  //   const responseData = data.map((item) => ({
  //     ...item,
  //     url: awsPrefix ? `${awsPrefix}/${item.key}` : item.url,
  //   }));

  //   const result = {
  //     data: responseData,
  //     meta: {
  //       count: total,
  //       totalPages,
  //       page,
  //       limit,
  //     },
  //   };

  //   await this.redisService.set(cacheKey, result, 60); // cache for 60 seconds

  //   return result;
  // }

  async findById(id: string): Promise<MediaLibrary> {
    const cacheKey = `${MEDIA_LIBRARY_CACHE_PREFIX}${id}`;
    let cached: any = null;
    try {
      cached = await this.redisService.get<MediaLibrary>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }

    if (cached) return cached;

    const result = await this.prisma.mediaLibrary.findUnique({ where: { id } });
    if (!result) throw new NotFoundException('Media item not found');

    const awsPrefix = this.configService
      .get<string>('AWS_PREFIX_URL')
      ?.replace(/\/$/, '');

    const data = {
      ...result,
      url: awsPrefix
        ? `${awsPrefix}/${result.key}`
        : this.resolvePublicUrl(result.key, result.url),
    };

    fireAndForget(
      this.redisService.set(cacheKey, data),
      'set media item cache',
    );
    return data;
  }

  async update(id: string, dto: UpdateMediaItemDto): Promise<MediaLibrary> {
    const existing = await this.findById(id);

    const productId = existing.key.split('-')[1].split('__')[0];

    if (productId) {
      await this.uploadsService.adminDeleteProductFile(existing.key);
    }

    const result = await this.prisma.mediaLibrary.update({
      where: { id },
      data: dto,
    });

    // invalidate caches
    fireAndForget(
      Promise.all([
        this.redisService.clearCacheByPrefix(MEDIA_LIBRARY_CACHE_PREFIX),
        this.redisService.del([`${MEDIA_LIBRARY_CACHE_PREFIX}${id}`]),
      ]),
      'invalidate updated media cache',
    );

    return {
      ...result,
      url: this.resolvePublicUrl(result.key, result.url),
    };
  }

  async delete(
    user: JwtUser,
    id: string,
    ip: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.findById(id);

    const productId = existing.key.split('-')[1].split('__')[0];

    if (productId) {
      await this.uploadsService.adminDeleteProductFile(existing.key);
    }

    await this.prisma.mediaLibrary.delete({ where: { id } });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'DELETE_MEDIA_LIBRARY',
        resource: 'MediaLibrary',
        resourceId: id,
        metadata: {
          role: user.role,
          deleted: { productId, key: existing.key },
        },
        ip,
      }),
      'DELETE_ATTRIBUTE',
    );

    // invalidate caches
    fireAndForget(
      Promise.all([
        this.redisService.clearCacheByPrefix(MEDIA_LIBRARY_CACHE_PREFIX),
        this.redisService.del([`${MEDIA_LIBRARY_CACHE_PREFIX}${id}`]),
      ]),
      'invalidate deleted media cache',
    );

    return { success: true };
  }
}
