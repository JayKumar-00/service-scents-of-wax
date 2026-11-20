import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAsnLineDto {
  @ApiPropertyOptional({
    description: 'Associated Purchase Order Line ID, if linked',
    example: 'pol_abc123',
  })
  @IsOptional()
  @IsString()
  purchaseOrderLineId?: string;

  @ApiProperty({
    description: 'Product ID expected in the shipment',
    example: 'prod_98765',
  })
  @IsString()
  productId!: string;

  @ApiPropertyOptional({
    description: 'Optional SKU/Variant ID of the product',
    example: 'var_54321',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({
    description: 'Expected quantity of the product in this shipment line',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedQty?: number;
}


export class CreateAsnDto {
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  asnNumber?: string;

  @ApiPropertyOptional({
    description: 'Optional associated Purchase Order ID',
    example: 'po_12345',
  })
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @ApiProperty({
    description: 'ID of the supplier sending the shipment',
    example: 'supp_98765',
  })
  @IsString()
  supplierId!: string;

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

  @ApiPropertyOptional({
    description: 'List of shipment lines detailing expected items and quantities',
    type: [CreateAsnLineDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAsnLineDto)
  lines?: CreateAsnLineDto[];
}

