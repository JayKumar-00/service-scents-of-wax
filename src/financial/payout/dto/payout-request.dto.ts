import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreatePayoutRequestDto {
  @ApiProperty({
    description: 'Amount to request for payout',
    example: 1500,
  })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({
    description: 'Optional note / description for the request',
    example: 'Monthly commission withdrawal',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
