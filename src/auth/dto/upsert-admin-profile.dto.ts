import { ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertAdminProfileDto {
  @ApiPropertyOptional({ example: 'John Admin' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Operations Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/profile.jpg' })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional({ example: 'Gift Factory Pvt Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  companyLogo?: string;

  @ApiPropertyOptional({ example: 'company@example.com' })
  @IsOptional()
  @IsEmail()
  companyEmail?: string;

  @ApiPropertyOptional({ example: '+91-9988776655' })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  companyPhone?: string;

  @ApiPropertyOptional({ example: '27ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  gstNumber?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  panNumber?: string;

  @ApiPropertyOptional({ enum: BusinessType, example: BusinessType.RETAIL })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: '123 Business Street' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Suite 505' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Ahmedabad' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Gujarat' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: '380015' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deletedAt?: Date | null;
}
