import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class WarehouseBulkLineDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  productId!: string;

  @ApiProperty({
    description: 'Quantity to set for the product',
    example: 100,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;
}

export class WarehouseBulkDto {
  @ApiProperty({
    description: 'List of products and their quantities to set in bulk',
    type: [WarehouseBulkLineDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WarehouseBulkLineDto)
  items!: WarehouseBulkLineDto[];
}
