import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class SubmitAsnDto {
  @ApiPropertyOptional({
    description: 'Supplier invoice or reference number',
    example: 'INV-SUPP-992',
  })
  @IsOptional()
  @IsString()
  supplierInvoiceNo?: string;

  @ApiPropertyOptional({
    description: 'Optional delivery vehicle number plate details',
    example: 'KA-01-MJ-1234',
  })
  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @ApiPropertyOptional({
    description: 'Courier provider name',
    example: 'DHL Express',
  })
  @IsOptional()
  @IsString()
  courier?: string;

  @ApiPropertyOptional({
    description: 'Shipment tracking number',
    example: 'TRK99283182',
  })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({
    description: 'Expected arrival date and time of the delivery shipment',
    example: '2026-08-15T14:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expectedArrival?: string;

  @ApiPropertyOptional({
    description: 'Additional shipment notes or comments',
    example: 'Fragile items, handle with care.',
  })
  @IsOptional()
  @IsString()
  shipmentNote?: string;
}
