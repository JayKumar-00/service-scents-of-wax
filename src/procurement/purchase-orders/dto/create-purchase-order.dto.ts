import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, IsInt, IsNumber, IsNumberString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderLineDto {
  @ApiProperty({
    description: 'ID of the product being ordered',
    example: 'prod_12345',
  })
  @IsString()
  productId!: string;

  @ApiPropertyOptional({
    description: 'Optional SKU/Variant ID of the product',
    example: 'var_67890',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({
    description: 'Quantity of the product being ordered',
    example: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderedQty!: number;

  @ApiProperty({
    description: 'Unit cost price of the product',
    example: 150.50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional({
    description: 'GST tax percentage rate applied to the product',
    example: 18,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gstPercent?: number;

  @ApiPropertyOptional({
    description: 'Minimum Order Quantity (MOQ) requirement for this item',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moq?: number;

  // @ApiPropertyOptional({ description: 'Base/Procurement Price' })
  // @IsOptional()
  // @Type(() => Number)
  // basePrice?: number;

  @ApiPropertyOptional({ description: 'Wholesale Price' })
  @IsOptional()
  @Type(() => Number)
  wholesalePrice?: number;

  @ApiPropertyOptional({ description: 'Selling Price' })
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({ description: 'MRP (StrikeThrough) Price' })
  @IsOptional()
  @Type(() => Number)
  mrpPrice?: number;
}

export class CreatePurchaseOrderDto {
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  poNumber?: string;

  @ApiProperty({
    description: 'ID of the supplier supplying the items',
    example: 'supp_abc123',
  })
  @IsString()
  supplierId!: string;

  @ApiPropertyOptional({
    description: 'Optional warehouse stocking node ID where the goods will be delivered',
    example: 'wh_node_xyz',
  })
  @IsOptional()
  @IsString()
  warehouseNodeId?: string;

  @ApiPropertyOptional({
    description: 'Currency code for the purchase order',
    example: 'INR',
    default: 'INR',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Expected arrival date for the order delivery',
    example: '2026-09-01T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({
    description: 'Optional notes regarding the purchase order',
    example: 'Deliver during standard business hours only.',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Total estimated value amount of the PO',
    example: '17759.00',
  })
  @IsOptional()
  @IsNumberString()
  totalAmount?: string;

  @ApiPropertyOptional({
    description: 'List of line items included in the purchase order',
    type: [CreatePurchaseOrderLineDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines?: CreatePurchaseOrderLineDto[];
}

