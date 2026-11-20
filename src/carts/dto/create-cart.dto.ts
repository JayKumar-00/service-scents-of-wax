import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({ description: 'Variant ID (optional)' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ description: 'Quantity', minimum: 1, default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number = 1;
}

export class CreateAndAddCartDto {
  @ApiProperty({ description: 'Cart item to add', type: CartItemDto })
  @ValidateNested()
  @Type(() => CartItemDto)
  item!: CartItemDto;
}

export class BulkAddCartDto {
  @ApiProperty({ description: 'Array of items to add', type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
