import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGrnLineDto {
  @ApiPropertyOptional({
    description: 'Associated Purchase Order Line ID (optional, resolved internally if omitted)',
    example: 'pol_abc123',
  })
  @IsOptional()
  @IsString()
  purchaseOrderLineId?: string;

  @ApiProperty({
    description: 'Product ID being received',
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

  @ApiProperty({
    description: 'Quantity of items received from delivery',
    example: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  receivedQty!: number;

  @ApiProperty({
    description: 'Quantity of received items that are accepted after check',
    example: 95,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  acceptedQty!: number;

  @ApiProperty({
    description: 'Quantity of received items that are damaged',
    example: 2,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  damagedQty!: number;

  @ApiProperty({
    description: 'Quantity of received items that are rejected (excluding damaged)',
    example: 3,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rejectedQty!: number;
}


export class CreateGrnDto {
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  grnNumber?: string;

  @ApiProperty({
    description: 'Associated Purchase Order ID',
    example: 'po_12345',
  })
  @IsString()
  purchaseOrderId!: string;

  @ApiPropertyOptional({
    description: 'Optional associated Advance Shipping Notice (ASN) ID',
    example: 'asn_12345',
  })
  @IsOptional()
  @IsString()
  asnId?: string;

  @ApiProperty({
    description: 'ID of the supplier supplying the goods',
    example: 'supp_98765',
  })
  @IsString()
  supplierId!: string;

  @ApiPropertyOptional({
    description: 'Optional stocking warehouse node ID where goods are stored',
    example: 'wh_node_abc',
  })
  @IsOptional()
  @IsString()
  warehouseNodeId?: string;

  @ApiPropertyOptional({
    description: 'List of goods receipt lines representing individual items received',
    type: [CreateGrnLineDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGrnLineDto)
  lines?: CreateGrnLineDto[];
}

