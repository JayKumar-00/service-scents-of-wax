import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { DashboardPeriod } from './dashboard-query.dto';

export class FranchiseDashboardQueryDto {
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
