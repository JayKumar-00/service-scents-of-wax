import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PayoutApproveDto {
  @ApiProperty({
    description: 'Payout reference ID',
    example: 'ref_1',
  })
  @IsString()
  referenceId!: string;
}
