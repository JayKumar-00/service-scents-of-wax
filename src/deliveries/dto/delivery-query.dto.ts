import { ApiPropertyOptional } from '@nestjs/swagger';
import { InboundDiscrepancyStatus } from '@prisma/client';
import { DeliveryStatus } from '@prisma/client';
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
  STATUS = 'status',
  CARRIER = 'carrier',
  EXPECTED_AT = 'expectedAt',
  DELIVERED_AT = 'deliveredAt',
  DISPATCHED_AT = 'dispatchedAt',
  QTY_RECEIVED = 'quantityReceived',
}

export class DeliveryQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description:
      'Search term for deliveries (franchise.name, franchise.ownerEmail, product.name), Ex: "gift box"',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: `Filter by franchise ID, Ex: '123e4567-e89b-12d3-a456-426614174000'`,
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: `Filter by delivery status, Ex: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'PARTIALLY_RECEIVED' | 'CANCELED'`,
    enum: DeliveryStatus,
  })
  @IsEnum(DeliveryStatus)
  @IsOptional()
  status?: DeliveryStatus;

  @ApiPropertyOptional({
    description: `Filter by carrier, Ex: 'FedEx'`,
  })
  @IsString()
  @IsOptional()
  carrier?: string;

  @ApiPropertyOptional({
    description: `Filter by tracking code, Ex: '123456789'`,
  })
  @IsString()
  @IsOptional()
  trackingCode?: string;

  @ApiPropertyOptional({
    description: `Filter by delivery date range (ISO), Ex: '2026-12-11'`,
  })
  @IsDateString()
  @IsOptional()
  deliveryFrom?: string;

  @ApiPropertyOptional({
    description: `Filter by delivery date range (ISO), Ex: '2026-12-11'`,
  })
  @IsDateString()
  @IsOptional()
  deliveryTo?: string;

  @ApiPropertyOptional({
    description: `Filter by expected delivery date range (ISO), Ex: '2026-12-11'`,
  })
  @IsDateString()
  @IsOptional()
  expectedFrom?: string;

  @ApiPropertyOptional({
    description: `Filter by expected delivery date range (ISO), Ex: '2026-12-11'`,
  })
  @IsDateString()
  @IsOptional()
  expectedTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by stockApplied (true/false)',
    enum: ['true', 'false'],
  })
  @IsEnum(['true', 'false'])
  @IsOptional()
  stockApplied?: ['true', 'false'];

  @ApiPropertyOptional({
    description: `Filter by transport lane ID, Ex: '123e4567-e89b-12d3-a456-426614174000'`,
  })
  @IsString()
  @IsOptional()
  transportLaneId?: string;

  @ApiPropertyOptional({
    description: `Minimum damaged quantity received, Ex: 10`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mindamagedQuantity?: number;

  @ApiPropertyOptional({
    description: `Miximum damaged quantity received, Ex: 10`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxdamagedQuantity?: number;

  @ApiPropertyOptional({
    description: `Filter by discrepancy status, Ex: 'OPEN' | 'RESOLVED' | 'NONE'`,
    enum: InboundDiscrepancyStatus,
  })
  @IsEnum(InboundDiscrepancyStatus)
  @IsOptional()
  discrepancyStatus?: InboundDiscrepancyStatus;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
