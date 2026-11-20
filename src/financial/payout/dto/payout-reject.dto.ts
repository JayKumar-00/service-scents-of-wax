import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PayoutRejectDto {
  @ApiProperty({
    description: 'Reason',
    example: 'Reason',
  })
  @IsString()
  reason!: string;
}
