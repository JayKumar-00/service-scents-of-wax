import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum DashboardPeriod {
  ONE_DAYS = '1d',
  SEVEN_DAYS = '7d',
  FIFTEEN_DAYS = '15d',
  THIRTY_DAYS = '30d',
}

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Start date for the dashboard data (ISO string) Example: 2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'End date for the dashboard data (ISO string) Example: 2026-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Preset period for analytics when from and to are omitted',
    enum: DashboardPeriod,
  })
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod;
}
