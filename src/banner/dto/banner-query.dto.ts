import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BannerPlatform,
  BannerPosition,
  BannerStatus,
  BannerType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { OrderType, QueryDto } from 'src/common/dto/query.dto';

const sortByValues = ['createdAt', 'updatedAt', 'priority', 'title'] as const;

export class BannerQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Search by title/subtitle/description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: BannerStatus })
  @IsOptional()
  @IsEnum(BannerStatus)
  status?: BannerStatus;

  @ApiPropertyOptional({ enum: BannerType })
  @IsOptional()
  @IsEnum(BannerType)
  type?: BannerType;

  @ApiPropertyOptional({ enum: BannerPlatform })
  @IsOptional()
  @IsEnum(BannerPlatform)
  platform?: BannerPlatform;

  @ApiPropertyOptional({ enum: BannerPosition })
  @IsOptional()
  @IsEnum(BannerPosition)
  position?: BannerPosition;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: sortByValues,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(sortByValues)
  sortBy?: (typeof sortByValues)[number] = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: OrderType })
  @IsOptional()
  @IsEnum(OrderType)
  order?: OrderType = OrderType.DESC;

  @ApiPropertyOptional({
    description: 'Include archived banners in admin listing',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean = false;

  @ApiPropertyOptional({
    description: 'Filter where type matches redirectType',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  isRedirectType?: 'true' | 'false';
}
