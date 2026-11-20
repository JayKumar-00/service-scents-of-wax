import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

export class CreatePromotionDto {
  @ApiProperty({
    description: 'Name of the promotion',
    example: 'Summer Sale',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'URL-friendly identifier (lowercase, kebab-case)',
    example: 'summer-sale',
  })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase kebab-case' })
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Description of the promotion',
    example: 'Get 20% off on all summer collection items.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Discount percentage (0-100)',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  percentOff!: number;

  @ApiPropertyOptional({
    enum: BooleanEnum,
    example: BooleanEnum.TRUE,
    description: 'Whether the promotion is currently active',
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  active?: BooleanEnum;

  @ApiPropertyOptional({
    description: 'Promotion start date (ISO 8601 format)',
    example: '2024-07-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    description: 'Promotion end date (ISO 8601 format)',
    example: '2024-07-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    enum: BooleanEnum,
    example: BooleanEnum.FALSE,
    description: 'Whether the promotion applies to all products',
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  applyToAll?: BooleanEnum;

  @ApiPropertyOptional({
    description:
      'List of product IDs this promotion applies to (if not applying to all)',
    example: ['prod_123', 'prod_456'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  productIds?: string[];
}
