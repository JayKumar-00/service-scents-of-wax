import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNumber } from 'class-validator';

export class PrintManifestDto {
  @ApiProperty({
    type: [Number],
    example: [12345, 67890],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number) // convert query/body string → number
  @IsNumber({}, { each: true })
  orderIds!: number[];

  //   @ApiProperty({
  //     type: [String],
  //     example: ['12345', '67890'],
  //   })
  //   @IsArray()
  //   @ArrayNotEmpty()
  //   @IsString({ each: true })
  //   orderIds: string[];
}
