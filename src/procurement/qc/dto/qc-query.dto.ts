import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OrderType } from '../../../common/dto/query.dto';

export enum QualityInspectionStatusDto {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

export class QcQueryDto {
  @ApiPropertyOptional({
    description: 'Search by notes or GRN number',
    example: 'Passed check',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by quality inspection status',
    enum: QualityInspectionStatusDto,
  })
  @IsOptional()
  @IsEnum(QualityInspectionStatusDto)
  status?: QualityInspectionStatusDto;

  @ApiPropertyOptional({
    description: 'Filter by Goods Receipt Note (GRN) ID',
    example: 'grn_123',
  })
  @IsOptional()
  @IsString()
  grnId?: string;

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
