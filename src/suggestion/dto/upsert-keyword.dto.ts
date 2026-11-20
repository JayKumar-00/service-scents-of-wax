import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertKeywordDto {
  @ApiProperty({
    example: 'gift box',
    description: 'The search query to cache',
  })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @ApiProperty({
    type: [String],
    example: ['gift box for him', 'gift box for her'],
    description: 'List of keyword suggestions',
  })
  @IsArray()
  @IsString({ each: true })
  suggestions!: string[];

  @ApiPropertyOptional({ example: 'MANUAL_UPSERT' })
  @IsString()
  @IsOptional()
  provider?: string;
}
