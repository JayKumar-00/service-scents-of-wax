import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNumber } from 'class-validator';

export class GenerateLabelDto {
  @ApiProperty({
    example: [16104408, 16104409],
    description:
      'The shipment id of the order whose label is to be generated. Multiple ids can be passed together as an array.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  shipmentIds!: number[];
}
