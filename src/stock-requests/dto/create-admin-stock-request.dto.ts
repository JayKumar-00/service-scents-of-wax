import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockRequestType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class FranchiseStockRequestMetaData {
  @ApiProperty({
    description: 'Name of the franchise making the stock request',
    example: 'Franchise ABC',
  })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Phone number of the franchise making the stock request',
    example: '+1234567890',
  })
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class CreateAdminStockRequestDto {
  @ApiProperty({
    description: 'ID of the franchise making the stock request',
    example: 'franchise_12345',
  })
  @IsString()
  @IsNotEmpty()
  franchiseId!: string;

  @ApiPropertyOptional({
    description:
      'ID of the product being requested. If variantId is provided, this is optional but recommended.',
    example: 'product_67890',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description:
      'ID of the product variant being requested. Takes priority over productId if both are provided.',
    example: 'variant_12345',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({
    description: 'Quantity of the product being requested',
    example: 100,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Optional note or reason for the stock request',
    example: 'Urgent restock needed for upcoming promotion',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description:
      'Additional metadata about the stock request, such as franchise details',
    type: FranchiseStockRequestMetaData,
  })
  @ValidateNested()
  @Type(() => FranchiseStockRequestMetaData)
  meta!: FranchiseStockRequestMetaData;

  @ApiPropertyOptional({
    description: 'Type of the stock request',
    enum: StockRequestType,
    default: StockRequestType.STOCK_REQUEST,
  })
  @IsOptional()
  @IsEnum(StockRequestType)
  type?: StockRequestType;
}
