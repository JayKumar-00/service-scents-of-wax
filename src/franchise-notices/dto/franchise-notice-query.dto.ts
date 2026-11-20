import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { NoticeAudience } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  PUBLISHED_AT = 'publishedAt',
  TITLE = 'title',
}

export class FranchiseNoticeQueryDto extends OmitType(QueryDto, [
  'fromDate',
  'lastDate',
] as const) {
  @ApiPropertyOptional({ description: 'Search term for notice title or body' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: `From Published (ISO), Ex: '2026-12-11'`,
  })
  @IsOptional()
  @IsDateString()
  fromPublishedAt?: string;

  @ApiPropertyOptional({
    description: `To Published (ISO), Ex: '2026-12-11'`,
  })
  @IsOptional()
  @IsDateString()
  toPublishedAt?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.PUBLISHED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}

export class NoticeQueryDto extends FranchiseNoticeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by Franchise ID (for single-franchise notices)',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: `Filter by audience, Ex: ${Object.values(NoticeAudience).join(' | ')}`,
    enum: NoticeAudience,
  })
  @IsEnum(NoticeAudience)
  @IsOptional()
  audience?: NoticeAudience;

  @IsOptional()
  includeGlobal?: boolean;
}
