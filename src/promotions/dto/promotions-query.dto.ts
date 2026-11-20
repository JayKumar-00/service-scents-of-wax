import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  STARTS_AT = 'startsAt',
  ENDS_AT = 'endsAt',
  NAME = 'name',
}

export class PromotionsQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search by promotion code or description',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by promotion type (e.g. "percentage", "fixed")',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  percentOff?: number;

  @ApiPropertyOptional({
    description: 'Filter by promotion type (e.g. "percentage", "fixed")',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  active?: ['true', 'false'];

  @ApiPropertyOptional({
    description: 'Filter by promotion start date (ISO), Ex: "2026-12-11"',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    description: 'Filter by promotion end date (ISO), Ex: "2026-12-11"',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    description: 'Filter by whether promotion applies to all products',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  applyToAll?: ['true', 'false'];

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
