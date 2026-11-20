import {
  IsString,
  IsNumber,
  IsOptional,
  IsEmail,
  IsArray,
  ValidateNested,
  IsIn,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/* ---------------- ORDER ITEM ---------------- */

export class QuickReturnOrderItemDto {
  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  units!: number;

  @ApiProperty()
  @IsNumber()
  selling_price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discount?: number;
}

/* ---------------- MAIN DTO ---------------- */

export class QuickReturnDto {
  /* ORDER */

  @ApiProperty()
  @IsString()
  order_id!: string;

  @ApiProperty()
  @IsString()
  order_date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel_id?: string;

  /* PICKUP DETAILS */

  @ApiProperty()
  @IsString()
  pickup_customer_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickup_last_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company_name?: string;

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
  @IsNumber()
  pickup_pincode!: number;

  @ApiProperty()
  @IsEmail()
  pickup_email!: string;

  @ApiProperty()
  @IsNumber()
  pickup_phone!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickup_isd_code?: string;

  /* SHIPPING DETAILS */

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
  @IsNumber()
  shipping_pincode!: number;

  @ApiProperty()
  @IsEmail()
  shipping_email!: string;

  @ApiProperty()
  @IsNumber()
  shipping_phone!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_isd_code?: string;

  /* ITEMS */

  @ApiProperty({ type: [QuickReturnOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuickReturnOrderItemDto)
  order_items!: QuickReturnOrderItemDto[];

  /* PAYMENT */

  @ApiProperty({ enum: ['COD', 'Prepaid'] })
  @IsString()
  @IsIn(['COD', 'Prepaid'])
  payment_method!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  total_discount?: number;

  @ApiProperty()
  @IsNumber()
  sub_total!: number;

  /* DIMENSIONS */

  @ApiProperty()
  @IsNumber()
  @Min(1)
  length!: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  breadth!: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  height!: number;

  @ApiProperty()
  @IsNumber()
  weight!: number;

  /* PICKUP REQUEST */

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  request_pickup?: boolean;
}
