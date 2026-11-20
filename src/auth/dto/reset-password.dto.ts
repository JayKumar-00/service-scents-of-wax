import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ResetPasswordWithOtpDto {
  /**
   * One-Time Password (OTP)
   * @example 'XXX001'
   */
  @ApiProperty({
    description: `OTP`,
    example: 'XXX001',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  otp!: string;

  /**
   * New password
   * @example '********'
   */
  @ApiProperty({
    description: `UserPassword`,
    example: '********',
  })
  @IsOptional()
  @IsString()
  @Length(6, 12)
  password!: string;

  /**
   * Re-enter new password
   * @example '********'
   */
  @ApiProperty({
    description: `Confirm-Password`,
    example: '********',
  })
  @IsOptional()
  @IsString()
  @Length(6, 12)
  confirmPassword!: string;
}
