import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  DeliveryStatus,
  StockRequestPaymentStatus,
  StockRequestStatus,
  StockRequestType,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
}

export class StockRequestQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search text (product.name, franchise.name, brand.name, category.name), Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter stock requests by franchise ID (via Super Admin).',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string; // This will be set from the controller based on the user's franchise

  @ApiPropertyOptional({
    description: 'Filter stock requests by payment status (Super Admin).',
    enum: StockRequestPaymentStatus,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(StockRequestPaymentStatus)
  paymentStatus?: StockRequestPaymentStatus;

  @ApiPropertyOptional({
    description:
      'Filter stock requests by status (Franchise Owner, Staff, Auditor, or Super Admin).',
    enum: StockRequestStatus,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(StockRequestStatus)
  status?: StockRequestStatus;

  @ApiPropertyOptional({
    description:
      'Filter stock requests by related delivery status inside deliveries',
    enum: DeliveryStatus,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(DeliveryStatus)
  deliveryStatus?: DeliveryStatus;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;

  @ApiPropertyOptional({
    description: 'Filter stock requests by type',
    enum: StockRequestType,
  })
  @IsOptional()
  @IsEnum(StockRequestType)
  type?: StockRequestType;
}
