import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentType {
  COD = 1,
  PREPAID = 0,
}

/**
 * DTO for querying serviceability of a shipment.
 *
 * All boolean-like flags are represented as numbers (0 or 1) to match Shiprocket API.
 */
export class ServiceabilityQueryDto {
  /**
   * Shiprocket order ID if already created.
   * Optional.
   * @example 123456
   */
  @ApiPropertyOptional({
    description: 'Use OrderNumber',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  order_id?: number;

  /**
   * Pickup location postcode.
   * Required.
   * @example 110030
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  pickup_postcode!: number;

  /**
   * Delivery location postcode.
   * Required.
   * @example 122002
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  delivery_postcode!: number;

  /**
   * Cash on Delivery flag.
   * Conditional: required if order_id is not provided.
   * 1 = COD, 0 = Prepaid
   * @example 1
   */
  @ApiPropertyOptional({
    description: '1 for COD, 0 for Prepaid',
    enum: PaymentType,
  })
  @Type(() => Number)
  @IsEnum(PaymentType)
  @IsOptional()
  cod?: number = 0;

  /**
   * Shipment weight in kgs.
   * Conditional: required if order_id is not provided.
   * API expects string type, e.g., "2".
   * @example "2"
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  weight!: string;

  /**
   * Length of the shipment in cms.
   * Optional.
   * @example 15
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  length!: number;

  /**
   * Breadth of the shipment in cms.
   * Optional.
   * @example 10
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  breadth?: number;

  /**
   * Height of the shipment in cms.
   * Optional.
   * @example 5
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  height?: number;

  /**
   * Declared value of the shipment in rupees.
   * Optional.
   * @example 50
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  declared_value?: number;

  /**
   * Mode of shipment.
   * Optional. Can be "Air" or "Surface".
   * @example "Air"
   */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mode?: string;

  /**
   * Flag to indicate a return order.
   * Optional.
   * 1 = Return order, 0 = Normal order.
   * @example 0
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  is_return?: number;

  /**
   * Show only "documents" type couriers.
   * Optional. Only accepted value: 1
   * @example 1
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  couriers_type?: number;

  /**
   * Show only Hyperlocal couriers.
   * Optional. Only accepted value: 1
   * @example 1
   */
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  only_local?: number;

  /**
   * Filter only QC-enabled couriers.
   * Conditional: only valid if is_return = 1
   * Optional.
   * @example 1
   */
  @ApiPropertyOptional()
  @ValidateIf((o) => o.is_return === 1)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  qc_check?: number;

  @ApiPropertyOptional({
    description: `Page number, Ex: 1`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page, Ex: 10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
