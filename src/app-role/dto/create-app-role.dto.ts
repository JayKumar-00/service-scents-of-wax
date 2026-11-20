import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PermissionMatrixDto } from './permission-matrix.dto';

export class CreateAppRoleDto {
  @ApiProperty({ example: 'Inventory Manager' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  roleName!: string;

  @ApiPropertyOptional({ example: 'Handles product and order operations' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ type: [PermissionMatrixDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PermissionMatrixDto)
  permissions!: PermissionMatrixDto[];
}
