import {
  ApiPropertyOptional,
  OmitType,
  ApiHideProperty,
} from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from '../../../common/dto/query.dto';
import {
  ReturnSourceType,
  ReturnType,
  ReturnStatus,
  OrderChannel,
} from '@prisma/client';

export class ListReturnsQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description:
      'Search by return number, reason, order number, or stock request ID',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by source type',
    enum: OrderChannel,
  })
  @IsOptional()
  @IsEnum(OrderChannel)
  channel?: OrderChannel;

  @ApiPropertyOptional({
    description: 'Filter by return type',
    enum: ReturnType,
  })
  @IsOptional()
  @IsEnum(ReturnType)
  returnType?: ReturnType;

  @ApiPropertyOptional({
    description: 'Filter by source type',
    enum: ReturnSourceType,
  })
  @IsOptional()
  @IsEnum(ReturnSourceType)
  sourceType?: ReturnSourceType;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ReturnStatus,
  })
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @ApiPropertyOptional({
    description: 'Filter by franchise ID',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by order number associated with the return',
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by stock request ID associated with the return',
  })
  @IsOptional()
  @IsString()
  stockRequestId?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;
}

export class WithoutReturnPaginationDto extends OmitType(ListReturnsQueryDto, [
  'page',
  'limit',
] as const) {
  @ApiHideProperty()
  page?: never;

  @ApiHideProperty()
  limit?: never;
}
