import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
} from 'class-validator';

export enum PickupStatus {
  RETRY = 'retry',
}

export class GeneratePickupDto {
  @ApiProperty({
    example: [16090109],
    description:
      'The shipment id of the shipment which is requested for pickup.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  shipmentIds!: number[];

  @ApiPropertyOptional({
    example: 'retry',
    description:
      'Use this field to retry if the pickup request fails. Value: retry',
  })
  @IsOptional()
  @IsBoolean()
  retry?: boolean;

  @ApiPropertyOptional({
    example: '2022-06-04',
    description:
      'Use this field to schedule a pickup for a future date. The date format would be YYYY-MM-DD. You can reschedule the date till that date has not passed',
  })
  @IsOptional()
  @IsDateString()
  pickupDate?: string;
}
