import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEmail,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderItemDto } from './exchange-order.dto';

export class UpdateShipmentOrderDto {
  // ✅ Basic Info
  @ApiProperty({ example: '4TestOrderOct28' })
  @IsString()
  order_id!: string;

  @ApiProperty({ example: '2024-10-28' })
  @IsString()
  order_date!: string;

  @ApiProperty({ example: '23659_7026' })
  @IsString()
  pickup_location!: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  channel_id?: string;

  @ApiPropertyOptional({ example: 'Reseller: M/s Goku' })
  @IsOptional()
  @IsString()
  comment?: string;

  // ✅ Billing Details
  @ApiProperty({ example: 'Naruto' })
  @IsString()
  billing_customer_name!: string;

  @ApiProperty({ example: 'Uzumaki' })
  @IsString()
  billing_last_name!: string;

  @ApiProperty({ example: 'House 221B, Leaf Village' })
  @IsString()
  billing_address!: string;

  @ApiPropertyOptional({ example: 'Near Hokage House' })
  @IsOptional()
  @IsString()
  billing_address_2?: string;

  @ApiProperty({ example: 'New Delhi' })
  @IsString()
  billing_city!: string;

  @ApiProperty({ example: '110002' })
  @Matches(/^[0-9]{6}$/)
  billing_pincode!: string;

  @ApiProperty({ example: 'Delhi' })
  @IsString()
  billing_state!: string;

  @ApiProperty({ example: 'India' })
  @IsString()
  billing_country!: string;

  @ApiProperty({ example: 'naruto@uzumaki.com' })
  @IsEmail()
  billing_email!: string;

  @ApiProperty({ example: '9876543210' })
  @Matches(/^[0-9]{10}$/)
  billing_phone!: string;

  // ✅ Shipping Details
  @ApiProperty({ example: true })
  @IsBoolean()
  shipping_is_billing!: boolean;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  shipping_customer_name?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  shipping_last_name?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  shipping_address?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  shipping_address_2?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  shipping_city?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @Matches(/^[0-9]{6}$/)
  shipping_pincode?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  shipping_country?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  shipping_state?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsEmail()
  shipping_email?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @Matches(/^[0-9]{10}$/)
  shipping_phone?: string;

  @ApiProperty({ example: '0' })
  @IsString()
  is_document!: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  order_items!: OrderItemDto[];

  @ApiProperty({ example: 'Prepaid' })
  @IsString()
  payment_method!: string;

  // ✅ Charges
  @ApiProperty({ example: 0 })
  @IsNumber()
  shipping_charges!: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  giftwrap_charges!: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  transaction_charges!: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  total_discount!: number;

  @ApiProperty({ example: 9000 })
  @IsNumber()
  sub_total!: number;

  // ✅ Package Dimensions
  @ApiProperty({ example: 10 })
  @IsNumber()
  length!: number;

  @ApiProperty({ example: 15 })
  @IsNumber()
  breadth!: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  height!: number;

  @ApiProperty({ example: 2.5 })
  @IsNumber()
  weight!: number;
}
