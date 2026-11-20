import { ApiProperty } from '@nestjs/swagger';
import { OtpModeEnum } from '../enums/otp-mode.enum';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    enum: OtpModeEnum,
    description: 'OTP sending mode (email or phone)',
  })
  @IsEnum(OtpModeEnum)
  mode!: OtpModeEnum;

  @ApiProperty({
    description: 'Email address (required if mode is email)',
    required: false,
    example: 'test@gmail.com',
  })
  @ValidateIf((o) => o.mode === OtpModeEnum.EMAIL)
  @IsNotEmpty({ message: 'Email is required when mode is email' })
  @IsString()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiProperty({
    description: 'Phone number (required if mode is phone)',
    required: false,
    example: '9876543210',
  })
  @ValidateIf((o) => o.mode === OtpModeEnum.PHONE)
  @IsNotEmpty({ message: 'Phone number is required when mode is phone' })
  @IsString()
  phone?: string;
}
