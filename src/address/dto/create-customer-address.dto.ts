import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerAddressDto {
  @ApiProperty({
    description: 'Full name of the customer',
    example: 'John Doe',
  })
  @IsString()
  fullName!: string;

  @ApiProperty({
    description: 'Phone number of the customer',
    example: '+1234567890',
  })
  @IsString()
  phone!: string;

  @ApiProperty({
    description: 'First line of the address',
    example: '123 Main St',
  })
  @IsString()
  addressLine1!: string;

  @ApiPropertyOptional({
    description: 'Second line of the address (optional)',
    example: 'Apt 4B',
  })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({
    description: 'City of the address',
    example: 'New York',
  })
  @IsString()
  city!: string;

  @ApiProperty({
    description: 'State or province of the address',
    example: 'New York',
  })
  @IsString()
  state!: string;

  @ApiProperty({
    description: 'Postal or ZIP code of the address',
    example: '10001',
  })
  @IsString()
  postalCode!: string;

  @ApiProperty({
    description: 'Country of the address',
    example: 'INDIA',
    default: 'INDIA',
  })
  @IsString()
  country!: string;

  @ApiPropertyOptional({
    description:
      'Latitude of the address. If omitted and address fields are provided, geocoding is used as a fallback.',
    example: 40.7128,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description:
      'Longitude of the address. If omitted and address fields are provided, geocoding is used as a fallback.',
    example: -74.006,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description:
      'Mark this address as the default. When true, all other addresses for the same customer are unset.',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;
}
