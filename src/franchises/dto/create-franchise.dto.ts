import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { FranchiseDocumentDto } from '../../users/franchise/dto/franchise-document.dto';

export class CreateFranchiseDto {
  @ApiProperty({ example: 'Gift Factory MG Road' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'GF-001' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 12.9716 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 77.5946 })
  @IsLongitude()
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
  @IsString()
  @IsNotEmpty()
  ownerEmail!: string;

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

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  password?: string;
}
