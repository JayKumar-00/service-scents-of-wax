import { ApiPropertyOptional } from '@nestjs/swagger';
import { FranchiseStatus, KycStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  NAME = 'name',
}

export class AdminFranchiseQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search term, Ex: franchise name, code, phone, or email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by franchise status',
    enum: FranchiseStatus,
  })
  @IsOptional()
  @IsEnum(FranchiseStatus)
  status?: FranchiseStatus;

  @ApiPropertyOptional({
    description: 'Filter by franchise kyc-status',
    enum: KycStatus,
  })
  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @ApiPropertyOptional({
    description: 'Filter by franchise contact / owner email',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({
    description: "Filter by owner's email",
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  ownerEmail?: string;

  @ApiPropertyOptional({
    description: "Filter by owner's phone",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ownerPhone?: string;

  @ApiPropertyOptional({
    description: "Filter by owner's full name",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerFullName?: string;

  @ApiPropertyOptional({
    description: `State code, Ex: 'KA'`,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  @MaxLength(40)
  sortBy?: string = 'createdAt';
}
