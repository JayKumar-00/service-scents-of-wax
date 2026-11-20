import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ReferenceTypeEnum } from '../enums/credit.enum';

export class ApplyCreditDto {
  @ApiProperty({
    description: 'ID of the franchise applying for credit',
    example: 'franchise_12345',
  })
  @IsString()
  @IsNotEmpty()
  franchiseId!: string;

  @ApiProperty({
    description: 'Amount of credit to apply for',
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({
    description: 'Type of reference for the credit application',
    enum: ReferenceTypeEnum,
  })
  @IsEnum(ReferenceTypeEnum)
  @IsNotEmpty()
  referenceType!: ReferenceTypeEnum;

  @ApiProperty({
    description:
      'ID of the reference entity (e.g., order ID or stock request ID)',
    example: 'order_67890',
  })
  @IsString()
  @IsNotEmpty()
  referenceId!: string;

  @ApiProperty({
    description: 'Optional description for the credit application',
    example: 'Credit for order #67890',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
