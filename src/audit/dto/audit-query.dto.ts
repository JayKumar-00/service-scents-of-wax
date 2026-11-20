import { ApiPropertyOptional } from '@nestjs/swagger';
import { QueryDto } from 'src/common/dto/query.dto';
import {
  AdminResourceEnum,
  FranchiseResourceEnum,
} from '../enum/resource.enum';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { ActionEnum } from '../enum/action.enum';

export enum SortBy {
  CREATED_AT = 'createdAt',
  ACTION = 'action',
  RESOURCE = 'resource',
}

export class AuditQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search term to filter logs by email fields, Ex: "created"`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by resource name, Ex: "User", "Order", etc.',
    enum: AdminResourceEnum,
  })
  @IsOptional()
  @IsEnum(AdminResourceEnum)
  resource?: AdminResourceEnum;

  @ApiPropertyOptional({
    description: `Filter by action type, Ex: ${Object.values(ActionEnum).join(' | ')}`,
    enum: ActionEnum,
  })
  @IsOptional()
  @IsEnum(ActionEnum)
  action?: ActionEnum;

  @ApiPropertyOptional({
    description: `Filter by user email, Ex: ${Object.values(Role).join(' | ')}`,
    enum: Role,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}

export class FranchiseAuditQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search term to filter logs by email fields, Ex: "created"`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by resource name, Ex: "User", "Order", etc.',
    enum: FranchiseResourceEnum,
  })
  @IsOptional()
  @IsEnum(FranchiseResourceEnum)
  resource?: FranchiseResourceEnum;

  @ApiPropertyOptional({
    description: `Filter by action type, Ex: ${Object.values(ActionEnum).join(' | ')}`,
    enum: ActionEnum,
  })
  @IsOptional()
  @IsEnum(ActionEnum)
  action?: ActionEnum;

  @ApiPropertyOptional({
    description: `Filter by user email, Ex: ${Object.values([Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF]).join(' | ')}`,
    enum: [Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF],
  })
  @IsOptional()
  @IsEnum([Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF])
  role?: Role;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
