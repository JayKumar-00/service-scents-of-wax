import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CapturePaymentDto {
  @ApiProperty({
    description: 'The ID of the payment to capture',
    example: 'pay_29QQoUBi66xm2',
  })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @ApiProperty({
    description:
      'The amount to capture (in the smallest currency unit, e.g., paise for INR)',
    example: 5000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  amount!: number;
}
