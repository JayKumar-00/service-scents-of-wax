import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from '../../common/dto/query.dto';
import {
  FranchiseReturnStatus,
  ReturnInventoryEnum,
  OrderChannel,
} from '@prisma/client';

export enum ProductReturnSourceType {
  ORDER = 'ORDER',
  STOCK_REQUEST = 'STOCK_REQUEST',
}

export class ProductReturnListQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description:
      'Search by return id, reason, order number, or stock request id',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by return request id',
  })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Filter by order number',
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by stock request id',
  })
  @IsOptional()
  @IsString()
  stockRequestId?: string;

  @ApiPropertyOptional({
    description: 'Filter by source type',
    enum: ProductReturnSourceType,
  })
  @IsOptional()
  @IsEnum(ProductReturnSourceType)
  sourceType?: ProductReturnSourceType;

  @ApiPropertyOptional({
    description: 'Filter by source type',
    enum: OrderChannel,
  })
  @IsOptional()
  @IsEnum(OrderChannel)
  channel?: OrderChannel;

  @ApiPropertyOptional({
    description: 'Filter by franchise id (admin and superadmin only)',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by return status',
    enum: FranchiseReturnStatus,
  })
  @IsOptional()
  @IsEnum(FranchiseReturnStatus)
  status?: FranchiseReturnStatus;

  @ApiPropertyOptional({
    description: 'Filter by return type',
    enum: ReturnInventoryEnum,
  })
  @IsOptional()
  @IsEnum(ReturnInventoryEnum)
  returnType?: ReturnInventoryEnum;

  @ApiPropertyOptional({
    description: 'Alias kept for client-side compatibility',
  })
  @IsOptional()
  @Type(() => String)
  @IsString()
  q?: string;
}
