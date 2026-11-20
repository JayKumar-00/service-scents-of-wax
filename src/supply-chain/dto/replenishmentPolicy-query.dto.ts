import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  NAME = 'name',
  ALLOC_PRIORITY = 'allocationPriority',
}

export class ReplenishmentPolicyQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Franchise ID, Ex: 123e4567-e89b-12d3-a456-426614174000',
  })
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Product ID, Ex: 123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Minimum quantity, Ex: 10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minQty?: number;

  @ApiPropertyOptional({
    description: 'Maximum quantity, Ex: 100',
  })
  maxQty?: number;

  @ApiPropertyOptional({
    description: 'Active status, Ex: true or false',
    enum: ['true', 'false'],
  })
  @IsEnum(['true', 'false'])
  @IsOptional()
  active?: ['true', 'false'];

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
