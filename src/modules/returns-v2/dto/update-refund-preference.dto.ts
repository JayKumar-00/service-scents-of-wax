import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { RefundReceivingSource } from '@prisma/client';

export class UpdateRefundPreferenceDto {
  @ApiProperty({
    description:
      'The preferred source to receive the refund. Options: ORIGINAL_SOURCE, UPI, BANK_TRANSFER, REWARDS.',
    enum: RefundReceivingSource,
    example: RefundReceivingSource.UPI,
  })
  @IsIn(
    [
      RefundReceivingSource.ORIGINAL_SOURCE,
      RefundReceivingSource.UPI,
      RefundReceivingSource.BANK_TRANSFER,
      RefundReceivingSource.REWARDS,
    ],
    {
      message:
        'refundReceivingSource must be one of: ORIGINAL_SOURCE, UPI, BANK_TRANSFER, REWARDS',
    },
  )
  @IsNotEmpty()
  refundReceivingSource!: RefundReceivingSource;

  @ApiPropertyOptional({
    description: 'The UPI ID (required if refundReceivingSource is UPI).',
    example: 'customer@upi',
  })
  @ValidateIf((o) => o.refundReceivingSource === RefundReceivingSource.UPI)
  @IsNotEmpty({
    message: 'upiId is required when refundReceivingSource is UPI',
  })
  @IsString()
  upiId?: string;

  @ApiPropertyOptional({
    description:
      'The name of the bank account holder (required if refundReceivingSource is BANK_TRANSFER).',
    example: 'John Doe',
  })
  @ValidateIf(
    (o) => o.refundReceivingSource === RefundReceivingSource.BANK_TRANSFER,
  )
  @IsNotEmpty({
    message:
      'accountHolderName is required when refundReceivingSource is BANK_TRANSFER',
  })
  @IsString()
  accountHolderName?: string;

  @ApiPropertyOptional({
    description:
      'The name of the bank (required if refundReceivingSource is BANK_TRANSFER).',
    example: 'HDFC Bank',
  })
  @ValidateIf(
    (o) => o.refundReceivingSource === RefundReceivingSource.BANK_TRANSFER,
  )
  @IsNotEmpty({
    message: 'bankName is required when refundReceivingSource is BANK_TRANSFER',
  })
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description:
      'The bank account number (required if refundReceivingSource is BANK_TRANSFER).',
    example: '1234567890',
  })
  @ValidateIf(
    (o) => o.refundReceivingSource === RefundReceivingSource.BANK_TRANSFER,
  )
  @IsNotEmpty({
    message:
      'accountNumber is required when refundReceivingSource is BANK_TRANSFER',
  })
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({
    description:
      'The bank IFSC code (required if refundReceivingSource is BANK_TRANSFER).',
    example: 'HDFC0001234',
  })
  @ValidateIf(
    (o) => o.refundReceivingSource === RefundReceivingSource.BANK_TRANSFER,
  )
  @IsNotEmpty({
    message: 'ifscCode is required when refundReceivingSource is BANK_TRANSFER',
  })
  @IsString()
  ifscCode?: string;
}
