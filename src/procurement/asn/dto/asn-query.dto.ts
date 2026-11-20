import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OrderType } from '../../../common/dto/query.dto';

export enum AsnStatusDto {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED = 'ARRIVED',
  CANCELLED = 'CANCELLED',
}

export class AsnQueryDto {
  @ApiPropertyOptional({
    description: 'Search by ASN number, courier, vehicle number, PO number, or supplier name',
    example: 'ASN-2026',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by ASN status',
    enum: AsnStatusDto,
  })
  @IsOptional()
  @IsEnum(AsnStatusDto)
  status?: AsnStatusDto;

  @ApiPropertyOptional({
    description: 'Filter by supplier ID',
    example: 'supp_123',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Filter by Purchase Order (PO) ID',
    example: 'po_123',
  })
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination (default: 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page (default: 10)',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "Sort order ('asc' or 'desc', default: 'desc')",
    enum: OrderType,
    default: OrderType.DESC,
  })
  @IsOptional()
  @IsEnum(OrderType)
  order?: OrderType = OrderType.DESC;

  @ApiPropertyOptional({
    description: 'Field to sort by (default: "createdAt")',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';
}
