import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class StockTransferLineInputDto {
  @ApiProperty({
    description: 'ID of the product being transferred',
    example: 'prod_12345',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description: 'ID of the product variant being transferred (if applicable)',
    example: 'variant_67890',
  })
  @IsString()
  @IsOptional()
  variantId?: string;

  @ApiProperty({
    description: 'Quantity of the product to transfer',
    example: 100,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateStockTransferDto {
  @ApiProperty({
    description: 'ID of the source node (e.g., warehouse or store)',
    example: 'node_12345',
  })
  @IsString()
  @IsNotEmpty()
  fromNodeId!: string;

  @ApiProperty({
    description: 'ID of the destination node (e.g., warehouse or store)',
    example: 'node_67890',
  })
  @IsString()
  @IsNotEmpty()
  toNodeId!: string;

  @ApiPropertyOptional({
    description: 'Optional note or reference for the stock transfer',
    example: 'Urgent transfer for upcoming promotion',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Optional ID of the user initiating the transfer',
    type: [StockTransferLineInputDto],
    example: [
      {
        productId: 'cmpf2240a0004k217oc0htmmh',
        variantId: 'variant_67890',
        quantity: 100,
      },
      {
        productId: 'prod_67890',
        quantity: 50,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineInputDto)
  lines!: StockTransferLineInputDto[];
}
