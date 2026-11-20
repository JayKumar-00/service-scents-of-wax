import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class VerifyEmailOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  @IsNotEmpty()
  otp!: string;
}

export class VerifyPhoneOtpDto {
  @ApiProperty({ example: '8088978979' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  @IsNotEmpty()
  otp!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword@123' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ example: 'NewPassword@123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'long-reset-token-here' })
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty({ example: 'NewStrongPassword123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class UserRegistrationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp!: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'user_id_here' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'refresh_token_here' })
  @IsString()
  refreshToken!: string;
}

export class RecoveryDto {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp!: string;
}
