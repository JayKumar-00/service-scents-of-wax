import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class AddPickupLocationDto {
  @ApiProperty({ example: 'warehouse_delhi' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  pickup_location!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '9876543210' })
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone must be a valid Indian number',
  })
  phone!: string;

  @ApiProperty({ example: 'Street 1, Area' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  address!: string;

  @ApiPropertyOptional({ example: 'Near Metro Station' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  address_2?: string;

  @ApiProperty({ example: 'Delhi' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ example: 'Delhi' })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({ example: 'India' })
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiPropertyOptional({
    description: 'Pickup location opening time in HH:mm format',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  open_time?: string;

  @ApiPropertyOptional({
    description: 'Pickup location closing time in HH:mm format',
    example: '18:00',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  close_time?: string;

  @ApiProperty({ example: '110001' })
  @Matches(/^\d{6}$/, {
    message: 'Pincode must be 6 digits',
  })
  pin_code!: string;

  @ApiProperty({
    description: 'Latitude of the pickup location',
    example: 28.6139,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiProperty({
    description: 'Longitude of the pickup location',
    example: 77.209,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  long?: number;
}
