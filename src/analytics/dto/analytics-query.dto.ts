import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { AnalyticsPeriod, AnalyticsType } from '../enums/analytic.enum';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description:
      'Start date for the analytics data (ISO string) Example: 2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'End date for the analytics data (ISO string) Example: 2024-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  /** Superadmin dashboard slice */
  @ApiPropertyOptional({
    description: 'Type of analytics data to retrieve for superadmin dashboard',
    enum: AnalyticsType,
  })
  @IsOptional()
  @IsEnum(AnalyticsType)
  type?: AnalyticsType;

  /** Franchise analytics preset when `from` / `to` omitted */
  @ApiPropertyOptional({
    description:
      'Preset period for franchise analytics when `from` and `to` are omitted',
    enum: AnalyticsPeriod,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;
}
