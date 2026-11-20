import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { PrismaService } from '../../prisma/prisma.service'; // Adjust path based on your project structure
import { UpdateThemeDto } from '../dto/update-theme.dto';
import { PanelType, Prisma } from '@prisma/client';
import { ThemeQueryDto } from '../dto/theme-query.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { OrderType } from 'src/common/dto/query.dto';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { AuditService } from 'src/audit/audit.service';

@Injectable()
export class AdminThemeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly audit: AuditService
  ) { }

  private buildThemeSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'updatedAt', 'siteName']);

  async list(query: ThemeQueryDto) {
    const q: any = query ?? {};
    const clauses: Prisma.SystemThemeWhereInput[] = [];

    if (q.panelType) {
      clauses.push({
        panelType: q.panelType as PanelType,
      });
    }

    if (q.search) {
      clauses.push({
        OR: [
          { siteName: { contains: q.search, mode: 'insensitive' } },
          { tagline: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};
    const page = q.page ? Number(q.page) : 1;
    const limit = q.limit ? Number(q.limit) : 10;
    const orderBy = this.buildThemeSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.systemTheme as any,
      where,
      orderBy,
      page,
      limit,
    });

    return {
      data: paged.data || [],
      meta: paged.meta,
    };
  }

  async getById(id: string) {
    const cacheKey = `theme:detail:${id}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored for production resilience
    }

    const theme = await this.prisma.systemTheme.findUnique({ where: { id } });
    if (!theme) {
      throw new NotFoundException(`System theme with ID ${id} not found`);
    }

    fireAndForget(
      this.redisService.set(cacheKey, theme, 43200),
      'cache theme by id',
    );

    return theme;
  }

  async getByPanelType(panelType: PanelType) {
    const cacheKey = `theme:active:${panelType}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored for production resilience
    }

    const theme = await this.prisma.systemTheme.findFirst({
      where: { panelType },
    });
    if (!theme) {
      throw new NotFoundException(
        `System theme for panel type ${panelType} not found`,
      );
    }

    fireAndForget(
      this.redisService.set(cacheKey, theme, 43200),
      'cache theme by panelType',
    );

    return theme;
  }

  async upsertByPanelType(
    user: JwtUser,
    panelType: PanelType,
    updateThemeDto: UpdateThemeDto,
    ip: string
  ) {

    const existing = await this.prisma.systemTheme.findFirst({
      where: { panelType },
    });

    const result = await (existing
      ? this.prisma.systemTheme.update({
        where: { id: existing.id },
        data: updateThemeDto,
      })
      : this.prisma.systemTheme.create({
        data: {
          ...(updateThemeDto as any),
          panelType,
        },
      }));


    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: existing ? 'UPDATE' : 'CREATE',
        resource: 'Theme',
        resourceId: result.id,
        metadata: existing
          ? {
            from: Object.fromEntries(
              Object.keys(updateThemeDto).map(key => [key, existing[key as keyof typeof existing]])
            ),
            to: Object.fromEntries(
              Object.keys(updateThemeDto).map(key => [key, result[key as keyof typeof result]])
            ),
          }
          : {
            to: Object.fromEntries(
              Object.keys(updateThemeDto).map(key => [key, result[key as keyof typeof result]])
            ),
          },
        ip,
      }),
      'theme.update',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('theme:'),
      'theme upsert',
    );

    return result;
  }

  async resetToDefault(
    user: JwtUser,
    panelType: PanelType,
    ip: string
  ) {
    const existing = await this.prisma.systemTheme.findFirst({
      where: { panelType },
    });

    if (existing) {
      await this.prisma.systemTheme.delete({
        where: { id: existing.id },
      });
    }

    let defaultData: Prisma.SystemThemeCreateInput = { panelType };

    if (panelType === PanelType.ADMIN) {
      defaultData = {
        ...defaultData,
        siteName: 'UnBoxIO Admin',
        tagline: 'Head-office control center',
        logoUrl:
          'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=120&h=120&fit=crop&q=80',
        primaryColor: '#ec4899',
        secondaryColor: '#db2777',
        backgroundColor: '#fff7fb',
        surfaceColor: '#ffffff',
        borderColor: '#f9a8d4',
        headingColor: '#0f172a',
        textColor: '#334155',
        mutedColor: '#64748b',
        sidebarBgColor: '#ffffff',
        sidebarTextColor: '#475569',
        sidebarActiveBgColor: '#fdf2f8',
        sidebarActiveTextColor: '#db2777',
        sidebarHoverBgColor: '#fff7fb',
        sidebarHoverTextColor: '#be185d',
        sidebarFontFamily: 'Inter, sans-serif',
        sidebarBorderRadius: '12px',
        fontFamily: 'Inter, sans-serif',
        headingFontFamily: 'Inter, sans-serif',
        baseFontSize: '14px',
        customCss:
          '/* Custom styling overrides for UnBoxIO Superadmin Console */\nbody {\n  -webkit-font-smoothing: antialiased;\n}',
      };
    } else if (panelType === PanelType.FRANCHISE) {
      defaultData = {
        ...defaultData,
        siteName: 'UnBoxIO Franchise',
        tagline: 'Franchise Partner Portal',
      };
    }

    const result = await this.prisma.systemTheme.create({
      data: defaultData,
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'RESET',
        resource: 'Theme',
        resourceId: result.id,
        metadata: existing
          ? {
            from: Object.fromEntries(
              Object.keys(defaultData).map(key => [key, existing[key as keyof typeof existing]])
            ),
            to: Object.fromEntries(
              Object.keys(defaultData).map(key => [key, result[key as keyof typeof result]])
            ),
          }
          : {
            to: Object.fromEntries(
              Object.keys(defaultData).map(key => [key, result[key as keyof typeof result]])
            ),
          },
        ip,
      }),
      'theme.update',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('theme:'),
      'theme reset',
    );

    return result;
  }
}
