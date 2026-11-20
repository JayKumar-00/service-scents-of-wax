import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateManifestDto {
  @ApiProperty({
    type: [Number],
    example: [12345, 67890],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number) // convert query/body string → number
  @IsNumber({}, { each: true })
  shipmentIds!: number[];

  //   @ApiProperty({
  //     type: [String],
  //     example: ['12345', '67890'],
  //   })
  //   @IsArray()
  //   @ArrayNotEmpty()
  //   @IsString({ each: true })
  //   shipmentIds: string[];
}
