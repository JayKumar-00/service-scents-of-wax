// dto/geocode.dto.ts

import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GeocodeDto {
  @ApiPropertyOptional({
    description: 'The name of the village or locality.',
    example: 'Greenwood Village',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  village?: string;

  @ApiPropertyOptional({
    description: 'The name of the area or neighborhood.',
    example: 'Downtown',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  area?: string;

  @ApiPropertyOptional({
    description: 'The name of the city.',
    example: 'Denver',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  city?: string;

  @ApiPropertyOptional({
    description: 'The name of the state or province.',
    example: 'Colorado',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  state?: string;

  @ApiPropertyOptional({
    description: 'The name of the country.',
    example: 'United States',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  country?: string;
}
