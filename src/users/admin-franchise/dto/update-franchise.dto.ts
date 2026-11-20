import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FranchiseGender, KycStatus } from '@prisma/client';
import { FranchiseDocumentDto } from '../../franchise/dto/franchise-document.dto';

export enum StringBoolean {
  TRUE = 'true',
  FALSE = 'false',
}

export class UpdateFranchiseDto {
  @ApiPropertyOptional({ example: 'Gift Factory MG Road' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  dob?: string;

  @ApiPropertyOptional({ enum: FranchiseGender })
  @IsOptional()
  @IsEnum(FranchiseGender)
  gender?: FranchiseGender;

  @ApiPropertyOptional({ example: 12.9716 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 77.5946 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 'North Bangalore' })
  @IsOptional()
  @IsString()
  territory?: string;

  @ApiPropertyOptional({ example: 'KA' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'No. 24, 1st Cross Road' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: '560001' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'India' })
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

  @ApiPropertyOptional({ enum: KycStatus })
  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @ApiPropertyOptional({
    description: 'KYC rejection reason/note if the kycStatus is REJECTED',
    example: 'The provided GST certificate is blurry and unreadable.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  kycNote?: string;

  @ApiPropertyOptional({ enum: StringBoolean })
  @IsOptional()
  @IsEnum(StringBoolean)
  isPasswordReset?: StringBoolean;

  @ApiPropertyOptional({ enum: StringBoolean })
  @IsOptional()
  @IsEnum(StringBoolean)
  basicDetailsCompleted?: StringBoolean;

  @ApiPropertyOptional({ enum: StringBoolean })
  @IsOptional()
  @IsEnum(StringBoolean)
  gstDetailsCompleted?: StringBoolean;

  @ApiPropertyOptional({ enum: StringBoolean })
  @IsOptional()
  @IsEnum(StringBoolean)
  sopChecklistCompleted?: StringBoolean;

  @ApiPropertyOptional({ enum: StringBoolean })
  @IsOptional()
  @IsEnum(StringBoolean)
  sopTrainingCompleted?: StringBoolean;

  @ApiPropertyOptional({ enum: StringBoolean })
  @IsOptional()
  @IsEnum(StringBoolean)
  sopBrandingCompleted?: StringBoolean;

  @ApiPropertyOptional({ enum: StringBoolean })
  @IsOptional()
  @IsEnum(StringBoolean)
  sopInfraAuditCompleted?: StringBoolean;

  @ApiPropertyOptional({ enum: StringBoolean })
  @IsOptional()
  @IsEnum(StringBoolean)
  sopPosSetupCompleted?: StringBoolean;

  @ApiPropertyOptional({ enum: StringBoolean })
  @IsOptional()
  @IsEnum(StringBoolean)
  sopSafetyCompleted?: StringBoolean;

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

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  bundleId?: string;
}
