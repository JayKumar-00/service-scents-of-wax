import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsNumber, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateShipmentChannelDto } from './create-channel-order.dto';

export enum ShipmentPaymentMode {
  COD = 'COD',
  PREPAID = 'Prepaid',
}

export enum ShipmentOrderType {
  ESSENTIALS = 'ESSENTIALS',
  NON_ESSENTIALS = 'NON ESSENTIALS',
}

export class ItemDto {
  @ApiProperty({
    example: 'Jeans (Optinal) if order is carring name',
    description: 'Name of the product.',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'cbs123 (Optional) if order is carring sku',
    description: 'The sku id of the product.',
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({
    example: '10 (Optional) if order is carring units',
    description: 'No of units that are to be shipped.',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  units?: number;

  @ApiProperty({
    example: '900 (Optional) if order is carring selling_price',
    description: 'The selling price per unit in Rupee. Inclusive of GST.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  selling_price?: number;

  @ApiPropertyOptional({
    example: '10 (Optional)',
    description: 'The discount amount in Rupee. Inclusive of tax.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiPropertyOptional({
    example: '5 (Optional)',
    description: 'The tax percentage on the item.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  tax?: number;

  @ApiPropertyOptional({
    example: '44122 (Optional)',
    description:
      'Harmonised System Nomenclature code. Used to determine the category of taxation the goods fall under.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  hsn?: number;
}

export class CreateShipmentDto extends OmitType(CreateShipmentChannelDto, [
  'channel_id',
] as const) {}

/*
export class CreateShipmentDto {
  @ApiProperty({
    example: 'ORD-2026-123',
    description:
      'Order number from invoice. This is the unique identifier for the order you want to ship.',
  })
  @IsString({ message: 'order_id must be a string' })
  @IsNotEmpty({ message: 'order_id is required and cannot be empty' })
  order_id!: string;

  @ApiPropertyOptional({
    example: 'Delhi Warehouse (Optional if product is carring pickup_location)',
    description:
      'The name of the pickup location added in your Shiprocket account. This cannot be a new location.',
  })
  @IsString()
  @IsOptional()
  pickup_location?: string;

  @ApiPropertyOptional({
    example: '27022 (Optional)',
    description: `Mention this in case you need to assign the order to a particular channel. Default is 'Custom'.`,
  })
  @IsString()
  @IsOptional()
  channel_id?: number;

  @ApiPropertyOptional({
    example: 'Reseller: Divine (Optional if product is carring order_date)',
    description: `Option to add 'From' field to the shipment. To do this, enter the name in the following format: 'Reseller: [name]'.`,
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({
    example: 'Amazon (Optional)',
    description: `Name of the company.`,
  })
  @IsString()
  @IsOptional()
  company_name!: string;

  @ApiPropertyOptional({
    example: '8604690454 (Optional)',
    description: 'Alternate phone number of the billing customer.',
  })
  @IsString()
  @Matches(/^\d{10,15}$/, {
    message: 'shipping_phone must contain 10–15 digits',
  })
  @IsOptional()
  billing_alternate_phone?: string;

  @ApiPropertyOptional({
    example: '+91 (Optional)',
    description: 'ISD code of the billing address.',
  })
  @IsString()
  @IsOptional()
  billing_isd_code?: string;

  @ApiPropertyOptional({
    example: '22.4064 (Optional)',
    description: 'Destination (Shipping address) Latitude',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitude!: number;

  @ApiPropertyOptional({
    enum: ShipmentPaymentMode,
    example: `${ShipmentPaymentMode.PREPAID} (Optional if order is carring payment method)`,
    description:
      'The method of payment. Can be either COD (Cash on delivery) Or Prepaid.',
  })
  @IsEnum(ShipmentPaymentMode)
  @IsOptional()
  payment_method?: ShipmentPaymentMode;

  @ApiPropertyOptional({
    example: '5 (Optional)',
    description: 'Shipping charges if any in Rupee.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  shipping_charges?: number;

  @ApiPropertyOptional({
    example: '5 (Optional)',
    description: 'Giftwrap charges if any in Rupee.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  giftwrap_charges?: number;

  @ApiPropertyOptional({
    example: '5 (Optional)',
    description: 'Transaction charges if any in Rupee.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  transaction_charges?: number;

  @ApiPropertyOptional({
    example: '10 (Optional if product is carring length)',
    description: 'The length of the item in cms. Must be more than 0.5.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  length?: number;

  @ApiPropertyOptional({
    example: '10 (Optional if product is carring breadth)',
    description: 'The breadth of the item in cms. Must be more than 0.5.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  breadth?: number;

  @ApiPropertyOptional({
    example: '10 (Optional if product is carring height)',
    description: 'The height of the item in cms. Must be more than 0.5.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({
    example: '2.5 (Optional)',
    description: 'The weight of the item in kgs. Must be more than 0.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({
    example: 'K92373490 (Optional)',
    description: 'Details relating to the shipment of goods. .',
  })
  @IsString()
  @IsOptional()
  ewaybill_no?: string;

  @ApiPropertyOptional({
    example: `${ShipmentOrderType.ESSENTIALS} (Optional)`,
    description:
      'Key to differentiate between Essentials or Non Essentials Shipments. Order type can only be ESSENTIALS or NON ESSENTIALS. Please note it is case sensitive and blank values are allowed.',
  })
  @IsEnum(ShipmentOrderType)
  @IsOptional()
  order_type?: ShipmentOrderType;

  @ApiPropertyOptional({
    example: 'Aa-Zz (Optional)',
    description: 'Only for SRF users.',
  })
  @IsString()
  @IsOptional()
  checkout_shipping_method?: string;

  @ApiPropertyOptional({
    example: 'false (Optinal)',
    description: 'To secure shipments above the order value of Rs 2500',
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  is_insurance_opt?: boolean;

  @ApiPropertyOptional({
    example: '1 or 0 (Optinal)',
    description: 'To create a document order',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  is_document?: number;

  @ApiPropertyOptional({
    example: 'Aa-Zz',
    description: 'To add tags to your orders',
  })
  @IsString()
  @IsOptional()
  order_tag?: string;
}
*/
