import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsArray, ArrayNotEmpty, ValidateIf } from 'class-validator';
import { CreditDurationEnum, StockRequestPaymentMode } from '@prisma/client';

export class BulkInstantStockRequestPaymentDto {
  @ApiProperty({
    description: 'List of stock request IDs to pay',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  ids!: string[];

  @ApiProperty({
    description: 'Payment mode for all stock requests',
    enum: StockRequestPaymentMode,
  })
  @IsEnum(StockRequestPaymentMode)
  paymentMode!: StockRequestPaymentMode;

  @ApiProperty({
    description: 'Credit duration when payment mode is CREDIT',
    enum: CreditDurationEnum,
    required: false,
  })
  @ValidateIf((o) => o.paymentMode === StockRequestPaymentMode.CREDIT)
  @IsEnum(CreditDurationEnum)
  duration?: CreditDurationEnum;
}
