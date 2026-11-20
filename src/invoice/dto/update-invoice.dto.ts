import { PartialType } from '@nestjs/mapped-types';
import { CreateInvoiceDto } from './create-invoice.dto';

import {
  InvoicePaymentStatus,
  InvoiceStatus,
  ShipmentPaymentMode,
} from '@prisma/client';

import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

class UpdateInvoiceItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxableAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {
  @ApiPropertyOptional({
    description: 'Buyer name',
    example: 'Om Rathore',
  })
  @IsOptional()
  @IsString()
  buyerName?: string;

  @ApiPropertyOptional({
    description: 'Buyer phone number',
    example: '919981774637',
  })
  @IsOptional()
  @IsString()
  buyerPhone?: string;

  @ApiPropertyOptional({
    description: 'Buyer email',
    example: 'demo@example.com',
  })
  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  @ApiPropertyOptional({
    description: 'Store name',
    example: 'Gift Factory',
  })
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiPropertyOptional({
    description: 'Shipping address',
    example: 'Bhopal, Madhya Pradesh',
  })
  @IsOptional()
  shippingAddress?: any;

  @ApiPropertyOptional({
    description: 'Billing address',
  })
  @IsOptional()
  billingAddress?: any;

  @ApiPropertyOptional({
    description: 'Pickup address',
  })
  @IsOptional()
  pickupAddress?: any;

  @ApiPropertyOptional({
    type: [UpdateInvoiceItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateInvoiceItemDto)
  items?: UpdateInvoiceItemDto[];

  @ApiPropertyOptional({
    description: 'Subtotal amount',
    example: 1200,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({
    description: 'Discount amount',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({
    description: 'Shipping fee',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @ApiPropertyOptional({
    description: 'Platform fee',
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  platformFee?: number;

  @ApiPropertyOptional({
    description: 'GST amount',
    example: 216,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gst?: number;

  @ApiPropertyOptional({
    description: 'Grand total',
    example: 1316,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  grandTotal?: number;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: ShipmentPaymentMode,
  })
  @IsOptional()
  @IsEnum(ShipmentPaymentMode)
  paymentMethod?: ShipmentPaymentMode;

  @ApiPropertyOptional({
    description: 'Payment status',
    enum: InvoicePaymentStatus,
    example: InvoicePaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(InvoicePaymentStatus)
  paymentStatus?: InvoicePaymentStatus;

  @ApiPropertyOptional({
    description: 'Invoice status',
    enum: InvoiceStatus,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
