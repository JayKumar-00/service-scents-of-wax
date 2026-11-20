import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, ValidateIf } from 'class-validator';

export class PayOrderDto {
  @ApiProperty({
    description:
      'Payment mode, Ex: demo (for testing) or razorpay (for production)',
    enum: ['demo', 'razorpay'],
  })
  @IsIn(['demo', 'razorpay'])
  mode!: 'demo' | 'razorpay';

  @ApiProperty({
    description: 'Payment reference from the payment provider, Ex: PAY-12345',
  })
  @ValidateIf((o: PayOrderDto) => o.mode === 'razorpay')
  @IsString()
  razorpayOrderId?: string;

  @ApiProperty({
    description: 'Payment ID from Razorpay, Ex: pay_29QQoUBi66xm2f',
  })
  @ValidateIf((o: PayOrderDto) => o.mode === 'razorpay')
  @IsString()
  razorpayPaymentId?: string;

  @ApiProperty({
    description: 'Signature from Razorpay for verifying the payment',
  })
  @ValidateIf((o: PayOrderDto) => o.mode === 'razorpay')
  @IsString()
  razorpaySignature?: string;
}
