import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty } from 'class-validator';

export class RedeemPointsDto {
  @ApiProperty({
    example: 250,
    description: 'Number of points to redeem (must be 100, 250, 500, or 1000)',
  })
  @IsInt()
  @IsIn([100, 250, 500, 1000])
  @IsNotEmpty()
  points!: number;
}
