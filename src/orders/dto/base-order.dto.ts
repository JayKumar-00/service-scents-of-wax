import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class BaseOrderDto {
  @ApiProperty({
    description: 'ID of the product being sold',
    example: 'prod_123',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description: 'Quantity of the product being sold',
    example: 2,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Optional product variant ID to use for pricing and sale',
    example: 'var_456',
  })
  @IsOptional()
  @IsString()
  variantId?: string;
}
