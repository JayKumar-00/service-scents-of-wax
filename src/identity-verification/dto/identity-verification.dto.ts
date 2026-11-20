import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
// DTOs
export class PanVerificationDto {
  @ApiProperty({ example: 'EKRPR1234F', description: 'PAN Number to verify' })
  @IsString()
  @IsNotEmpty()
  id_number!: string;
}

export class AadhaarValidationDto {
  @ApiProperty({
    example: '917646971298',
    description: 'Aadhaar Number to validate',
  })
  @IsString()
  @IsNotEmpty()
  id_number!: string;
}

export class GenerateOtpDto {
  @ApiProperty({
    example: '917646971298',
    description: 'Aadhaar Number to generate OTP for',
  })
  @IsString()
  @IsNotEmpty()
  id_number!: string;
}

export class SubmitOtpDto {
  @ApiProperty({
    example: 'aadhaar_v2_rCVObUoEpbHOUsmykmjr',
    description: 'Client ID from generate OTP response',
  })
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @ApiProperty({ example: '123456', description: 'OTP received' })
  @IsString()
  @IsNotEmpty()
  otp!: string;
}

export class BankVerificationDto {
  @ApiProperty({
    example: '219101000000000',
    description: 'Bank Account Number',
  })
  @IsString()
  @IsNotEmpty()
  id_number!: string;

  @ApiProperty({ example: 'BARB0DAMOHA', description: 'IFSC Code' })
  @IsString()
  @IsNotEmpty()
  ifsc!: string;

  @ApiPropertyOptional({ example: true, description: 'Include IFSC details' })
  @IsBoolean()
  @IsOptional()
  ifsc_details?: boolean;
}

export class UpiVerificationDto {
  @ApiProperty({ example: '1234567890@ybl', description: 'UPI ID to verify' })
  @IsString()
  @IsNotEmpty()
  upi_id!: string;
}

export class VoterIdVerificationDto {
  @ApiProperty({ example: 'TRY1234567', description: 'Voter ID Card Number' })
  @IsString()
  @IsNotEmpty()
  id_number!: string;
}

export class DrivingLicenseVerificationDto {
  @ApiProperty({
    example: 'TS02620190003657',
    description: 'Driving License Number',
  })
  @IsString()
  @IsNotEmpty()
  id_number!: string;

  @ApiProperty({
    example: '1998-06-15',
    description: 'Date of Birth (YYYY-MM-DD)',
  })
  @IsString()
  @IsNotEmpty()
  dob!: string;
}

export class PassportVerificationDto {
  @ApiProperty({ example: 'TTJmMxbZQi', description: 'Passport Client ID' })
  @IsString()
  @IsNotEmpty()
  client_id!: string;
}

export class GstinVerificationDto {
  @ApiProperty({ example: '08AKWPJ1234H1ZN', description: 'GSTIN to verify' })
  @IsString()
  @IsNotEmpty()
  id_number!: string;
}

export class GstAdvanceVerificationDto {
  @ApiProperty({
    example: '27AAACR5055K2Z6',
    description: 'GSTIN for Advanced verification',
  })
  @IsString()
  @IsNotEmpty()
  id_number!: string;
}

export class IrnVerificationDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'E-Invoice PDF/Image file',
  })
  file!: any;

  @ApiProperty({
    example: 'true',
    description: 'Whether to use PDF verification',
  })
  @IsString()
  @IsNotEmpty()
  use_pdf!: string;
}

export class FaceMatchDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Selfie Image',
  })
  selfie!: any;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'ID Card Image',
  })
  id_card!: any;
}
