import { ApiProperty } from '@nestjs/swagger';
import { CreditAccountStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class CreditStatusDto {
  @ApiProperty({
    description: 'Current status of the credit account',
    enum: CreditAccountStatus,
    example: CreditAccountStatus.FROZEN,
  })
  @IsEnum(CreditAccountStatus)
  @IsNotEmpty()
  status!: CreditAccountStatus;

  @ApiProperty({
    description:
      'Reason for freezing the account (required if status is FROZEN)',
    example: 'Suspicious activity detected',
    required: false,
  })
  @ValidateIf((o) => o.status === CreditAccountStatus.FROZEN)
  @IsString()
  @IsNotEmpty()
  reason?: string;
}
