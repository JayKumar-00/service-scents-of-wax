import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

export class FranchiseInventoryQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search term for product name, slug, or category name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: `Filter by franchise ID, Ex: '123e4567-e89b-12d3-a456-426614174000'`,
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Minimum stock quantity',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minQty?: number;

  @ApiPropertyOptional({
    description: 'Maximum stock quantity',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxQty?: number;

  @ApiPropertyOptional({
    description: 'Minimum low stock threshold',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minLowStockThreshold?: number;

  @ApiPropertyOptional({
    description: 'Maximum low stock threshold',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxLowStockThreshold?: number;

  @ApiPropertyOptional({
    description:
      'Filter overall items or hide products with stock 0, availability 0, quantity 0',
    enum: BooleanEnum,
    default: BooleanEnum.FALSE,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  overAllItems?: BooleanEnum = BooleanEnum.FALSE;

  @ApiPropertyOptional({
    description: 'Filter by category ID',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by category slug, Ex: kids-clothes',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Filter by category slug (alias), Ex: kids-clothes',
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({
    description: `Filter by category title/name, Ex: "Kid's Clothes"`,
  })
  @IsOptional()
  @IsString()
  category?: string;
}
