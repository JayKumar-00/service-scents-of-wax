import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { BasePaymentDto } from 'src/financial/payment/dto/payment.dto';
import { PaymentModeEnum } from '../enums/credit.enum';

export class CreditPaymentDto extends BasePaymentDto {
  @ApiProperty({
    description: 'Payment mode',
    enum: PaymentModeEnum,
    example: PaymentModeEnum.CASH,
  })
  @IsEnum(PaymentModeEnum)
  @IsNotEmpty()
  paymentMode!: PaymentModeEnum;
}
