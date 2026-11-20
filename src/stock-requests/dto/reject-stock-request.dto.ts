import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RejectStockRequestDto {
  @ApiProperty({
    description: 'Reason for rejecting the stock request',
    example: 'Insufficient stock available',
  })
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  reason!: string;
}
