import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsIn,
} from 'class-validator';

/**
 * QC Details DTO
 */
export class QcDetailsDto {
  @ApiProperty({
    description: 'Product image URL used for QC verification',
    example: 'https://abc.com/product.jpg',
  })
  @IsString()
  @IsNotEmpty()
  product_image!: string;

  @ApiPropertyOptional({
    description: 'Brand name visible on product',
    example: 'Apple',
  })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Brand tag attached to product',
    example: 'Apple',
  })
  @IsString()
  @IsOptional()
  brand_tag?: string;

  @ApiProperty({
    description: 'Product color',
    example: 'Black',
  })
  @IsString()
  @IsNotEmpty()
  color!: string;

  @ApiProperty({
    description: 'Product size',
    example: 'L',
  })
  @IsString()
  @IsNotEmpty()
  size!: string;

  @ApiPropertyOptional({
    description: 'IMEI number (for electronic items)',
    example: '123456789012345',
  })
  @IsString()
  @IsOptional()
  product_imei?: string;

  @ApiPropertyOptional({
    description: 'Unique serial number',
    example: 'SN123456',
  })
  @IsString()
  @IsOptional()
  serial_no?: string;
}

/**
 * Add New Product DTO
 */
export class AddNewProductDto {
  @ApiProperty({
    description: 'Stock Keeping Unit (unique product identifier)',
    example: 'SKU12345',
  })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiPropertyOptional({
    description: 'HSN code for tax classification',
    example: '85171200',
  })
  @IsString()
  @IsOptional()
  hsn?: string;

  @ApiProperty({
    description: 'Product name',
    example: 'iPhone 13 Pro Max',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Tax percentage',
    example: '18',
  })
  @IsString()
  @IsOptional()
  tax_code?: string;

  @ApiProperty({
    description: 'Product type',
    example: 'Single',
    enum: ['Single', 'Multiple'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['Single', 'Multiple'])
  type!: string;

  @ApiProperty({
    description: 'Total quantity available',
    example: 10,
  })
  @Type(() => Number)
  @IsNumber()
  qty!: number;

  @ApiPropertyOptional({
    description: 'Low stock alert threshold',
    example: '5',
  })
  @IsString()
  @IsOptional()
  low_stock?: string;

  @ApiProperty({
    description: 'Category code from Shiprocket panel',
    example: 'default',
  })
  @IsString()
  @IsNotEmpty()
  category_code!: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Apple flagship smartphone',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Brand name',
    example: 'Apple',
  })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Weight in kg',
    example: 0.5,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({
    description: 'Length in cm',
    example: 15,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  length?: number;

  @ApiPropertyOptional({
    description: 'Width in cm',
    example: 7,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({
    description: 'Height in cm',
    example: 8,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({
    description: 'Manufacturing cost price',
    example: 80000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  cost_price?: number;

  @ApiPropertyOptional({
    description: 'Maximum retail price',
    example: '100000',
  })
  @IsString()
  @IsOptional()
  mrp?: string;

  @ApiPropertyOptional({
    description: 'QC details (only for QC-enabled products)',
    type: [QcDetailsDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QcDetailsDto)
  @IsOptional()
  qc_details?: QcDetailsDto[];
}
