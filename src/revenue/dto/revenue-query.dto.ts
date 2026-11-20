import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RevenuePeriod } from '../enums/period.enum';

export class RevenueQueryDto {
  @ApiPropertyOptional({
    enum: RevenuePeriod,
    description: 'Time period for revenue aggregation (DAY, WEEK, MONTHLY, YEARLY)',
    default: RevenuePeriod.DAY,
  })
  @IsOptional()
  @IsEnum(RevenuePeriod)
  period?: RevenuePeriod;

  @ApiPropertyOptional({
    description: 'Optional Franchise ID to filter revenue metrics',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Optional start date filter (ISO string or YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Optional end date filter (ISO string or YYYY-MM-DD)',
    example: '2026-08-19',
  })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({
    description:
      'Number of historical periods to include in graph data (e.g. 7 for last 7 days/weeks/months/years)',
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 7;
}

