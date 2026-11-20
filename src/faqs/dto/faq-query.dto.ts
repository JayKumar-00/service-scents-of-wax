import { ApiPropertyOptional } from '@nestjs/swagger';
import { FaqAudience, FaqStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum FaqSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  QUESTION = 'question',
  STATUS = 'status',
  AUDIENCE = 'audience',
}

export enum BooleanString {
  TRUE = 'true',
  FALSE = 'false',
}

export class FaqQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Search by FAQ question' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by FAQ audience',
    enum: FaqAudience,
  })
  @IsOptional()
  @IsEnum(FaqAudience)
  audience?: FaqAudience;

  @ApiPropertyOptional({
    description: 'Filter by FAQ status',
    enum: FaqStatus,
  })
  @IsOptional()
  @IsEnum(FaqStatus)
  status?: FaqStatus;

  @ApiPropertyOptional({
    description: 'Filter by visibility state',
    enum: BooleanString,
  })
  @IsOptional()
  @IsEnum(BooleanString)
  visibility?: BooleanString;

  @ApiPropertyOptional({
    description: 'Filter by soft delete state',
    enum: BooleanString,
  })
  @IsOptional()
  @IsEnum(BooleanString)
  deletion?: BooleanString;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: FaqSortBy,
    default: FaqSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(FaqSortBy)
  sortBy?: FaqSortBy = FaqSortBy.CREATED_AT;
}
