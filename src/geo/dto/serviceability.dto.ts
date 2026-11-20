import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ServiceabilityDto {
  @ApiProperty({
    description: 'Latitude of the location to check',
    example: 12.9716,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    description: 'Longitude of the location to check',
    example: 77.5946,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiProperty({
    description:
      'Maximum delivery radius in kilometers (optional, defaults to env MAX_DELIVERY_RADIUS_KM or 120km)',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5000)
  maxRadiusKm?: number;
}
