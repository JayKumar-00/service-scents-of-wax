import { ApiProperty } from '@nestjs/swagger';
import { PaymentModeEnum } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class RetailCustomerPaymentDto {
  @ApiProperty({
    description: 'Payment mode used for the POS order',
    enum: PaymentModeEnum,
    example: PaymentModeEnum.CARD,
  })
  @IsEnum(PaymentModeEnum)
  paymentMode!: PaymentModeEnum;
}
