import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({
    description: 'Brand name',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Slug (unique identifier in URL), Ex: nike, apple',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Description of the brand',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Search term, Ex: category name, slug',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;
}
