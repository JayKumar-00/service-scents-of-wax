import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InvoiceAddressDto {
  @ApiPropertyOptional({
    description: 'Full name of the recipient',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the recipient',
    example: '9981774637',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Address line 1',
    example: '123 Main St',
  })
  @IsString()
  @IsNotEmpty()
  addressLine1!: string;

  @ApiPropertyOptional({
    description: 'Address line 2',
    example: 'Apt 4B',
  })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({
    description: 'City of the recipient',
    example: 'Bilaspur',
  })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiPropertyOptional({
    description: 'State of the recipient',
    example: 'Chhattisgarh',
  })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({
    description: 'Country of the recipient',
    example: 'India',
  })
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiProperty({
    description: 'Zip code of the recipient',
    example: '495001',
  })
  @IsString()
  @IsNotEmpty()
  zipCode!: string;

  @ApiPropertyOptional({
    description: "Landmark near the recipient's address",
    example: 'Near City Mall',
  })
  @IsOptional()
  @IsString()
  landmark?: string;
}
