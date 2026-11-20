import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateSearchHistoryDto {
  @ApiProperty({ description: 'Search text' })
  @IsNotEmpty()
  @IsString()
  query!: string;

  @ApiPropertyOptional({ description: 'Active category ID during search' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class CreateProductViewDto {
  @ApiPropertyOptional({ description: 'Customer ID (null for guests)' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ description: 'Viewed product ID' })
  @IsNotEmpty()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Search text that led to the product view, or empty string',
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Active category ID during view' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
