import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ReturnOrderItemDto {
  @ApiProperty({ example: 'WSH234' })
  @IsString()
  sku!: string;

  @ApiProperty({ example: 'Shoes' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  units!: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  selling_price!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  discount?: number;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  hsn?: string;

  // QC Fields
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  qc_enable?: boolean;

  @ApiPropertyOptional({ example: 'Red' })
  @IsOptional()
  @IsString()
  qc_color?: string;

  @ApiPropertyOptional({ example: 'Nike' })
  @IsOptional()
  @IsString()
  qc_brand?: string;

  @ApiPropertyOptional({ example: '43' })
  @IsOptional()
  @IsString()
  qc_size?: string;

  @ApiPropertyOptional({ example: 'Shoes' })
  @IsOptional()
  @IsString()
  qc_product_name?: string;

  @ApiPropertyOptional({
    example: 'https://image-url.com/image.jpg',
  })
  @IsOptional()
  @IsString()
  qc_product_image?: string;
}

export class CreateReturnOrderDto {
  @ApiProperty({ example: 'r121579B09ap3o' })
  @IsString()
  order_id!: string;

  @ApiProperty({ example: '2026-03-19' })
  @IsDateString()
  order_date!: string;

  @ApiPropertyOptional({ example: 27202 })
  @IsOptional()
  @IsInt()
  channel_id?: number;

  // Pickup Details
  @ApiProperty()
  @IsString()
  pickup_customer_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickup_last_name?: string;

  @ApiProperty()
  @IsString()
  pickup_address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickup_address_2?: string;

  @ApiProperty()
  @IsString()
  pickup_city!: string;

  @ApiProperty()
  @IsString()
  pickup_state!: string;

  @ApiProperty()
  @IsString()
  pickup_country!: string;

  @ApiProperty()
  @IsInt()
  pickup_pincode!: number;

  @ApiProperty()
  @IsEmail()
  pickup_email!: string;

  @ApiProperty()
  @IsString()
  pickup_phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickup_isd_code?: string;

  // Shipping Details
  @ApiProperty()
  @IsString()
  shipping_customer_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_last_name?: string;

  @ApiProperty()
  @IsString()
  shipping_address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_address_2?: string;

  @ApiProperty()
  @IsString()
  shipping_city!: string;

  @ApiProperty()
  @IsString()
  shipping_state!: string;

  @ApiProperty()
  @IsString()
  shipping_country!: string;

  @ApiProperty()
  @IsInt()
  shipping_pincode!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  shipping_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_isd_code?: string;

  @ApiProperty()
  @IsInt()
  shipping_phone!: number;

  // Items
  @ApiProperty({ type: [ReturnOrderItemDto] })
  @ValidateNested({ each: true })
  @Type(() => ReturnOrderItemDto)
  order_items!: ReturnOrderItemDto[];

  @ApiProperty({ example: 'PREPAID' })
  @IsString()
  payment_method!: string;

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsString()
  total_discount?: string;

  @ApiProperty({ example: 400 })
  @IsInt()
  sub_total!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  length!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  breadth!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  height!: number;

  @ApiProperty({ example: 0.5 })
  @IsNumber()
  weight!: number;

  @ApiPropertyOptional({
    example: 'Bought by Mistake',
  })
  @IsOptional()
  @IsString()
  return_reason?: string;
}
