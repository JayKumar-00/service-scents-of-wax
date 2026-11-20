import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PermissionAssignmentInput } from '../../common/types/rbac.types';
import { APP_ROLE_MODULE_VALUES } from 'src/staff-management/enums/module-name.enum';

export class RolePermissionPayloadDto implements PermissionAssignmentInput {
  @ApiProperty({ enum: APP_ROLE_MODULE_VALUES, example: 'orders' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @IsIn(APP_ROLE_MODULE_VALUES)
  moduleName!: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  canRead?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  canUpdate?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  canExport?: boolean;

  @ApiProperty({ example: 'OWN', required: false })
  @IsOptional()
  @IsString()
  scope?: 'ALL' | 'OWN' | 'ORG';
}

export class AssignRolePermissionsDto {
  @ApiProperty({ type: [RolePermissionPayloadDto] })
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => RolePermissionPayloadDto)
  permissions!: RolePermissionPayloadDto[];
}
