import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BundleItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'prod-123',
  })
  @IsNotEmpty()
  @IsString()
  productId!: string;

  @ApiPropertyOptional({
    description: 'Product Variant ID (optional)',
    example: 'var-123',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({
    description: 'Quantity of the item (must be > 0)',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class AddBundleItemsDto {
  @ApiProperty({
    type: [BundleItemDto],
    description: 'List of items to add or replace',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  items!: BundleItemDto[];
}
