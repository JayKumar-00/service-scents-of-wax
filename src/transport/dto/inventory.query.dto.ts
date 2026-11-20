import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  ID = 'id',
  TOTAL_QTY = 'total_quantity',
  AVAIL_QTY = 'available_quantity',
  BLOCK_QTY = 'blocked_quantity',
  CATEGORY = 'category_name',
  UPDATE_ON = 'updated_on',
  SKU = 'sku',
  IS_COMBO = 'is_combo',
  NAME = 'name',
  TYPE = 'type',
  COLOR = 'color',
  BRAND = 'brand',
}

export class InventoryQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.AVAIL_QTY,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
