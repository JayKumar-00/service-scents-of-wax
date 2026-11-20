import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { RegistrationCustomerDto } from './registration-customer.dto';

export class UpdateCustomerDto extends PartialType(RegistrationCustomerDto) {
  @ApiPropertyOptional({
    description: 'avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({
    description: 'GSTIN number',
    example: '22AAAAA0000A1Z5',
  })
  @IsString()
  @IsOptional()
  gstin?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'user@gmail.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Email address (alternative)',
    example: 'user@gmail.com',
  })
  @IsString()
  @IsOptional()
  altEmail?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '9876543210',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: `Gender ${Object.values(Gender).join(', ')}`,
    enum: Gender,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Date of Birth',
    example: '1990-01-01',
  })
  @IsDateString()
  @IsOptional()
  dob?: string;
}
