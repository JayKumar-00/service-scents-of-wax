import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class CancelShipmentByAwbDto {
  @ApiProperty({
    description: 'AWB numbers to cancel',
    example: ['19041211125783'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  awbs!: string[];
}
