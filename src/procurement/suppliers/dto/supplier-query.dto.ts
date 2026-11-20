import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OrderType } from '../../../common/dto/query.dto';
import { SupplierStatusDto } from './create-supplier.dto';

export class SupplierQueryDto {
  @ApiPropertyOptional({
    description: 'Search by supplier name, code, contact person, email, or phone',
    example: 'Acme',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by supplier status',
    enum: SupplierStatusDto,
  })
  @IsOptional()
  @IsEnum(SupplierStatusDto)
  status?: SupplierStatusDto;

  @ApiPropertyOptional({
    description: 'Page number for pagination (default: 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page (default: 10)',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "Sort order ('asc' or 'desc', default: 'desc')",
    enum: OrderType,
    default: OrderType.DESC,
  })
  @IsOptional()
  @IsEnum(OrderType)
  order?: OrderType = OrderType.DESC;

  @ApiPropertyOptional({
    description: 'Field to sort by (default: "createdAt")',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';
}
