import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateAppRoleDto } from './create-app-role.dto';
import { PermissionMatrixDto } from './permission-matrix.dto';

export enum BooleanEnum {
  TRUE = 'true',
  FALSE = 'false',
}

export class UpdateAppRoleDto extends PartialType(CreateAppRoleDto) {
  @ApiPropertyOptional({ example: 'Inventory Lead' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  roleName?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [PermissionMatrixDto],
    description:
      'Optional: upsert role permissions by module. Existing modules are updated, new modules are added.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionMatrixDto)
  permissions?: PermissionMatrixDto[];
}

export class SetAppRoleActiveDto {
  @ApiPropertyOptional({ enum: BooleanEnum, example: BooleanEnum.TRUE })
  @IsEnum(BooleanEnum)
  isActive!: BooleanEnum;
}
