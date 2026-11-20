import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateWebThemeDto } from '../dto/update-web-theme.dto';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@Injectable()
export class WebThemeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly audit: AuditService
  ) { }

  async getTheme() {
    const cacheKey = 'web-theme:active';
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored for production resilience
    }

    let theme = await this.prisma.theme.findFirst();

    if (!theme) {
      theme = await this.prisma.theme.create({
        data: {
          siteName: 'UnBoxIO',
          fontFamily: 'Inter, sans-serif',
          backgroundColor: '#ffffff',
          textColor: '#161615',
          primaryColor: '#cc176b',
          primaryForeground: '#ffffff',
          secondaryColor: '#62182d',
          secondaryForeground: '#ffffff',
          borderColor: '#e0e0e0',
          headerPromoBg: '#cc176b',
          headerPromoText: '#ffffff',
          headerCategoryPillBg: '#fde7f3',
          headerCategoryPillText: '#cc176b',
          footerBg: '#050b18',
          footerText: '#cbd5e1',
          footerBorder: '#0f172a',
          cartBadgeBg: '#cc176b',
          cartBadgeText: '#ffffff',
        },
      });
    }

    fireAndForget(
      this.redisService.set(cacheKey, theme, 43200),
      'cache web theme',
    );

    return theme;
  }

  async updateTheme(user: JwtUser, dto: UpdateWebThemeDto, ip: string) {
    const existingTheme = await this.prisma.theme.findFirst();

    const result = await (existingTheme
      ? this.prisma.theme.update({
          where: { id: existingTheme.id },
          data: dto,
        })
      : this.prisma.theme.create({
          data: {
            siteName: dto.siteName ?? 'UnBoxIO',
            fontFamily: dto.fontFamily ?? 'Inter, sans-serif',
            backgroundColor: dto.backgroundColor ?? '#ffffff',
            textColor: dto.textColor ?? '#161615',
            primaryColor: dto.primaryColor ?? '#cc176b',
            primaryForeground: dto.primaryForeground ?? '#ffffff',
            secondaryColor: dto.secondaryColor ?? '#62182d',
            secondaryForeground: dto.secondaryForeground ?? '#ffffff',
            borderColor: dto.borderColor ?? '#e0e0e0',
            headerPromoBg: dto.headerPromoBg ?? '#cc176b',
            headerPromoText: dto.headerPromoText ?? '#ffffff',
            headerCategoryPillBg: dto.headerCategoryPillBg ?? '#fde7f3',
            headerCategoryPillText: dto.headerCategoryPillText ?? '#cc176b',
            footerBg: dto.footerBg ?? '#050b18',
            footerText: dto.footerText ?? '#cbd5e1',
            footerBorder: dto.footerBorder ?? '#0f172a',
            cartBadgeBg: dto.cartBadgeBg ?? '#cc176b',
            cartBadgeText: dto.cartBadgeText ?? '#ffffff',
          },
        }));

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: existingTheme ? 'UPDATE' : 'CREATE',
        resource: 'Theme',
        resourceId: result.id,
        metadata: existingTheme
          ? {
            from: Object.fromEntries(
              Object.keys(dto).map(key => [key, existingTheme[key as keyof typeof existingTheme]])
            ),
            to: Object.fromEntries(
              Object.keys(dto).map(key => [key, result[key as keyof typeof result]])
            ),
          }
          : {
            to: Object.fromEntries(
              Object.keys(dto).map(key => [key, result[key as keyof typeof result]])
            ),
          },
        ip,
      }),
      'theme.update',
    );

    fireAndForget(
      this.redisService.del(['web-theme:active']),
      'web theme update cache invalidate',
    );

    return result;
  }

  async resetToDefault(user: JwtUser, ip: string) {
    const existingTheme = await this.prisma.theme.findFirst();

    const defaultValues = {
      siteName: 'UnBoxIO',
      fontFamily: 'Inter, sans-serif',
      backgroundColor: '#ffffff',
      textColor: '#161615',
      primaryColor: '#cc176b',
      primaryForeground: '#ffffff',
      secondaryColor: '#62182d',
      secondaryForeground: '#ffffff',
      borderColor: '#e0e0e0',
      headerPromoBg: '#cc176b',
      headerPromoText: '#ffffff',
      headerCategoryPillBg: '#fde7f3',
      headerCategoryPillText: '#cc176b',
      footerBg: '#050b18',
      footerText: '#cbd5e1',
      footerBorder: '#0f172a',
      cartBadgeBg: '#cc176b',
      cartBadgeText: '#ffffff',
    };

    const result = await (existingTheme
      ? this.prisma.theme.update({
          where: { id: existingTheme.id },
          data: defaultValues,
        })
      : this.prisma.theme.create({
          data: defaultValues,
        }));

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'RESET',
        resource: 'Theme',
        resourceId: result.id,
        metadata: existingTheme
          ? {
            from: Object.fromEntries(
              Object.keys(defaultValues).map(key => [key, existingTheme[key as keyof typeof existingTheme]])
            ),
            to: Object.fromEntries(
              Object.keys(defaultValues).map(key => [key, result[key as keyof typeof result]])
            ),
          }
          : {
            to: Object.fromEntries(
              Object.keys(defaultValues).map(key => [key, result[key as keyof typeof result]])
            ),
          },
        ip,
      }),
      'theme.update',
    );

    fireAndForget(
      this.redisService.del(['web-theme:active']),
      'web theme reset cache invalidate',
    );

    return result;
  }
}
