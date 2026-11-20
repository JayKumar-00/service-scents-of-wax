import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

/** Apply a relative change (negative = write-off) to central warehouse stock */
export class WarehouseDeltaDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description: 'Optional variant ID',
    example: 'cmqgzne8n00362k660apfahwg',
  })
  @IsString()
  @IsOptional()
  variantId?: string;

  @ApiProperty({
    description: 'Change in quantity (negative for write-off)',
    example: -5,
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  delta!: number;

  @ApiProperty({
    description: 'Optional reason for the stock change',
    example: 'Damaged during transit',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
