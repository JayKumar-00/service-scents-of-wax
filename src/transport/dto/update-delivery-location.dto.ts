import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  Matches,
} from 'class-validator';

export class UpdateDeliveryLocationDto {
  @ApiProperty({
    description: 'Shiprocket Order ID',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @ApiProperty({
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  shipping_customer_name!: string;

  @ApiProperty({
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{10}$/, {
    message: 'shipping_phone must be a valid 10-digit number',
  })
  shipping_phone!: string;

  @ApiProperty({
    example: '123 Main Street',
  })
  @IsString()
  @IsNotEmpty()
  shipping_address!: string;

  @ApiPropertyOptional({
    example: 'Near Bus Stand',
  })
  @IsString()
  @IsOptional()
  shipping_address_2?: string;

  @ApiProperty({
    example: 'Indore',
  })
  @IsString()
  @IsNotEmpty()
  shipping_city!: string;

  @ApiProperty({
    example: 'Madhya Pradesh',
  })
  @IsString()
  @IsNotEmpty()
  shipping_state!: string;

  @ApiProperty({
    example: 'India',
  })
  @IsString()
  @IsNotEmpty()
  shipping_country!: string;

  @ApiProperty({
    example: '452001',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{6}$/, {
    message: 'shipping_pincode must be a valid 6-digit pincode',
  })
  shipping_pincode!: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
  })
  @IsOptional()
  @IsEmail()
  shipping_email?: string;

  @ApiPropertyOptional({
    example: '9876543211',
  })
  @IsOptional()
  @Matches(/^[0-9]{10}$/, {
    message: 'billing_alternate_phone must be a valid 10-digit number',
  })
  billing_alternate_phone?: string;
}
