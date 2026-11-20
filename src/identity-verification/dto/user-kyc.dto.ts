import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { KycDocumentType } from '@prisma/client';

export class VerifyUserKycDto {
  @ApiProperty({
    enum: KycDocumentType,
    example: KycDocumentType.AADHAAR,
    description: 'Type of verification document',
  })
  @IsEnum(KycDocumentType)
  @IsNotEmpty()
  documentType!: KycDocumentType;

  @ApiProperty({
    example: '917646971298',
    description: 'Aadhaar or Document Number to validate',
  })
  @IsString()
  @IsNotEmpty()
  id_number!: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email of the user',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Save result to database',
  })
  @IsBoolean()
  @IsOptional()
  isSaveDB?: boolean;

  @ApiPropertyOptional({
    example: 'BARB0DAMOHA',
    description: 'IFSC Code (required for BANK verification)',
  })
  @IsString()
  @IsOptional()
  ifsc?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Include IFSC details (for BANK verification)',
  })
  @IsBoolean()
  @IsOptional()
  ifsc_details?: boolean;

  @ApiPropertyOptional({
    example: '1998-06-15',
    description:
      'Date of Birth (required for DRIVING_LICENSE verification, format YYYY-MM-DD)',
  })
  @IsString()
  @IsOptional()
  dob?: string;
}

export class CreateUserKycDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email of the user',
  })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: '917646971298',
    description: 'Document/Aadhaar number',
  })
  @IsString()
  @IsNotEmpty()
  idNumber!: string;

  @ApiProperty({ example: 'success', description: 'KYC status' })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({ enum: KycDocumentType, example: KycDocumentType.AADHAAR })
  @IsEnum(KycDocumentType)
  @IsNotEmpty()
  documentType!: KycDocumentType;

  @ApiPropertyOptional({ example: '2027-12-31T23:59:59.999Z' })
  @IsDateString()
  @IsOptional()
  expiryTime?: Date;
}

export class UpdateUserKycDto {
  @ApiPropertyOptional({ example: '917646971298' })
  @IsString()
  @IsOptional()
  idNumber?: string;

  @ApiPropertyOptional({ example: 'success' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ enum: KycDocumentType })
  @IsEnum(KycDocumentType)
  @IsOptional()
  documentType?: KycDocumentType;

  @ApiPropertyOptional({ example: '2027-12-31T23:59:59.999Z' })
  @IsDateString()
  @IsOptional()
  expiryTime?: Date;
}
