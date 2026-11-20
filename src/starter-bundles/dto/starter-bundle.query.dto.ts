import { ApiPropertyOptional } from '@nestjs/swagger';
import { StarterBundleStatus, BundleType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

export enum StarterBundleSortBy {
  CREATED_AT = 'createdAt',
  CODE = 'code',
  NAME = 'name',
  STATUS = 'status',
}

export class StarterBundleQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search text matching bundle name or code`,
    example: 'starter',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by type',
    enum: BundleType,
  })
  @IsOptional()
  @IsEnum(BundleType)
  type?: BundleType;

  @ApiPropertyOptional({
    description: 'Filter by status (ACTIVE / INACTIVE)',
    enum: StarterBundleStatus,
  })
  @IsOptional()
  @IsEnum(StarterBundleStatus)
  status?: StarterBundleStatus;

  @ApiPropertyOptional({
    description: 'Filter default bundles',
    enum: BooleanEnum,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  isDefault?: BooleanEnum;

  @ApiPropertyOptional({
    description: 'Filter auto-assign bundles',
    enum: BooleanEnum,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  autoAssignOnCreate?: BooleanEnum;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: StarterBundleSortBy,
    default: StarterBundleSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(StarterBundleSortBy)
  sortBy?: StarterBundleSortBy = StarterBundleSortBy.CREATED_AT;
}
