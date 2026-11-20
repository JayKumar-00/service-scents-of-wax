import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountScope, DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({
    description: 'Coupon name',
    example: 'Summer 20 Off',
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Unique coupon code',
    example: 'SUMMER20',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @ApiProperty({
    enum: DiscountType,
    description: 'Type of discount',
    example: DiscountType.PERCENTAGE,
  })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({
    enum: DiscountScope,
    description: 'Where the discount applies',
    example: DiscountScope.CART,
  })
  @IsEnum(DiscountScope)
  scope!: DiscountScope;

  @ApiProperty({
    description: 'Discount value or percentage',
    example: 20,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({
    description: 'Minimum order amount required to use the coupon',
    example: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum discount amount that can be applied',
    example: 150,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of times the coupon can be used',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({
    description: 'Whether the coupon is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Coupon start date',
    example: '2026-05-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    description: 'Coupon end date',
    example: '2026-06-01T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
