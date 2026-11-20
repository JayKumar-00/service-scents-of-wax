import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum AdminUserSortBy {
  CREATED_AT = 'createdAt',
  EMAIL = 'email',
}

export class AdminUserQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search term, Ex: email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by user role',
    enum: Role,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Filter by franchise ID',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by email (exact match, case-insensitive)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: AdminUserSortBy,
    default: AdminUserSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminUserSortBy)
  @MaxLength(40)
  sortBy?: string = 'createdAt';
}
