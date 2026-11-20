import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class CreatePayoutDto {
  @ApiProperty({
    description: 'Franchise code for which payout is to be created',
    example: 'FRAN12345',
  })
  @IsString()
  code!: string;

  @ApiProperty({
    description: 'Amount to be paid out',
    example: 1500,
  })
  @Type(() => Number)
  @IsNumber()
  amount!: number;
}
