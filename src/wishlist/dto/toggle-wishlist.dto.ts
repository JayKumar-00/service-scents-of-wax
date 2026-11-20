import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ToggleWishlistDto {
  @ApiPropertyOptional({
    description: 'The ID of the product to toggle in the wishlist',
    example: 'prod_12345',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description: 'The ID of the variant to toggle in the wishlist',
    example: 'variant_12345',
  })
  @IsOptional()
  @IsString()
  variantId?: string;
}
