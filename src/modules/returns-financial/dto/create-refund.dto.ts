import {
  ApiProperty,
  ApiPropertyOptional,
  ApiHideProperty,
} from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { RefundMethod } from '@prisma/client';

export class CreateRefundDto {
  @ApiProperty({ description: 'The Return Request ID' })
  @IsString()
  @IsNotEmpty()
  returnId!: string;

  @ApiPropertyOptional({
    description: 'Refund payment method',
    enum: RefundMethod,
  })
  @IsEnum(RefundMethod)
  @IsOptional()
  method?: RefundMethod;

  @ApiHideProperty()
  @IsString()
  @IsOptional()
  paymentReferenceId?: string;

  @ApiProperty({ description: 'Optional remarks/notes', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Override refund amount (SUPERADMIN only)',
  })
  @IsNumber()
  @IsOptional()
  overrideAmount?: number;

  @ApiPropertyOptional({
    description:
      'Reason for override amount (mandatory if overrideAmount is specified)',
  })
  @IsString()
  @IsOptional()
  overrideReason?: string;
}
