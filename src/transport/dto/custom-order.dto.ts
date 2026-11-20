import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  MaxLength,
  ValidateIf,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentOrderType, ShipmentPaymentMode } from './create-shipment.dto';

/* ENUMS */

export enum PaymentMethod {
  COD = 'COD',
  PREPAID = 'Prepaid',
}

export class ShiprocketOrderItemDto {
  @ApiProperty({ example: 'Jeans' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'cbs123' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  units!: number; // ✅ MUST be "units" (not quantity)

  @ApiProperty({ example: 900 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  selling_price!: number;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiPropertyOptional({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  tax?: number;

  @ApiPropertyOptional({ example: 44122 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  hsn?: number;
}

export class TransportShipmentDto {
  /* -------- BASIC -------- */

  @ApiProperty({ example: '224477', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsNotEmpty()
  order_id!: string;

  @ApiProperty({ example: '2019-07-24' })
  @IsDateString()
  @IsNotEmpty()
  order_date!: string;

  @ApiProperty({ example: 'Jammu' })
  @IsString()
  @IsNotEmpty()
  pickup_location!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  channel_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reseller_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company_name?: string;

  /* -------- BILLING -------- */

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  billing_customer_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billing_last_name?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  billing_address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billing_address_2?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  billing_city!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  billing_pincode!: string;

  @ApiProperty()
  @IsString()
  billing_state!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  billing_country!: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  billing_email!: string;

  @ApiPropertyOptional({
    example: '8604690454',
    description: 'phone number of the billing customer.',
  })
  @IsString()
  // @Matches(/^\d{10,15}$/, {
  //   message: 'shipping_phone must contain 10–15 digits',
  // })
  @IsNotEmpty()
  billing_phone!: string;

  @ApiPropertyOptional({
    example: '8604690454 (Optional)',
    description: 'Alternate phone number of the billing customer.',
  })
  @IsString()
  // @Matches(/^\d{10,15}$/, {
  //   message: 'shipping_phone must contain 10–15 digits',
  // })
  @IsOptional()
  billing_alternate_phone?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billing_isd_code?: string;

  /* -------- SHIPPING -------- */

  @ApiProperty()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsNotEmpty()
  shipping_is_billing!: boolean;

  @ValidateIf((o) => !o.shipping_is_billing)
  @IsString()
  shipping_customer_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_last_name?: string;

  @ValidateIf((o) => !o.shipping_is_billing)
  @IsString()
  shipping_address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_address_2?: string;

  @ValidateIf((o) => !o.shipping_is_billing)
  @IsString()
  shipping_city!: string;

  @ValidateIf((o) => !o.shipping_is_billing)
  @IsNumber()
  shipping_pincode!: number;

  @ValidateIf((o) => !o.shipping_is_billing)
  @IsString()
  shipping_state!: string;

  @ValidateIf((o) => !o.shipping_is_billing)
  @IsString()
  shipping_country!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  shipping_email?: string;

  @ValidateIf((o) => !o.shipping_is_billing)
  @IsString()
  shipping_phone!: string;

  /* -------- GEO -------- */

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  /* -------- ITEMS -------- */

  @ApiProperty({ type: [ShiprocketOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiprocketOrderItemDto)
  order_items!: ShiprocketOrderItemDto[];

  /* -------- PAYMENT -------- */

  @ApiProperty({
    enum: ShipmentPaymentMode,
    default: ShipmentPaymentMode.PREPAID,
  })
  @IsEnum(ShipmentPaymentMode)
  payment_method!: ShipmentPaymentMode;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shipping_charges?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  giftwrap_charges?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  transaction_charges?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total_discount?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  sub_total!: number;

  /* -------- DIMENSIONS -------- */

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @IsNotEmpty()
  length!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @IsNotEmpty()
  breadth!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @IsNotEmpty()
  height!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  weight!: number;

  /* -------- OPTIONAL -------- */

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ewaybill_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoice_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customer_gstin?: string;

  @ApiPropertyOptional({
    enum: ShipmentOrderType,
    default: ShipmentOrderType.NON_ESSENTIALS,
  })
  @IsEnum(ShipmentOrderType)
  @IsOptional()
  order_type?: ShipmentOrderType;
}
