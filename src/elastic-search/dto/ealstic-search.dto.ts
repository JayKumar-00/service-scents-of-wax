import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

enum SortBy {
  POPULAR = 'popular',
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  RELEVANCE = 'relevance',
}

/**
 * DTO for unified product search request
 * Supports search by: title, sub_title, brand, category, attributes, features, SKU, description
 * Supports filtering by: categoryId (with hierarchical support), categoryName, brandName, price range
 * Supports sorting by: relevance, price, newest, popular
 * NOTE: categoryId filters by category AND all its subcategories for hierarchical support
 */
export class ElasticSearchQueryDto {
  @ApiPropertyOptional({
    description:
      'Search query string (searches across title, sub_title, brand, category, sku, description, features)',
  })
  @IsString()
  @IsOptional()
  query?: string; // Search term (can match any product field)

  @ApiPropertyOptional({
    description:
      'Auto-complete input for AI suggestions (not used in main search, but can trigger AI fallback if no results)',
  })
  @IsString()
  @IsOptional()
  autoComplete?: string; // Optional field for AI suggestions (not used in main search)

  @ApiPropertyOptional({
    description:
      'Category ID to filter by - returns products belonging to this category AND all subcategories (hierarchical)',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      'Category name to filter by (DEPRECATED - use categoryId instead for better hierarchy support)',
  })
  @IsOptional()
  @IsString()
  categoryName?: string;

  @ApiPropertyOptional({
    description: 'Brand name to filter by',
  })
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiPropertyOptional({
    description: 'Minimum price filter',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum price filter',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceMax?: number;

  @ApiPropertyOptional({
    enum: SortBy,
    description:
      'Sort results by: relevance, price_asc, price_desc, newest, popular',
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.RELEVANCE;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (max 100)',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20; // Max results to return

  @ApiPropertyOptional({
    description:
      'Filter by product attributes (JSON format: {"label": "value"})',
  })
  @IsOptional()
  @IsString()
  attributes?: string; // JSON string: {"color": "red", "size": "large"}

  @ApiPropertyOptional({
    description: 'Customer ID for personalized search history suggestions',
  })
  @IsOptional()
  @IsString()
  customerId?: string;
}

/**
 * Individual product search result
 */
export class ElasticSearchResult {
  id?: string; // Product ID
  title?: string; // Product title
  subtitle?: string; // Product subtitle
  price?: number; // Selling price
  mrp?: number; // Maximum retail price
  image?: string; // Product image URL
  brand?: string; // Brand name
  category?: string; // Category name
  sku?: string; // Product SKU
  rating?: number; // Product rating
  relevance?: number; // Relevance score 0-100
  attributes?: Array<{ label: string; value: string }>; // Product attributes
  matched_field?: string; // Field where match found (title, brand, features, etc.)
}

/**
 * Search suggestion result
 */
export class SearchSuggestion {
  text?: string; // Suggested search term
  type?: 'product' | 'category' | 'brand' | 'intent' | 'history' | 'keyword'; // Type of suggestion
  productId?: string; // Product ID if type is 'product'
  confidence?: number; // Confidence score 0-100
}

/**
 * Response DTO for product search
 * Follows standard API response format with metadata
 */
export class SmartSearchResponseDto {
  status?: number; // HTTP status code (200, 400, etc.)
  success?: boolean; // Whether search was successful
  message?: string; // Human-readable message
  source?: 'elasticsearch' | 'mongodb' | 'hybrid'; // Data source
  timestamp?: string; // ISO timestamp of response

  // Search results data
  query?: string; // Original user query
  total_results?: number; // Total matching results in DB
  results?: ElasticSearchResult[]; // Actual search results (paginated)

  // Pagination metadata
  page?: number; // Current page number
  limit?: number; // Items per page
  hasNext?: boolean; // Whether more results exist
  totalPages?: number; // Total number of pages

  // AI-powered suggestions (returned when no results or low confidence)
  suggestions?: SearchSuggestion[]; // AI-generated suggestions (max 5)
  usedAI?: boolean; // Whether AI fallback was used

  execution_time_ms?: number; // Search execution time in milliseconds
}
