import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StockRequestPaymentStatus, StockRequestType } from '@prisma/client';
import { QueryDto } from '../../../common/dto/query.dto';

export class LedgerQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by reference type (e.g. STOCK_REQUEST, RETURN)',
  })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({
    description: 'Search by reference ID or Note',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class SupplierLedgerQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Filter by specific Supplier ID' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filter by specific Purchase Order ID' })
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @ApiPropertyOptional({ description: 'Search term for PO number or notes' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Purchase Order status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: StockRequestPaymentStatus,
  })
  @IsOptional()
  @IsEnum(StockRequestPaymentStatus)
  paymentStatus?: StockRequestPaymentStatus;

  @ApiPropertyOptional({
    description: 'Filter by request type',
    enum: StockRequestType,
  })
  @IsOptional()
  @IsEnum(StockRequestType)
  type?: StockRequestType;
}

export class FranchiseLedgerQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Filter by specific Franchise ID' })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({ description: 'Filter by specific Stock Request ID' })
  @IsOptional()
  @IsString()
  stockRequestId?: string;

  @ApiPropertyOptional({ description: 'Search term for product, variant title/sku, or note' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Stock Request status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by Stock Request payment status',
    enum: StockRequestPaymentStatus,
  })
  @IsOptional()
  @IsEnum(StockRequestPaymentStatus)
  paymentStatus?: StockRequestPaymentStatus;

  @ApiPropertyOptional({
    description: 'Filter by Stock Request type',
    enum: StockRequestType,
  })
  @IsOptional()
  @IsEnum(StockRequestType)
  type?: StockRequestType;
}
