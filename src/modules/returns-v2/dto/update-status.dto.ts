import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ReturnStatus,
  ReturnCondition,
  WarehouseDisposition,
} from '@prisma/client';

export class ReturnItemUpdateDto {
  @ApiProperty({
    description: 'The database ID of the ReturnItem row.',
    example: 'item_12345',
  })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiPropertyOptional({
    description: 'The quantity actually received.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  receivedQty?: number;

  @ApiPropertyOptional({
    description: 'The quantity approved for refund or exchange.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approvedQty?: number;

  @ApiPropertyOptional({
    description: 'The assessed condition of the item.',
    enum: ReturnCondition,
    example: ReturnCondition.GOOD,
  })
  @IsOptional()
  @IsEnum(ReturnCondition)
  condition?: ReturnCondition;

  @ApiPropertyOptional({
    description: 'The warehouse disposition for central warehouse processing.',
    enum: WarehouseDisposition,
    example: WarehouseDisposition.RESTOCK,
  })
  @IsOptional()
  @IsEnum(WarehouseDisposition)
  warehouseDisposition?: WarehouseDisposition;

  @ApiPropertyOptional({
    description: 'Any remarks for this item.',
    example: 'Scratch on back',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateStatusDto {
  @ApiProperty({
    description:
      'The next target status in the state machine (excluding QC statuses). Allowed: APPROVED, REJECTED, PICKUP_SCHEDULED, PICKUP_COMPLETED, RECEIVED_AT_FRANCHISE, IN_TRANSIT_TO_WAREHOUSE, RECEIVED_AT_WAREHOUSE, UNDER_INSPECTION, WAREHOUSE_QC, REFUND_PROCESSED, EXCHANGE_ORDER_CREATED, CLOSED.',
    enum: [
      ReturnStatus.APPROVED,
      ReturnStatus.REJECTED,
      ReturnStatus.PICKUP_SCHEDULED,
      ReturnStatus.PICKUP_COMPLETED,
      ReturnStatus.RECEIVED_AT_FRANCHISE,
      ReturnStatus.IN_TRANSIT_TO_WAREHOUSE,
      ReturnStatus.RECEIVED_AT_WAREHOUSE,
      ReturnStatus.UNDER_INSPECTION,
      ReturnStatus.WAREHOUSE_QC,
      ReturnStatus.REFUND_PROCESSED,
      ReturnStatus.EXCHANGE_ORDER_CREATED,
      ReturnStatus.CLOSED,
    ],
    example: ReturnStatus.UNDER_INSPECTION,
  })
  @IsEnum(ReturnStatus)
  @IsNotEmpty()
  status!: ReturnStatus;

  @ApiPropertyOptional({
    description: 'Remarks or justification for the status change.',
    example: 'Received at franchise outlet.',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Transaction reference number for payment refunds.',
    example: 'REF123456789',
  })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'Courier partner name (e.g., Shiprocket, Delhivery).',
    example: 'Shiprocket',
  })
  @IsOptional()
  @IsString()
  courierName?: string;

  @ApiPropertyOptional({
    description: 'Air Waybill (AWB) number.',
    example: 'AWB123456789',
  })
  @IsOptional()
  @IsString()
  awbNumber?: string;

  @ApiPropertyOptional({
    description: 'Courier tracking number.',
    example: 'TRK123456789',
  })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({
    description: 'Current shipment status from tracking provider.',
    example: 'In Transit',
  })
  @IsOptional()
  @IsString()
  shipmentStatus?: string;

  @ApiPropertyOptional({
    description: 'Raw tracking events or payload from carrier.',
    example: { status: 'picked_up', timestamp: '2026-06-13T10:00:00Z' },
  })
  @IsOptional()
  trackingEvents?: any;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemUpdateDto)
  items?: ReturnItemUpdateDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class CompleteInspectionDto {
  @ApiProperty({
    description: 'The inspection outcome status.',
    enum: [
      ReturnStatus.QC_PASSED,
      ReturnStatus.QC_FAILED,
      ReturnStatus.QC_CONFLICT,
    ],
    example: ReturnStatus.QC_PASSED,
  })
  @IsEnum([
    ReturnStatus.QC_PASSED,
    ReturnStatus.QC_FAILED,
    ReturnStatus.QC_CONFLICT,
  ])
  @IsNotEmpty()
  status!: ReturnStatus;

  @ApiPropertyOptional({
    description: 'General inspection remarks.',
    example: 'Items inspected successfully.',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    description: 'Detailed inspection outcome per item.',
    type: [ReturnItemUpdateDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemUpdateDto)
  items!: ReturnItemUpdateDto[];

  @ApiPropertyOptional({
    description: 'URLs of the inspection photos.',
    type: [String],
    example: ['https://example.com/image1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
