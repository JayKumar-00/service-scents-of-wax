import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum BooleanEnum {
  TRUE = 'true',
  FALSE = 'false',
}

export enum RazorpayPaymentEntity {
  PAYMENT = 'payment',
}

export enum RazorpayPaymentStatus {
  CREATED = 'created',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export enum RazorpayRefundStatus {
  NULL = 'null',
  PARTIAL = 'partial',
  FULL = 'full',
}

export enum RazorpayCurrency {
  INR = 'INR',
}

export enum RazorpayPaymentMethod {
  CARD = 'card',
  NETBANKING = 'netbanking',
  WALLET = 'wallet',
  EMI = 'emi',
  UPI = 'upi',
  BANK_TRANSFER = 'bank_transfer',
  PAYLATER = 'paylater',
}

export class TransactionQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Records per page',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter from date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    enum: RazorpayPaymentEntity,
  })
  @IsOptional()
  @IsEnum(RazorpayPaymentEntity)
  entity?: RazorpayPaymentEntity;

  @ApiPropertyOptional({
    description: 'Minimum payment amount in paisa',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum payment amount in paisa',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Minimum refunded amount',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmountRefunded?: number;

  @ApiPropertyOptional({
    description: 'Maximum refunded amount',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmountRefunded?: number;

  @ApiPropertyOptional({
    enum: RazorpayCurrency,
  })
  @IsOptional()
  @IsEnum(RazorpayCurrency)
  currency?: RazorpayCurrency;

  @ApiPropertyOptional({
    enum: RazorpayPaymentStatus,
  })
  @IsOptional()
  @IsEnum(RazorpayPaymentStatus)
  status?: RazorpayPaymentStatus;

  @ApiPropertyOptional({
    enum: RazorpayRefundStatus,
  })
  @IsOptional()
  @IsEnum(RazorpayRefundStatus)
  refund_status?: RazorpayRefundStatus;

  @ApiPropertyOptional({
    description: 'Razorpay order id',
  })
  @IsOptional()
  @IsString()
  order_id?: string;

  @ApiPropertyOptional({
    description: 'Razorpay invoice id',
  })
  @IsOptional()
  @IsString()
  invoice_id?: string;

  @ApiPropertyOptional({
    description: 'Razorpay card id',
  })
  @IsOptional()
  @IsString()
  card_id?: string;

  @ApiPropertyOptional({
    description: 'Bank name',
  })
  @IsOptional()
  @IsString()
  bank?: string;

  @ApiPropertyOptional({
    description: 'Wallet provider',
  })
  @IsOptional()
  @IsString()
  wallet?: string;

  @ApiPropertyOptional({
    description: 'UPI VPA',
  })
  @IsOptional()
  @IsString()
  vpa?: string;

  @ApiPropertyOptional({
    description: 'Customer email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Customer contact number (Example: 9999999999)',
  })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional({
    enum: RazorpayPaymentMethod,
  })
  @IsOptional()
  @IsEnum(RazorpayPaymentMethod)
  method?: RazorpayPaymentMethod;

  @ApiPropertyOptional({
    description: 'International payment',
    enum: BooleanEnum,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  international?: BooleanEnum;

  @ApiPropertyOptional({
    description: 'Captured payment',
    enum: BooleanEnum,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  captured?: BooleanEnum;
}
