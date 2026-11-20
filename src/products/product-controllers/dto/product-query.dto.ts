import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  DEFAULT_PRICE = 'defaultPrice',
  TITLE = 'title',
  RELEVANCE = 'relevance',
  FEATURED = 'featured',
  PRICE = 'price',
  NEWEST = 'newest',
  RATING = 'rating',
  BESTSELLER = 'bestseller',
}

export class CatalogListParamsDto extends QueryDto {
  @ApiPropertyOptional({
    description: `required, Filter by category slug, Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({
    description: `Filter by price range, Ex: minPrice=10&maxPrice=100`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional({
    description: `Filter by price range, Ex: minPrice=10&maxPrice=100`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({
    description: `Filter by brands, Ex: brand1, brand2`,
  })
  @IsOptional()
  @IsString()
  brands?: string;

  @ApiPropertyOptional({
    description: `Filter by occasions, Ex: occasion1, occasion2`,
  })
  @IsOptional()
  @IsString()
  occasions?: string;

  @ApiPropertyOptional({
    description: `Filter by minimum rating, Ex: minRating=2`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRating?: number;

  @ApiPropertyOptional({
    description: `Filter by maximum rating, Ex: maxRating=4`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxRating?: number;

  @ApiPropertyOptional({
    description: `Filter by stock availability, Ex: inStock=true`,
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  inStock?: ['true', 'false'];

  @ApiPropertyOptional({
    description: `Filter by fast delivery option, Ex: fastDelivery=true`,
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  fastDelivery?: ['true', 'false'];

  @ApiPropertyOptional({
    description: `Filter by featured products, Ex: featuredOnly=true`,
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  featuredOnly?: ['true', 'false'];
}

export class ProductQueryDto extends CatalogListParamsDto {
  @ApiPropertyOptional({
    description: `Search text (title/slug/seo_title/seo_sub_title), Ex: 'Electronics'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by franchise ID',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by stock node ID',
  })
  @IsOptional()
  @IsString()
  stockNodeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by category ID',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by brand ID',
  })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ProductStatus,
    example: ProductStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Filter by visibility (true/false)',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  visibility?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;

  @ApiPropertyOptional({
    description: 'Set to true to trigger export permission checks',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsString()
  export?: string;
}
