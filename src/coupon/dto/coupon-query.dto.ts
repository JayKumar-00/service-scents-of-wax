import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountScope, DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum CouponSortBy {
  CREATED_AT = 'createdAt',
  STARTS_AT = 'startsAt',
  ENDS_AT = 'endsAt',
  NAME = 'name',
  CODE = 'code',
  USED_COUNT = 'usedCount',
}

export class CouponQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search by coupon name or code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: DiscountType,
    description: 'Filter by discount type',
  })
  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @ApiPropertyOptional({
    enum: DiscountScope,
    description: 'Filter by discount scope',
  })
  @IsOptional()
  @IsEnum(DiscountScope)
  scope?: DiscountScope;

  @ApiPropertyOptional({
    description: 'Filter by active state',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: CouponSortBy,
    default: CouponSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(CouponSortBy)
  sortBy?: CouponSortBy;
}
