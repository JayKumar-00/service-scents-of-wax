import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockRequestType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export type BulkRequestItem = {
  productId: string;
  variantId?: string;
  quantity: number;
};

class BulkStockLineDto {
  @ApiProperty({
    description: 'ID of the product to request stock for',
    example: 'prod-123',
  })
  @IsString()
  productId!: string;

  @ApiProperty({
    description: 'Optional ID of the product variant to request stock for',
    example: 'variant-123',
    required: false,
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({
    description: 'Quantity of stock to request for the product',
    example: 10,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateBulkStockRequestsDto {
  @ApiProperty({
    description: 'List of stock request items to create in bulk',
    type: [BulkStockLineDto],
    example: [
      { productId: 'prod-123', variantId: 'variant-123', quantity: 10 },
      { productId: 'prod-456', quantity: 5 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkStockLineDto)
  items!: BulkStockLineDto[];

  @ApiProperty({
    description: 'Optional note to include with the bulk stock request',
    example: 'Urgent restock needed for upcoming promotion',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Type of the stock requests created in bulk',
    enum: StockRequestType,
    default: StockRequestType.STOCK_REQUEST,
  })
  @IsOptional()
  @IsEnum(StockRequestType)
  type?: StockRequestType;
}

export class CreateAdminBulkStockRequestDto extends CreateBulkStockRequestsDto {
  @ApiProperty({
    description: 'ID of the franchise to create the stock request for',
    example: 'franchise-789',
  })
  @IsString()
  franchiseId!: string;
}
