import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class StaffQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search by email, role name, or owner email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by franchise ID' })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({ description: 'Filter by franchise owner user ID' })
  @IsOptional()
  @IsString()
  franchiseOwnerId?: string;

  @ApiPropertyOptional({ description: 'Filter by AppRole ID' })
  @IsOptional()
  @IsString()
  roleId?: string;
}

export class AdminStaffQueryDto extends StaffQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by role',
    enum: [Role.ADMIN_STAFF, Role.FRANCHISE_STAFF],
  })
  @IsOptional()
  @IsEnum([Role.ADMIN_STAFF, Role.FRANCHISE_STAFF])
  role?: Role;
}
