import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FranchiseStatus, KycStatus } from '@prisma/client';
import { FranchiseDocumentDto } from '../../users/franchise/dto/franchise-document.dto';

export class UpdateFranchiseDto {
  @IsOptional()
  @IsEnum(FranchiseStatus)
  status?: FranchiseStatus;

  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  kycNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  territory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  ownerFullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  panNumber?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  basicDetailsCompleted?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  gstDetailsCompleted?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sopChecklistCompleted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  kycDocumentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  kycDocumentNumber?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sopTrainingCompleted?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sopBrandingCompleted?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sopInfraAuditCompleted?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sopPosSetupCompleted?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sopSafetyCompleted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  sopNote?: string;

  @ApiPropertyOptional({ type: FranchiseDocumentDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => FranchiseDocumentDto)
  documents?: FranchiseDocumentDto[];
}
