import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  StockRequestPaymentStatus,
  StockRequestPaymentMode,
  CreditDurationEnum,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateStockRequestPaymentDto {
  @ApiPropertyOptional({
    description: 'The new amount for the stock request payment.',
    example: 150.75,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Payment mode for the stock request',
    enum: StockRequestPaymentMode,
    example: StockRequestPaymentMode.CREDIT,
  })
  @IsOptional()
  @IsEnum(StockRequestPaymentMode)
  paymentMode?: StockRequestPaymentMode;

  @ApiPropertyOptional({
    description: 'Credit duration when payment mode is CREDIT',
    enum: CreditDurationEnum,
    example: CreditDurationEnum.DAY_30,
  })
  @IsOptional()
  @IsEnum(CreditDurationEnum)
  creditDuration?: CreditDurationEnum;

  @ApiPropertyOptional({
    description: 'The new payment status of the stock request.',
    enum: StockRequestPaymentStatus,
  })
  @IsOptional()
  @IsEnum(StockRequestPaymentStatus)
  paymentStatus?: StockRequestPaymentStatus;

  @ApiPropertyOptional({
    description:
      'An optional reference for the payment (e.g., transaction ID).',
    example: 'TXN123456789',
  })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({
    description: 'An optional note about the payment.',
    example: 'Payment received via bank transfer on 2024-06-01.',
  })
  @IsOptional()
  @IsString()
  paymentNote?: string;

  @ApiPropertyOptional({
    description:
      'The date and time when the payment was received (ISO 8601 format).',
    example: '2024-06-01',
  })
  @IsOptional()
  @IsString()
  paymentReceivedAt?: string;
}
