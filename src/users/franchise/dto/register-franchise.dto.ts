import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsBoolean,
  IsEmail,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
  IsDateString,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FranchiseDocumentDto } from './franchise-document.dto';
import { GenderEnum } from 'src/users/gender.enum';

class BankDetailsDto {
  @ApiProperty({ example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  accountHolderName!: string;

  @ApiProperty({ example: 'HDFC Bank' })
  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @ApiProperty({ example: 'HDFC0001234' })
  @IsString()
  @IsNotEmpty()
  ifscCode!: string;
}

export class RegisterFranchiseDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional({ enum: GenderEnum })
  @IsEnum(GenderEnum)
  @IsOptional()
  gender?: GenderEnum;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  @IsNotEmpty()
  otp!: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Gift Factory MG Road' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 12.9716 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiProperty({ example: 77.5946 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @ApiPropertyOptional({ example: 'North Bangalore' })
  @IsOptional()
  @IsString()
  territory?: string;

  @ApiPropertyOptional({ example: 'KA' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'No. 24, 1st Cross Road' })
  @IsString()
  addressLine1!: string;

  @ApiProperty({ example: 'Bengaluru' })
  @IsString()
  city!: string;

  @ApiProperty({ example: '560001' })
  @IsString()
  postalCode!: string;

  @ApiPropertyOptional({ example: 'IN' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Rajesh Kumar' })
  @IsOptional()
  @IsString()
  ownerFullName?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiPropertyOptional({ example: 'owner@example.com' })
  @IsOptional()
  @IsString()
  ownerEmail?: string;

  @ApiPropertyOptional({ example: 'Gift Factory Retail LLP' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ example: '29ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  panNumber?: string;

  @ApiPropertyOptional({ example: 'GST' })
  @IsOptional()
  @IsString()
  kycDocumentType?: string;

  @ApiPropertyOptional({ example: '29ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  kycDocumentNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  sopTrainingCompleted?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  sopBrandingCompleted?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  sopInfraAuditCompleted?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  sopPosSetupCompleted?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  sopSafetyCompleted?: boolean;

  @ApiPropertyOptional({ example: 'Initial registration note' })
  @IsOptional()
  @IsString()
  sopNote?: string;

  @ApiPropertyOptional({ type: FranchiseDocumentDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => FranchiseDocumentDto)
  documents?: FranchiseDocumentDto[];

  @ApiPropertyOptional({ type: BankDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankDetailsDto)
  bankDetails?: BankDetailsDto;
}
