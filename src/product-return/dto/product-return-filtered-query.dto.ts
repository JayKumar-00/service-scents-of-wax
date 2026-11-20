import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProductReturnSourceType } from './product-return-list-query.dto';
import { QueryDto } from 'src/common/dto/query.dto';
import {
  ReturnConflictInventoryStatus,
  ReturnInventoryKind,
  ReturnSourceType,
} from '@prisma/client';

export class ProductReturnFilteredQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by source type',
    enum: ProductReturnSourceType,
  })
  @IsOptional()
  @IsEnum(ProductReturnSourceType)
  sourceType?: ProductReturnSourceType;

  @ApiPropertyOptional({
    description: 'Filter by franchise id',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;
}

export class ReturnInventoryQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by franchise id',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by franchise id',
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by product id',
  })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filter by kind',
    enum: ReturnInventoryKind,
  })
  @IsEnum(ReturnInventoryKind)
  @IsOptional()
  kind?: ReturnInventoryKind;

  @ApiPropertyOptional({
    description: 'Filter by source type',
    enum: ReturnSourceType,
  })
  @IsEnum(ReturnSourceType)
  @IsOptional()
  sourceType?: ReturnSourceType;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ReturnConflictInventoryStatus,
  })
  @IsEnum(ReturnConflictInventoryStatus)
  @IsOptional()
  status?: ReturnConflictInventoryStatus;
}
