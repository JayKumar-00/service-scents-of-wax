import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomerAddressDto {
  @ApiPropertyOptional({
    description: 'Full name of the customer',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the customer',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'First line of the address',
    example: '123 Main St',
  })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({
    description: 'Second line of the address (optional)',
    example: 'Apt 4B',
  })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'City of the address',
    example: 'New York',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'State or province of the address',
    example: 'New York',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Postal or ZIP code of the address',
    example: '10001',
  })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Country of the address',
    example: 'INDIA',
  })
  @IsOptional()
  @IsString()
  country?: string;

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
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;
}
