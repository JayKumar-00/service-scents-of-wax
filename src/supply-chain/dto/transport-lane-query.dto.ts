import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  NAME = 'name',
  ALLOC_PRIORITY = 'allocationPriority',
}

export class TransportLaneQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search text (name), Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: `Filter by originNodeId, Ex: 'node_12345'`,
  })
  @IsOptional()
  @IsString()
  originNodeId?: string;

  @ApiPropertyOptional({
    description: `Filter by destNodeId, Ex: 'node_12345'`,
  })
  @IsOptional()
  @IsString()
  destNodeId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by allocation priority (lower numbers are higher priority), Ex: 1',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  allocationPriority?: number;

  @ApiPropertyOptional({
    description: 'Filter by active (true/false)',
    enum: ['true', 'false'],
  })
  @IsEnum(['true', 'false'])
  @IsOptional()
  active?: ['true', 'false'];

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
