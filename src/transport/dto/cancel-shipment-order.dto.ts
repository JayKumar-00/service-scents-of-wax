import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';

export class CancelShipmentOrderDto {
  @ApiProperty({
    description: 'Shiprocket order IDs to cancel',
    example: [16168898, 16167171],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  ids!: number[];
}
