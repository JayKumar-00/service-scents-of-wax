import { ApiPropertyOptional } from '@nestjs/swagger';
import { FranchiseReturnStatus, OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  STATUS = 'status',
}

export class FranchiseReturnQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description:
      'Search term for franchise return (franchise.name, franchise.code, reason), Ex: "gift box"',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Franchise return ID, Ex: "frret_123"',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Franchise return ID, Ex: "frret_123"',
  })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Franchise return ID, Ex: "frret_123"',
  })
  @IsOptional()
  @IsString()
  refundRequested?: string;

  @ApiPropertyOptional({
    description: `Franchise return status, Ex: ${Object.values(FranchiseReturnStatus).join(' | ')}`,
    enum: FranchiseReturnStatus,
  })
  @IsOptional()
  @IsEnum(FranchiseReturnStatus)
  status?: FranchiseReturnStatus;

  @ApiPropertyOptional({
    description: `Franchise return's order status, Ex: ${Object.values(OrderStatus).join(' | ')}`,
    enum: OrderStatus,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
