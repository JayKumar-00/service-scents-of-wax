import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { AdjustmentEnum } from '../enums/credit.enum';
import { DirectionEnum } from '@prisma/client';

export class AdjustCreditDto {
  @ApiProperty({
    description:
      'The ID of the franchise associated with the credit adjustment.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  franchiseId!: string;

  @ApiProperty({
    description: 'The amount to adjust the credit by.',
    example: 100.0,
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({
    description: 'The type of credit adjustment.',
    example: AdjustmentEnum.ADJUSTMENT,
  })
  @IsEnum(AdjustmentEnum)
  type!: AdjustmentEnum;

  @ApiProperty({
    description: 'The direction of the credit adjustment.',
    enum: DirectionEnum,
    example: DirectionEnum.CREDIT,
  })
  @IsEnum(DirectionEnum)
  direction!: DirectionEnum;

  @ApiProperty({
    description: 'The reason for the credit adjustment.',
    example: 'Customer request',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class AdjustCreditLimitDto {
  @ApiProperty({
    description:
      'The ID of the franchise whose credit limit is being adjusted.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  franchiseId!: string;

  @ApiProperty({
    description: 'The amount to adjust the credit limit by.',
    example: 500.0,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  delta!: number; //+ve increase, -ve decrease

  @ApiPropertyOptional({
    description: 'The reason for the credit limit adjustment.',
    example: 'Annual review adjustment',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
