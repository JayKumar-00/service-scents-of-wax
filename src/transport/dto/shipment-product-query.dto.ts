import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  ID = 'id',
  SKU = 'sku',
  NAME = 'name',
  CATEGORY = 'category_name',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  QTY = 'quantity',
  STATUS = 'status',
}

export class ShipmentProductQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter value',
  })
  @IsOptional()
  @IsString()
  filter?: string;

  @ApiPropertyOptional({
    description: 'Field to filter by',
  })
  @IsOptional()
  @IsString()
  filter_by?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.NAME,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
