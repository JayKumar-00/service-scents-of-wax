import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import {
  OrderChannel,
  ReturnType,
  PaymentModeEnum,
  RefundMethod,
  RefundStatus,
} from '@prisma/client';

export class FinancialReportQueryDto {
  @ApiProperty({ description: 'Start date filter', required: false })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiProperty({ description: 'End date filter', required: false })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiProperty({ description: 'Franchise ID filter', required: false })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiProperty({ description: 'Customer ID filter', required: false })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ description: 'Retail Customer ID filter', required: false })
  @IsString()
  @IsOptional()
  retailCustomerId?: string;

  @ApiProperty({
    description: 'Channel filter (ONLINE/POS)',
    required: false,
    enum: OrderChannel,
  })
  @IsEnum(OrderChannel)
  @IsOptional()
  channel?: OrderChannel;

  @ApiProperty({
    description: 'Return request type filter',
    required: false,
    enum: ReturnType,
  })
  @IsEnum(ReturnType)
  @IsOptional()
  returnType?: ReturnType;

  @ApiProperty({
    description: 'Payment mode filter',
    required: false,
    enum: PaymentModeEnum,
  })
  @IsEnum(PaymentModeEnum)
  @IsOptional()
  paymentMode?: PaymentModeEnum;

  @ApiProperty({
    description: 'Refund method filter',
    required: false,
    enum: RefundMethod,
  })
  @IsEnum(RefundMethod)
  @IsOptional()
  refundMethod?: RefundMethod;

  @ApiProperty({
    description: 'Refund status filter',
    required: false,
    enum: RefundStatus,
  })
  @IsEnum(RefundStatus)
  @IsOptional()
  refundStatus?: RefundStatus;
}
