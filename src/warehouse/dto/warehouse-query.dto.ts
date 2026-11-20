import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OrderType } from 'src/common/dto/query.dto';

export class WarehouseQueryDto {
  @ApiPropertyOptional({
    description: `Search text (product.name), Ex: 'text'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Product ID to filter by, Ex: "cmod1234"',
  })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: `Page number, Ex: 1`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page, Ex: 10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: `Sort order, Ex: 'asc' | 'desc'`,
    enum: OrderType,
    default: OrderType.DESC,
  })
  @IsOptional()
  @IsEnum(OrderType)
  order: OrderType = OrderType.ASC;
}

export class WarehouseWithoutPaginationQueryDto {
  @ApiPropertyOptional({
    description: `Search text (product.name), Ex: 'text'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Product ID to filter by, Ex: "cmod1234"',
  })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: `Sort order, Ex: 'asc' | 'desc'`,
    enum: OrderType,
    default: OrderType.DESC,
  })
  @IsOptional()
  @IsEnum(OrderType)
  order: OrderType = OrderType.ASC;
}
