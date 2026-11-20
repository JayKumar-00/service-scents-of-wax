import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PaymentRefundDto {
  @ApiProperty({
    description: 'The ID of the payment to be refunded',
    example: 'pay_29QQoUBi66xm2',
  })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @ApiPropertyOptional({
    description:
      'The amount to be refunded (in the smallest currency unit, e.g., paise for INR)',
    example: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;
}
