import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({ example: 'Black tshirt XL' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: '500.00',
    description: 'Selling price per unit in INR',
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  selling_price?: number;

  @ApiProperty({ example: 1, description: 'Number of units' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  units?: number;

  @ApiProperty({
    example: '1733808730720',
    description: 'HSN code for taxation',
  })
  @IsString()
  @IsOptional()
  hsn?: string;

  @ApiProperty({ example: 'mackbook' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tax?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  discount?: number;

  @ApiPropertyOptional({ example: 'Brand Name' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ example: 'Black' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: '193658024' })
  @IsString()
  @IsOptional()
  exchange_item_id?: string;

  @ApiPropertyOptional({ example: 'Black tshirt XL' })
  @IsString()
  @IsOptional()
  exchange_item_name?: string;

  @ApiPropertyOptional({ example: 'mackbook' })
  @IsString()
  @IsOptional()
  exchange_item_sku?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  qc_enable?: boolean;

  @ApiPropertyOptional({ example: 'Black tshirt XL' })
  @IsString()
  @IsOptional()
  qc_product_name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/qc_product.png' })
  @IsString()
  @IsOptional()
  qc_product_image?: string;

  @ApiPropertyOptional({ example: 'changedname1' })
  @IsString()
  @IsOptional()
  qc_brand?: string;

  @ApiPropertyOptional({ example: 'changecolr' })
  @IsString()
  @IsOptional()
  qc_color?: string;

  @ApiPropertyOptional({ example: 'changesize112' })
  @IsString()
  @IsOptional()
  qc_size?: string;

  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsOptional()
  accessories?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  qc_used_check?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  qc_sealtag_check?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  qc_brand_box?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  qc_check_damaged_product?: boolean;
}

export class ExchangeShimentDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  order_items!: OrderItemDto[];

  @ApiProperty({ example: 'Test' })
  @IsString()
  buyer_pickup_first_name!: string;

  @ApiProperty({ example: 'Test' })
  @IsString()
  buyer_pickup_last_name!: string;

  @ApiProperty({ example: 'test@gmail.com' })
  @IsString()
  buyer_pickup_email!: string;

  @ApiProperty({ example: 'Test' })
  @IsString()
  buyer_pickup_address!: string;

  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsOptional()
  buyer_pickup_address_2?: string;

  @ApiProperty({ example: 'South West Delhi' })
  @IsString()
  buyer_pickup_city!: string;

  @ApiProperty({ example: 'Delhi' })
  @IsString()
  buyer_pickup_state!: string;

  @ApiProperty({ example: 'India' })
  @IsString()
  buyer_pickup_country!: string;

  @ApiProperty({ example: '9716414139' })
  @IsString()
  buyer_pickup_phone!: string;

  @ApiProperty({ example: '110045' })
  @IsString()
  buyer_pickup_pincode!: string;

  @ApiProperty({ example: 'Test' })
  @IsString()
  buyer_shipping_first_name!: string;

  @ApiProperty({ example: 'Test' })
  @IsString()
  buyer_shipping_last_name!: string;

  @ApiProperty({ example: 'test@gmail.com' })
  @IsString()
  buyer_shipping_email!: string;

  @ApiProperty({ example: 'dkalsd' })
  @IsString()
  buyer_shipping_address!: string;

  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsOptional()
  buyer_shipping_address_2?: string;

  @ApiProperty({ example: 'South West Delhi' })
  @IsString()
  buyer_shipping_city!: string;

  @ApiProperty({ example: 'Delhi' })
  @IsString()
  buyer_shipping_state!: string;

  @ApiProperty({ example: 'India' })
  @IsString()
  buyer_shipping_country!: string;

  @ApiProperty({ example: '9716414139' })
  @IsString()
  buyer_shipping_phone!: string;

  @ApiProperty({ example: '110045' })
  @IsString()
  buyer_shipping_pincode!: string;

  @ApiProperty({ example: 5723898 })
  @IsNumber()
  @Type(() => Number)
  seller_pickup_location_id!: number;

  @ApiProperty({ example: 5723898 })
  @IsNumber()
  @Type(() => Number)
  seller_shipping_location_id!: number;

  @ApiProperty({ example: 'EX_TEST002' })
  @IsString()
  exchange_order_id!: string;

  @ApiProperty({ example: 'R_TEST002' })
  @IsString()
  return_order_id!: string;

  @ApiProperty({ example: 'prepaid' })
  @IsString()
  payment_method!: string;

  @ApiProperty({ example: '2024-12-10' })
  @IsString()
  order_date!: string;

  @ApiProperty({ example: 1960878 })
  @IsNumber()
  @Type(() => Number)
  channel_id!: number;

  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsOptional()
  existing_order_id?: string;

  @ApiProperty({ example: '29' })
  @IsString()
  return_reason!: string;

  @ApiProperty({ example: 500.0 })
  @IsNumber()
  @Type(() => Number)
  sub_total!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  shipping_charges?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  giftwrap_charges?: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Type(() => Number)
  total_discount!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  transaction_charges?: number;

  @ApiProperty({ example: 11 })
  @IsNumber()
  @Type(() => Number)
  exchange_length!: number;

  @ApiProperty({ example: 11 })
  @IsNumber()
  @Type(() => Number)
  exchange_breadth!: number;

  @ApiProperty({ example: 11 })
  @IsNumber()
  @Type(() => Number)
  exchange_height!: number;

  @ApiProperty({ example: 11 })
  @IsNumber()
  @Type(() => Number)
  exchange_weight!: number;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  @Type(() => Number)
  return_length!: number;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  @Type(() => Number)
  return_breadth!: number;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  @Type(() => Number)
  return_height!: number;

  @ApiProperty({ example: 0.5 })
  @IsNumber()
  @Type(() => Number)
  return_weight!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Type(() => Boolean)
  qc_check!: boolean;
}
