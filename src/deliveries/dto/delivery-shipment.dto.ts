import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ShipmentStatus } from '@prisma/client';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  STATUS = 'status',
  DELIVERED_AT = 'deliveredAt',
}

export class DeliveryShipmentDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by shipment id',
  })
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by order id',
  })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Filter by courier name',
  })
  @IsOptional()
  @IsString()
  courierName?: string;

  @ApiPropertyOptional({
    description: 'Filter by tracking number',
  })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by shipment status',
    enum: ShipmentStatus,
  })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional({
    description: 'Filter by Franchise ID',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description:
      'Search keyword (shipmentId, orderId, trackingNumber, courierName)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
