import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { CreateCustomerAddressDto } from 'src/users/dto/address.dto';

export class RegistrationBaseDto {
  @ApiProperty({
    description: 'Email address of the customer',
    example: 'user@gmail.com',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}

export class RegistrationCustomerDto extends RegistrationBaseDto {
  @ApiPropertyOptional({
    description: 'Name of the customer',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Password for the customer account',
    example: 'P@ssw0rd',
  })
  @IsString()
  @Length(8, 12)
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;

  @ApiProperty({
    description: `OTP`,
    example: 'XXX001',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 characters' })
  @IsNotEmpty()
  otp!: string;

  @ApiPropertyOptional({
    description: 'Referral code or email or customer ID of the referrer',
    example: 'customer-referrer-id',
  })
  @IsString()
  @IsOptional()
  referralCode?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the customer',
    example: '9876543210',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Optional addresses JSON payload',
    type: [CreateCustomerAddressDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerAddressDto)
  addresses?: CreateCustomerAddressDto[];
}
