import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNumber } from 'class-validator';

export class GenerateInvoiceDto {
  @ApiProperty({
    example: [16255275, 16255276],
    description:
      'The Shiprocket order id of the orders whose invoices are to be created. Multiple ids can be passed together as an array.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  shiprocketOrderIds!: number[];
}
