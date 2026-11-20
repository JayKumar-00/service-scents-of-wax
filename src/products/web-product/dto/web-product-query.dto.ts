import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum WebProductSortBy {
  NEWEST = 'createdAt',
  OLDEST = 'oldest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  RATING_DESC = 'rating_desc',
  POPULAR = 'popular',
  A_Z = 'name_asc',
  Z_A = 'name_desc',
  RELEVANCE = 'relevance',
  FEATURED = 'featured',
  BESTSELLER = 'bestseller',
}

export class WebProductQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search text (product name/brand/category/slug). If category name matches (e.g. 'Electronics'), returns all products from that category and all child categories. Ex: 'iPhone' or 'Electronics'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by category slug, Ex: electronics',
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;

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
    description: 'Filter by brand names (comma-separated), Ex: Apple,Samsung',
  })
  @IsOptional()
  @IsString()
  brands?: string;

  @ApiPropertyOptional({
    description: 'Filter by minimum price, Ex: 100',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Filter by maximum price, Ex: 10000',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Filter by minimum rating (0-5), Ex: 3',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Filter by stock availability (true/false)',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  inStock?: ['true', 'false'];

  @ApiPropertyOptional({
    description: 'Filter by fast delivery availability (true/false)',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  fastDelivery?: ['true', 'false'];

  @ApiPropertyOptional({
    description: 'Filter by featured products only (true/false)',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  featuredOnly?: ['true', 'false'];

  @ApiPropertyOptional({
    description:
      'Filter by occasions (comma-separated), Ex: birthday,anniversary',
  })
  @IsOptional()
  @IsString()
  occasions?: string;

  @ApiPropertyOptional({
    description: `Sort order`,
    enum: WebProductSortBy,
    default: WebProductSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(WebProductSortBy)
  sortBy?: WebProductSortBy;
}
