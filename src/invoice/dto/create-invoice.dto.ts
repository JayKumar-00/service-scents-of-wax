import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceAddressDto } from './invoice-address.dto';
import { InvoiceStatus, ShipmentPaymentMode } from '@prisma/client';

export class CreateInvoiceDto {
  @ApiPropertyOptional({
    description: 'ID of the order associated with this invoice (if applicable)',
    example: 'order_1234567890',
  })
  @ValidateIf((o) => !o.stockRequestId)
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @ApiPropertyOptional({
    description:
      'ID of the stock request associated with this invoice (if applicable)',
    example: 'stockreq_1234567890',
  })
  @ValidateIf((o) => !o.orderNumber)
  @IsString()
  @IsNotEmpty()
  stockRequestId!: string;

  @ApiProperty({
    description: 'Unique invoice number',
    example: 'INV-2024-0001',
  })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiProperty({
    description: `Order date in ISO format, Ex: '2026-02-14'`,
  })
  @IsDateString()
  @IsOptional()
  order_date?: string;

  @ApiProperty({
    description: `Order date in ISO format, Ex: '2026-02-14'`,
    enum: ShipmentPaymentMode,
    example: ShipmentPaymentMode.PREPAID,
  })
  @IsEnum(ShipmentPaymentMode)
  @IsOptional()
  shipmentPaymentMode?: ShipmentPaymentMode;

  /**
   * 📍 Pickup Location (Optional)
   * If not provided, system will fallback to franchise default pickup address
   */
  @ApiPropertyOptional({
    description:
      'Pickup location for shipment. The location should be matched with shiprocket shipment.',
    type: String,
  })
  @IsString()
  @IsOptional()
  pickupLocation?: string;

  /**
   * 📦 Package Length (cm)
   */
  @ApiProperty({
    description:
      'Package length in cm (minimum 10 cm recommended by Shiprocket). Default: 10',
  })
  @ValidateIf((o) => !o.orderNumber && o.status !== InvoiceStatus.GENERATED) // Length is required if orderNumber is not provided and status is not DRAFT
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  length!: number;

  /**
   * 📦 Package Breadth (cm)
   */
  @ApiProperty({
    description:
      'Package breadth in cm (minimum 10 cm recommended). Default: 10',
  })
  @ValidateIf((o) => o.status !== InvoiceStatus.GENERATED) // Length is required if orderNumber is not provided and status is not DRAFT
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  breadth!: number;

  /**
   * 📦 Package Height (cm)
   */
  @ApiProperty({
    description:
      'Package height in cm (minimum 10 cm recommended). Default: 10',
  })
  @ValidateIf((o) => o.status !== InvoiceStatus.GENERATED)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  height!: number;

  /**
   * ⚖️ Package Weight (kg)
   */
  @ApiProperty({
    description:
      'Package weight in kg (minimum 0.5 kg recommended). Default: 0.5',
  })
  @ValidateIf((o) => o.status !== InvoiceStatus.GENERATED)
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @IsNotEmpty()
  weight!: number;

  @ApiProperty({
    description:
      'Billing address for the invoice. This is where the invoice will be sent and may also be used for tax calculation.',
  })
  @ValidateIf((o) => !o.orderNumber && o.status !== InvoiceStatus.GENERATED)
  @ValidateNested()
  @Type(() => InvoiceAddressDto)
  billingAddress?: InvoiceAddressDto;

  @ApiProperty({
    description:
      'Shipping address for the invoice. This is where the products will be delivered. It can be the same as the billing address or different.',
  })
  @ValidateIf((o) => !o.orderNumber && o.status !== InvoiceStatus.GENERATED) // Length is required if orderNumber is not provided and status is not DRAFT
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceAddressDto)
  pickupAddress?: InvoiceAddressDto;

  @ApiProperty({
    description:
      'Total tax amount for the invoice in the smallest currency unit (e.g., cents). This should be added to the subtotal after applying any discounts to calculate the grand total.',
    example: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shippingFee?: number;

  @ApiProperty({
    description:
      'Platform fee for the invoice in the smallest currency unit (e.g., cents). This is an optional fee that can be added to the invoice total.',
    example: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  platformFee?: number;

  @ApiPropertyOptional({
    description:
      'GST rate applicable to the invoice in percentage. This is used for tax calculation and should be provided if GST is applicable.',
    example: 18,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gstRate?: number;
}

export class PlatformInvoiceDto {
  @ApiPropertyOptional({
    description: 'ID of the order associated with this invoice (if applicable)',
    example: 'order_1234567890',
  })
  @ValidateIf((o) => !o.stockRequestId)
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @ApiPropertyOptional({
    description:
      'ID of the stock request associated with this invoice (if applicable)',
    example: 'stockreq_1234567890',
  })
  @ValidateIf((o) => !o.orderNumber)
  @IsString()
  @IsNotEmpty()
  stockRequestId!: string;

  @ApiProperty({
    description: `Order date in ISO format, Ex: '2026-02-14'`,
  })
  @IsDateString()
  @IsOptional()
  order_date?: string;

  @ApiProperty({
    description:
      'Total tax amount for the invoice in the smallest currency unit (e.g., cents). This should be added to the subtotal after applying any discounts to calculate the grand total.',
    example: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shippingFee?: number;

  @ApiPropertyOptional({
    description:
      'GST rate applicable to the invoice in percentage. This is used for tax calculation and should be provided if GST is applicable.',
    example: 18,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gstRate?: number;
}
