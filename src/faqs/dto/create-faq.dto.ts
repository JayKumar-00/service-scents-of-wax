import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FaqAudience } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({ description: 'FAQ question' })
  @IsString()
  @MinLength(1)
  question!: string;

  @ApiProperty({ description: 'FAQ answer' })
  @IsString()
  @MinLength(1)
  answer!: string;

  @ApiPropertyOptional({
    description: 'Target audience for this FAQ',
    enum: FaqAudience,
    default: FaqAudience.ALL,
  })
  @IsOptional()
  @IsEnum(FaqAudience)
  audience?: FaqAudience = FaqAudience.ALL;

  @ApiPropertyOptional({
    description: 'Whether this FAQ is visible in public lists',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return undefined;
  })
  @IsBoolean()
  isVisible?: boolean = true;
}
