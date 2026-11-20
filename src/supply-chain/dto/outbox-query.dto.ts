import { ApiPropertyOptional } from '@nestjs/swagger';
import { DomainOutboxStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  DISPATCHED_AT = 'dispatchedAt',
  STATUS = 'status',
  EVENT_NAME = 'eventName',
}

export class OutboxQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search text (eventName), Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by Franchise ID',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by StockRequest ID',
  })
  @IsString()
  @IsOptional()
  stockRequestId?: string;

  @ApiPropertyOptional({
    description: 'Filter by outbox message status',
    enum: DomainOutboxStatus,
  })
  @IsOptional()
  @IsEnum(DomainOutboxStatus)
  status?: DomainOutboxStatus;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
