import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockingNodeType } from '@prisma/client';
import { IsEnum, IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class StockingNodeInventoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by a single StockingNodeType',
    enum: StockingNodeType,
  })
  @IsEnum(StockingNodeType)
  @IsOptional()
  type?: StockingNodeType;

  @ApiPropertyOptional({
    description:
      'Filter by franchise ID (applicable to STORE or other stocking nodes associated with a franchise)',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Search string',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Minimum quantity filter',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  minQty?: number;

  @ApiPropertyOptional({
    description: 'Maximum quantity filter',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  maxQty?: number;

  @ApiPropertyOptional({
    description: 'Page number (default 1)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page (default 10)',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
