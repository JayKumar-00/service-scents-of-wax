import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class InvoiceItemDto {
  @ApiProperty({
    description: 'ID of the product',
    example: 'prod_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description: 'ID of the product variant (if applicable)',
    example: 'var_1234567890',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({
    description: 'Title or name of the product',
    example: 'Wireless Bluetooth Headphones',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'SKU (Stock Keeping Unit) of the product',
    example: 'WH-1000XM4',
  })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({
    description: 'HSN (Harmonized System of Nomenclature) code for the product',
    example: '85176200',
  })
  @IsOptional()
  @IsString()
  hsnCode?: string;

  @ApiProperty({
    description: 'Quantity of the product being invoiced',
    example: 2,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  quantity!: number;

  @ApiProperty({
    description:
      'Unit price of the product in the smallest currency unit (e.g., cents)',
    example: '1999',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  unitPrice!: number;

  @ApiProperty({
    description:
      'Discount applied to the product in the smallest currency unit (e.g., cents)',
    example: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsNumber()
  discount?: number;

  @ApiProperty({
    description:
      'Taxable amount for the product in the smallest currency unit (e.g., cents)',
    example: '1799',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  taxableAmount!: number;

  @ApiProperty({
    description: 'GST rate applicable to the product (in percentage)',
    example: 18,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  gstRate!: number;

  @ApiProperty({
    description:
      'Total amount for the product line item in the smallest currency unit (e.g., cents)',
    example: 2123,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  totalAmount!: number;
}
