import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { toArray } from 'src/common/utils/transform-cutome.util';
import { IsGreaterThan } from 'src/products/utils/is-greater.util';

export class VariantAttributeDto {
  @ApiProperty({
    description: 'ID of the attribute name (e.g., cmo1323fcvjj, cmogfgdbjbvj)',
    example: 'cmofdhguf',
  })
  @IsString()
  attributeNameId!: string;

  @ApiProperty({
    description: 'ID of the attribute value (e.g., cmo1323fcvjj, cmogfgdbjbvj)',
    example: 'cmofdhguf',
  })
  @IsString()
  attributeValueId!: string;
}

export class CreateVariantDto {
  @ApiPropertyOptional({
    description:
      'Stock Keeping Unit - unique identifier for the variant. Auto-generated if not provided.',
    example: 'TSHIRT-RED-M',
  })
  @IsString()
  @IsOptional()
  sku?: string; // optional (auto generate if missing)

  @ApiPropertyOptional({
    description: 'Price of the product (Base Price)',
    example: 200.99,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  basePrice?: number;

  @ApiProperty({
    description: 'Price of the product (Selling Price)',
    example: 250.99,
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  // @IsGreaterThan('basePrice', {
  //   message: 'Price (Selling price) must be greater than base price',
  // })
  price!: number;

  @ApiPropertyOptional({
    description: 'Maximum Retail Price of the product (StrikeThrough Price',
    example: 999.99,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsGreaterThan('price', { message: 'MRP must be greater than price' })
  mrpPrice?: number;

  @ApiPropertyOptional({
    description: 'Whole saler Price of the product',
    example: 210.99,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  // @IsGreaterThan('basePrice', {
  //   message: 'WholesalePrice must be greater than base price',
  // })
  wholesalePrice?: number;

  @ApiPropertyOptional({
    description: 'Available stock quantity for the product variant',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stock?: number;

  @ApiPropertyOptional({
    description: 'Available stock quantity for the product',
    example: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  gstTax?: number = 18;

  @ApiPropertyOptional({
    description:
      'Key-value pairs of variant attributes (e.g., Color, Size). These define the specific characteristics of the variant.',
    type: [VariantAttributeDto],
  })
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeDto)
  attributes!: VariantAttributeDto[];

  @ApiPropertyOptional({
    description: 'Image URL for the product variant',
    example: 'https://example.com/images/tshirt-red-m.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Additional image URLs for the product variant',
    example: ['https://example.com/images/tshirt-red-m.jpg'],
  })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  imageUrls?: string[];
}
