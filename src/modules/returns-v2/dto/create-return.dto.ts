import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { ReturnType, RefundReceivingSource } from '@prisma/client';
import { ReturnReasonEnum } from '../enums/return-reason.enum';

export class ReturnItemDto {
  @ApiProperty({
    description: 'The ID of the product being returned.',
    example: 'prod_12345',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description: 'The ID of the product variant being returned, if applicable.',
    example: 'variant_12345',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({
    description: 'The quantity of the product being returned.',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestedQty!: number;

  @ApiPropertyOptional({
    description: 'Item-specific remarks or details.',
    example: 'Damaged packaging',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ExchangeItemDto {
  @ApiProperty({
    description: 'The product ID selected as a replacement.',
    example: 'prod_56789',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description:
      'The product variant ID selected as a replacement, if applicable.',
    example: 'variant_56789',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({
    description: 'The quantity of the replacement item.',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreatePosReturnDto {
  @ApiProperty({
    description:
      'The order number associated with the customer POS/offline return (EXCHANGE only).',
    example: 'ORD123456',
  })
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @ApiProperty({
    description:
      'The type of return being requested. For POS orders, this MUST be EXCHANGE or SAME_PRODUCT_EXCHANGE.',
    enum: [ReturnType.EXCHANGE, ReturnType.SAME_PRODUCT_EXCHANGE],
    example: ReturnType.EXCHANGE,
  })
  @IsEnum(ReturnType)
  @IsNotEmpty()
  returnType!: ReturnType;

  @ApiPropertyOptional({
    description: 'The main reason for the return request.',
    enum: ReturnReasonEnum,
    example: ReturnReasonEnum.OTHER,
  })
  @IsOptional()
  @IsEnum(ReturnReasonEnum)
  reason?: ReturnReasonEnum;

  @ApiPropertyOptional({
    description: 'General remarks or notes.',
    example: 'Customer requested quick processing.',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    description: 'The list of items being returned.',
    type: [ReturnItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @ApiProperty({
    description: 'The list of replacement items selected for POS exchange.',
    type: [ExchangeItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ExchangeItemDto)
  exchangeItems!: ExchangeItemDto[];

  @ApiPropertyOptional({
    description:
      'Images uploaded by the customer/store showing product state or proof of defect.',
    type: [String],
    example: ['https://example.com/item-defect-image1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class CreateOnlineReturnDto {
  @ApiProperty({
    description: 'The order number associated with the customer online return.',
    example: 'ORD123456',
  })
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @ApiProperty({
    description: 'The type of return being requested.',
    enum: ReturnType,
    example: ReturnType.RETURN,
  })
  @IsEnum(ReturnType)
  @IsNotEmpty()
  returnType!: ReturnType;

  @ApiPropertyOptional({
    description: 'The main reason for the return request.',
    enum: ReturnReasonEnum,
    example: ReturnReasonEnum.OTHER,
  })
  @IsOptional()
  @IsEnum(ReturnReasonEnum)
  reason?: ReturnReasonEnum;

  @ApiPropertyOptional({
    description: 'General remarks or notes.',
    example: 'Customer requested quick processing.',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    description: 'The list of items being returned.',
    type: [ReturnItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @ApiPropertyOptional({
    description:
      'Images uploaded by the customer/store showing product state or proof of defect.',
    type: [String],
    example: ['https://example.com/item-defect-image1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    description:
      'The preferred source to receive the refund (required if returnType is REFUND). Options: ORIGINAL_SOURCE, UPI, BANK_TRANSFER, REWARDS.',
    enum: RefundReceivingSource,
    example: RefundReceivingSource.ORIGINAL_SOURCE,
  })
  @ValidateIf((o) => o.returnType === ReturnType.REFUND)
  @IsNotEmpty({
    message: 'refundReceivingSource is required when returnType is REFUND',
  })
  @IsIn(
    [
      RefundReceivingSource.ORIGINAL_SOURCE,
      RefundReceivingSource.UPI,
      RefundReceivingSource.BANK_TRANSFER,
      RefundReceivingSource.REWARDS,
    ],
    {
      message:
        'refundReceivingSource must be one of: ORIGINAL_SOURCE, UPI, BANK_TRANSFER, REWARDS',
    },
  )
  refundReceivingSource?: RefundReceivingSource;

  @ApiPropertyOptional({
    description: 'The UPI ID (required if refundReceivingSource is UPI).',
    example: 'customer@upi',
  })
  @ValidateIf(
    (o) =>
      o.returnType === ReturnType.REFUND &&
      o.refundReceivingSource === RefundReceivingSource.UPI,
  )
  @IsNotEmpty({
    message: 'upiId is required when refundReceivingSource is UPI',
  })
  @IsString()
  upiId?: string;

  @ApiPropertyOptional({
    description:
      'The name of the bank account holder (required if refundReceivingSource is BANK_TRANSFER).',
    example: 'John Doe',
  })
  @ValidateIf(
    (o) =>
      o.returnType === ReturnType.REFUND &&
      o.refundReceivingSource === RefundReceivingSource.BANK_TRANSFER,
  )
  @IsNotEmpty({
    message:
      'accountHolderName is required when refundReceivingSource is BANK_TRANSFER',
  })
  @IsString()
  accountHolderName?: string;

  @ApiPropertyOptional({
    description:
      'The name of the bank (required if refundReceivingSource is BANK_TRANSFER).',
    example: 'HDFC Bank',
  })
  @ValidateIf(
    (o) =>
      o.returnType === ReturnType.REFUND &&
      o.refundReceivingSource === RefundReceivingSource.BANK_TRANSFER,
  )
  @IsNotEmpty({
    message: 'bankName is required when refundReceivingSource is BANK_TRANSFER',
  })
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description:
      'The bank account number (required if refundReceivingSource is BANK_TRANSFER).',
    example: '1234567890',
  })
  @ValidateIf(
    (o) =>
      o.returnType === ReturnType.REFUND &&
      o.refundReceivingSource === RefundReceivingSource.BANK_TRANSFER,
  )
  @IsNotEmpty({
    message:
      'accountNumber is required when refundReceivingSource is BANK_TRANSFER',
  })
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({
    description:
      'The bank IFSC code (required if refundReceivingSource is BANK_TRANSFER).',
    example: 'HDFC0001234',
  })
  @ValidateIf(
    (o) =>
      o.returnType === ReturnType.REFUND &&
      o.refundReceivingSource === RefundReceivingSource.BANK_TRANSFER,
  )
  @IsNotEmpty({
    message: 'ifscCode is required when refundReceivingSource is BANK_TRANSFER',
  })
  @IsString()
  ifscCode?: string;
}

export class CreateStockReturnDto {
  @ApiProperty({
    description:
      'The stock request ID associated with the franchise stock return.',
    example: 'stock_req_12345',
  })
  @IsString()
  @IsNotEmpty()
  stockRequestId!: string;

  @ApiProperty({
    description:
      'The type of return being requested. For Franchise stock, this MUST be RETURN.',
    enum: [ReturnType.RETURN],
    example: ReturnType.RETURN,
  })
  @IsEnum(ReturnType)
  @IsNotEmpty()
  returnType!: typeof ReturnType.RETURN;

  @ApiPropertyOptional({
    description: 'The main reason for the return request.',
    enum: ReturnReasonEnum,
    example: ReturnReasonEnum.OTHER,
  })
  @IsOptional()
  @IsEnum(ReturnReasonEnum)
  reason?: ReturnReasonEnum;

  @ApiPropertyOptional({
    description: 'General remarks or notes.',
    example: 'Franchise returning unsold stock.',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    description: 'The list of items being returned.',
    type: [ReturnItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @ApiPropertyOptional({
    description:
      'Images uploaded by the customer/store showing product state or proof of defect.',
    type: [String],
    example: ['https://example.com/item-defect-image1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
