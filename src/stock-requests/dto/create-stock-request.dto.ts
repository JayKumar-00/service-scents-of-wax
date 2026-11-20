import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockRequestType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockRequestDto {
  @ApiPropertyOptional({
    description:
      'The ID of the product for which the stock request is being made. If variantId is provided, this is optional but recommended.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description:
      'The ID of the product variant for which stock is requested. Takes priority over productId if both are provided. Use this when requesting stock for a specific variant.',
    example: 'var-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({
    description: 'The quantity of stock being requested.',
    example: 100,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description:
      'An optional note providing additional information about the stock request.',
    example: 'Please expedite this request as we are running low on stock.',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Type of the stock request',
    enum: StockRequestType,
    default: StockRequestType.STOCK_REQUEST,
  })
  @IsOptional()
  @IsEnum(StockRequestType)
  type?: StockRequestType;

  /**
   * Validation: Ensure at least productId or variantId is provided
   */
  static validate(dto: CreateStockRequestDto): string[] {
    const errors: string[] = [];
    if (!dto.productId?.trim() && !dto.variantId?.trim()) {
      errors.push('Either productId or variantId must be provided');
    }
    return errors;
  }
}
