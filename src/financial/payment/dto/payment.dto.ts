import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { OnlinePaymentModeEnum } from 'src/financial/credit/enums/credit.enum';

export class BasePaymentDto {
  @ApiProperty({
    description: 'Payment amount',
    example: 1000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({
    description: 'Payment mode',
    enum: OnlinePaymentModeEnum,
  })
  @IsEnum(OnlinePaymentModeEnum)
  @IsNotEmpty()
  onlinePaymentMode!: OnlinePaymentModeEnum;

  @ApiProperty({
    description:
      'Reference ID for the payment (e.g., transaction ID from payment gateway)',
    example: 'txn_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  referenceId!: string; // payment id

  @ApiPropertyOptional({
    description: 'Additional details about the payment',
    example: 'Payment for credit adjustment',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
