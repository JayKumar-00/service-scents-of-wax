import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
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
    description: 'City of the address',
    example: 'New York',
  })
  @IsString()
  state!: string;

  @ApiProperty({
    description: 'City of the address',
    example: 'New York',
  })
  @IsString()
  postalCode!: string;

  @ApiProperty({
    description: 'Country of the address',
    example: 'USA',
  })
  @IsString()
  country!: string;

  @ApiPropertyOptional({
    description: 'Latitude of the address (optional)',
    example: 40.7128,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude of the address (optional)',
    example: -74.006,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Indicates if this address is the default address (optional)',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;
}
