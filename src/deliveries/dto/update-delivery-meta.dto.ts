import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** Empty string clears carrier/tracking/ETA when PATCHing meta. */
export class UpdateDeliveryMetaDto {
  @ApiPropertyOptional({
    description: 'Name of the carrier responsible for the delivery',
    example: 'FedEx',
  })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({
    description: 'Tracking code or number provided by the carrier',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  trackingCode?: string;

  /** ISO datetime string; empty string clears expectedAt */
  @ApiPropertyOptional({
    description:
      'Expected delivery date and time in ISO format (e.g., 2024-12-31T23:59:59Z). Use an empty string to clear the expected delivery date.',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  expectedAt?: string;

  @ApiPropertyOptional({
    description: 'ID of the transport lane associated with this delivery',
    example: 'lane_12345',
  })
  @IsOptional()
  @IsString()
  transportLaneId?: string;

  @ApiPropertyOptional({
    description: 'Carrier-specific reference or notes for the delivery',
    example: 'Leave at front door if no answer',
  })
  @IsOptional()
  @IsString()
  carrierReference?: string;

  /** ISO datetime; empty clears slaDueAt */
  @ApiPropertyOptional({
    description:
      'SLA due date and time in ISO format (e.g., 2024-12-31T23:59:59Z). Use an empty string to clear the SLA due date.',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  slaDueAt?: string;

  @ApiPropertyOptional({
    description: 'Additional ASN data from the carrier or transport system',
    example: { manifestId: 'manifest_12345', driverName: 'John Doe' },
  })
  @IsOptional()
  @IsObject()
  asnPayload?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Quantity of items shipped (for partial shipments). Use a non-negative integer. This does not update inventory quantities; it is for record-keeping and discrepancy tracking purposes.',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityShipped?: number;

  @ApiPropertyOptional({
    description:
      'Quantity of items received (for partial receipts). Use a non-negative integer. This does not update inventory quantities; it is for record-keeping and discrepancy tracking purposes.',
    example: 45,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityReceived?: number;

  @ApiPropertyOptional({
    description:
      'Notes regarding any discrepancies between shipped and received quantities, or other issues observed during delivery. Use this field to provide context for partial shipments/receipts or to document any problems encountered.',
    example: '5 items damaged during transit',
  })
  @IsOptional()
  @IsString()
  discrepancyNote?: string;

  @ApiPropertyOptional({
    description:
      'Quantity of items damaged (for recording damaged goods upon receipt). Use a non-negative integer. This does not update inventory quantities; it is for record-keeping and discrepancy tracking purposes.',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  damagedQuantity?: number;
}
