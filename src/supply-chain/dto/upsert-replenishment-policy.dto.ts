import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpsertReplenishmentPolicyDto {
  @ApiProperty({
    description: 'ID of the stocking node this policy applies to',
    example: 'cmp_12345',
  })
  @IsString()
  @IsNotEmpty()
  franchiseId!: string;

  @ApiProperty({
    description: 'ID of the product this policy applies to',
    example: 'cmop_12345',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description:
      'Minimum quantity to maintain before replenishment is triggered',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minQty?: number;

  @ApiPropertyOptional({
    description: 'Maximum quantity to replenish up to when triggered',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxQty?: number;

  @ApiPropertyOptional({
    description:
      'Reorder point quantity that triggers replenishment when stock falls below this level',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({
    description: 'Flag indicating if the replenishment policy is active',
    example: true,
  })
  @Transform(({ value }) =>
    ['true', '1', 1, true].includes(value)
      ? true
      : ['false', '0', 0, false].includes(value)
        ? false
        : value,
  )
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
