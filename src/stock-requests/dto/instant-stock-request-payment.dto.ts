import { ApiProperty } from '@nestjs/swagger';
import { CreditDurationEnum, StockRequestPaymentMode } from '@prisma/client';
import { IsEnum, IsOptional, ValidateIf } from 'class-validator';

export class InstantStockRequestPaymentDto {
  @ApiProperty({
    description: 'Payment mode for the stock request',
    enum: StockRequestPaymentMode,
    example: StockRequestPaymentMode.DIRECT,
  })
  @IsEnum(StockRequestPaymentMode)
  paymentMode!: StockRequestPaymentMode;

  @ApiProperty({
    description: 'Credit duration when payment mode is CREDIT',
    enum: CreditDurationEnum,
    required: false,
    example: CreditDurationEnum.DAY_30,
  })
  @IsOptional()
  @IsEnum(CreditDurationEnum)
  duration?: CreditDurationEnum;
}
