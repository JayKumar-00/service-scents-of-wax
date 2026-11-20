import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';
/**
 * Enum for attribute sorting options
 * @enum {string}
 */
export enum SortBy {
  /** Sort by creation date */
  CREATED_AT = 'createdAt',
}

/**
 * DTO for querying attributes with optional filters
 * @class AttributeQueryDto
 * @extends QueryDto
 */
export class AttributeQueryDto extends QueryDto {
  /**
   * Search text to filter attributes by title or slug
   * @example 'Electronics'
   */
  @ApiPropertyOptional({
    description: `Search text ( title, slug ), Ex: 'Electronics'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Field to sort the attributes by
   * @example SortBy.CREATED_AT
   */
  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
