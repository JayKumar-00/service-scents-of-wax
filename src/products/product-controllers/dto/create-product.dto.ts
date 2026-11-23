import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { toArray, toBoolean } from 'src/common/utils/transform-cutome.util';
import { IsGreaterThan } from 'src/products/utils/is-greater.util';
import { CreateVariantDto } from './create-product-variant.dto';

class SeoDto {
  @ApiProperty()
  @Transform(({ value }) => value?.trim())
  @IsString()
  title!: string;

  @ApiProperty()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  keywords!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  tags?: string[];
}

export class ExplicitAttributeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  value?: string;
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Name of the product',
    example: 'Handmade Wooden Toy Car',
  })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'URL-friendly unique identifier for the product',
    example: 'handmade-wooden-toy-car',
  })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({
    description:
      'Features of the product, provided as a comma-separated string or an array of strings',
    example: ['Handmade', 'Wooden', 'Eco-friendly'],
  })
  @Transform(({ value }) => toArray(value))
  @IsArray()
  features: string[] = [];

  @ApiPropertyOptional({
    description: 'Detailed description of the product',
    example:
      'This is a beautifully crafted handmade wooden toy car, perfect for children aged 3 and above.',
  })
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'ID of the category this product belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiPropertyOptional({
    description: 'ID of the brand associated with the product',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    description: 'ID or name of the brand associated with the product (alias for brandId)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Price of the product (Base Price)',
    example: 200.99,
  })
  @ValidateIf((o) => !o.variants?.length)
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  basePrice?: number;

  @ApiProperty({
    description: 'Price of the product (Selling Price)',
    example: 250.99,
  })
  @ValidateIf((o) => !o.variants?.length)
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  // @IsGreaterThan('basePrice', {
  //   message: 'Price must be greater than base price',
  // })
  price!: number;

  @ApiPropertyOptional({
    description: 'Maximum Retail Price of the product (StrikeThrough Price',
    example: 999.99,
  })
  @ValidateIf((o) => !o.variants?.length)
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsGreaterThan('price', { message: 'MRP must be greater than price' })
  mrpPrice?: number;

  @ApiPropertyOptional({
    description: 'Whole saler Price of the product',
    example: 210.99,
  })
  @ValidateIf((o) => !o.variants?.length)
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  // @IsGreaterThan('basePrice', {
  //   message: 'WholesalePrice must be greater than base price',
  // })
  wholesalePrice?: number;

  @ApiPropertyOptional({
    description: 'URL of the main product image',
    example: '/images/product123.jpg',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Additional image URLs for the product',
    example: ['/images/product123_1.jpg', '/images/product123_2.jpg'],
  })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  imageUrls?: string[];

  @ApiPropertyOptional({
    description: 'List of product variants (e.g., different sizes or colors)',
    type: [CreateVariantDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @ApiPropertyOptional({ type: [ExplicitAttributeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExplicitAttributeDto)
  explicitAttributes?: ExplicitAttributeDto[] = [];

  @ApiProperty({
    description: 'SEO metadata for the product',
    type: SeoDto,
    example: {
      title: 'Buy Handmade Wooden Toy Car Online',
      keywords: ['handmade', 'wooden', 'toy', 'car'],
      tags: ['@kids', '@toys', '@wooden toys'],
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoDto)
  seo!: SeoDto;

  @ApiPropertyOptional({
    description:
      'Occasions suitable for the product (e.g., Birthday, Anniversary)',
    example: 'Birthday, Anniversary',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  occasions?: string;

  @ApiPropertyOptional({
    description: 'Available stock quantity for the product',
    example: 100,
  })
  @Type(() => Number)
  @IsOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  fastDelivery?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isFeatured?: boolean;
}
