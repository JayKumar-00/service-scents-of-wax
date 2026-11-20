import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';
import {
  InvoiceStatus,
  InvoicePaymentStatus,
  ShipmentPaymentMode,
  InvoiceType,
} from '@prisma/client';

export class InvoiceQueryDto extends QueryDto {
  @ApiPropertyOptional({
    enum: InvoiceType,
  })
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @ApiPropertyOptional({
    description: 'Invoice status to filter',
    enum: InvoiceStatus,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'Invoice payment status to filter',
    enum: InvoicePaymentStatus,
  })
  @IsOptional()
  @IsEnum(InvoicePaymentStatus)
  paymentStatus?: InvoicePaymentStatus;

  @ApiPropertyOptional({
    description: 'Payment method filter',
    enum: ShipmentPaymentMode,
  })
  @IsOptional()
  @IsEnum(ShipmentPaymentMode)
  shipmentPaymentMode?: ShipmentPaymentMode;

  @ApiPropertyOptional({ description: 'Invoice number to search' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Order number to search' })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({ description: 'Order ID associated with invoice' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Stock request ID associated with invoice',
  })
  @IsOptional()
  @IsString()
  stockRequestId?: string;

  @ApiPropertyOptional({ description: 'Store name to filter' })
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiPropertyOptional({ description: 'Buyer phone to filter' })
  @IsOptional()
  @IsString()
  buyerPhone?: string;

  @ApiPropertyOptional({ description: 'Buyer name to filter' })
  @IsOptional()
  @IsString()
  buyerName?: string;

  @ApiPropertyOptional({
    description: 'Franchise id to filter invoices related to a franchise',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string; // This will be set from controller based on user role
}

export class SingleInvocieQueryDto {
  @ApiPropertyOptional({
    description: 'ID of the order associated with this invoice (if applicable)',
  })
  @ValidateIf((o) => !o.stockRequestId)
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @ApiPropertyOptional({
    description:
      'ID of the stock request associated with this invoice (if applicable)',
  })
  @ValidateIf((o) => !o.orderNumber)
  @IsString()
  @IsNotEmpty()
  stockRequestId!: string;

  @ApiPropertyOptional({
    description: 'Type of invoice to fetch',
    enum: InvoiceType,
  })
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @ApiPropertyOptional({
    description: 'Franchise id to filter invoices related to a franchise',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Customer id to filter invoices related to a franchise',
  })
  @IsOptional()
  @IsString()
  customerId?: string;
}
