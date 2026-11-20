import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
}

export class NetworkInventoryQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search text (product.name), Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Franchise ID, Ex: 123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Minimum quantity, Ex: 10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minQty?: number;

  @ApiPropertyOptional({
    description: 'Maximum quantity, Ex: 10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxQty?: number;

  @ApiPropertyOptional({
    description: 'MinLowStockThreshold quantity, Ex: 10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minLowStockThreshold?: number;

  @ApiPropertyOptional({
    description: 'MaxLowStockThreshold quantity, Ex: 10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxLowStockThreshold?: number;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
