import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class WarehouseThresholdDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description: 'Low stock threshold quantity',
    example: 5,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  lowStockThreshold!: number;
}
