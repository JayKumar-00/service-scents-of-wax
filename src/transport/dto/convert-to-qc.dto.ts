import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class ConvertToQcDto {
  @ApiProperty({
    description:
      'Stock Keeping Unit - unique product identifier (alphanumeric)',
    example: 'PROD12345',
  })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({
    description: 'Product image URL used for QC verification by pickup agent',
    example: 'https://abc.com/product.jpg',
  })
  @IsString()
  @IsNotEmpty()
  product_image!: string;

  @ApiPropertyOptional({
    description: 'Brand name visible on the product or packaging',
    example: 'shiprocket',
  })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Brand tag/box label that should match the product branding',
    example: 'shiprocket',
  })
  @IsString()
  @IsOptional()
  brand_box?: string;

  @ApiPropertyOptional({
    description: 'Product color to be verified by pickup agent',
    example: 'Green',
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({
    description: 'Product size (as mentioned on label/tag)',
    example: 'L',
  })
  @IsString()
  @IsOptional()
  size?: string;

  @ApiPropertyOptional({
    description: 'Unique serial number assigned to product',
    example: '12345',
  })
  @IsString()
  @IsOptional()
  serial_no?: string;

  @ApiPropertyOptional({
    description: '15-digit IMEI number (for electronic devices)',
    example: '123456789012345',
  })
  @IsString()
  @Length(15, 15)
  @IsOptional()
  product_imei?: string;
}
