import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** Set absolute quantity at central warehouse for a SKU */
export class AdjustWarehouseStockDto {
  @ApiProperty({
    description: 'Product ID to adjust stock for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description: 'Optional variant ID to adjust stock for a specific variant',
    example: 'cmqgzne8n00362k660apfahwg',
  })
  @IsString()
  @IsOptional()
  variantId?: string;

  @ApiProperty({
    description: 'New absolute quantity for the product',
    example: 100,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Optional reason for the stock adjustment',
    example: 'Initial stock setup',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
