import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import {
  APP_ROLE_MODULE_VALUES,
  PermissionAction,
} from 'src/staff-management/enums/module-name.enum';

export enum PermissionScopeEnum {
  ALL = 'ALL',
  OWN = 'OWN',
  ORG = 'ORG',
}

export class PermissionMatrixDto {
  @ApiProperty({ enum: APP_ROLE_MODULE_VALUES, example: 'products' })
  @IsString()
  @IsNotEmpty()
  @IsIn(APP_ROLE_MODULE_VALUES)
  moduleName!: string;

  @ApiProperty({
    enum: PermissionAction,
    isArray: true,
    example: [PermissionAction.READ, PermissionAction.UPDATE],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(PermissionAction, { each: true })
  @IsNotEmpty({ each: true })
  actions!: PermissionAction[];

  @ApiProperty({
    enum: PermissionScopeEnum,
    required: false,
    example: PermissionScopeEnum.OWN,
  })
  @IsOptional()
  @IsEnum(PermissionScopeEnum)
  scope?: PermissionScopeEnum;

  @ApiProperty({
    required: false,
    example: 'old_products',
    description: 'Optional: The old module name to be replaced by moduleName.',
  })
  @IsOptional()
  @IsString()
  oldModuleName?: string;
}
