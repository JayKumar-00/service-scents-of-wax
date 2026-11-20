import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class PreviewFranchisesDto {
  @ApiPropertyOptional({
    description: 'Latitude of the location',
    example: 12.9716,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude of the location',
    example: 77.5946,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'PIN code / Postal code of the location',
    example: '560001',
  })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({
    description: 'Proximity range in kilometers',
    example: 25,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10000)
  range?: number;

  @ApiPropertyOptional({
    description: 'Optional Cart ID to check full cart item fulfillment',
    example: 'cart_123',
  })
  @IsOptional()
  @IsString()
  cartId?: string;

  @ApiPropertyOptional({
    description: 'Optional Product ID to check single product fulfillment',
    example: 'prod_123',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Optional Variant ID (if checking single product)',
    example: 'var_456',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({
    description: 'Optional quantity to check (defaults to 1)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}
