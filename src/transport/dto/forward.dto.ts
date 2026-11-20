import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEmail,
  Length,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  units!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hsn?: number;

  @ApiProperty()
  @IsNumber()
  selling_price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discount?: number;
}

export class FranchiseDetailsDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsNumber()
  phone!: number;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @Length(10)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address_2?: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  state!: string;

  @ApiProperty()
  @IsString()
  country!: string;

  @ApiProperty()
  @IsNumber()
  pin_code!: number;

  @ApiProperty({ maxLength: 36 })
  @IsString()
  @Length(1, 36)
  pickup_location!: string;
}

/* ---------------- MAIN DTO ---------------- */

export class CreateForwardShipmentDto {
  /* BASIC */

  @ApiPropertyOptional({ enum: ['Air', 'Surface'] })
  @IsOptional()
  @IsIn(['Air', 'Surface'])
  mode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  request_pickup?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  print_label?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  generate_manifest?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ewaybill_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  courier_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reseller_name?: string;

  /* ORDER */

  @ApiProperty()
  @IsString()
  order_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isd_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billing_isd_code?: string;

  @ApiProperty()
  @IsString()
  order_date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company_name?: string;

  /* BILLING */

  @ApiProperty()
  @IsString()
  billing_customer_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billing_last_name?: string;

  @ApiProperty()
  @IsString()
  billing_address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billing_address_2?: string;

  @ApiProperty()
  @IsString()
  billing_city!: string;

  @ApiProperty()
  @IsString()
  billing_state!: string;

  @ApiProperty()
  @IsString()
  billing_country!: string;

  @ApiProperty()
  @IsNumber()
  billing_pincode!: number;

  @ApiProperty()
  @IsEmail()
  billing_email!: string;

  @ApiProperty()
  @IsNumber()
  billing_phone!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  billing_alternate_phone?: number;

  /* SHIPPING */

  @ApiProperty()
  @IsBoolean()
  shipping_is_billing!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_customer_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_last_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_address_2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  shipping_pincode?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  shipping_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  shipping_phone?: number;

  /* ITEMS */

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  order_items!: OrderItemDto[];

  /* PAYMENT */

  @ApiProperty({ enum: ['COD', 'Prepaid'] })
  @IsString()
  @IsIn(['COD', 'Prepaid'])
  payment_method!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  shipping_charges?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  giftwrap_charges?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  transaction_charges?: number;

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
  weight!: number;

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

  /* PICKUP */

  @ApiProperty()
  @IsString()
  pickup_location!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customer_gstin?: string;

  /* FRANCHISE */

  @ApiPropertyOptional({ type: FranchiseDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FranchiseDetailsDto)
  franchise_details?: FranchiseDetailsDto;

  /* EXTRA */

  @ApiPropertyOptional({ enum: ['ESSENTIALS', 'NON ESSENTIALS'] })
  @IsOptional()
  @IsIn(['ESSENTIALS', 'NON ESSENTIALS'])
  order_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  what3words_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  is_document?: number;
}
