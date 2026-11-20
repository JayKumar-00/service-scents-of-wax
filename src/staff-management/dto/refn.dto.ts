// import { Type } from 'class-transformer';
// import {
//   IsArray,
//   IsEnum,
//   IsUUID,
//   IsNotEmpty,
//   IsOptional,
//   IsString,
//   ValidateNested,
//   ArrayNotEmpty,
//   IsBoolean,
// } from 'class-validator';
// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// import { SuperadminModule, SuperadminOperations } from 'src/common';

// export class PermissionMatrixDto {
//   @ApiProperty({ enum: SuperadminModule, example: SuperadminModule.MENU })
//   @IsEnum(SuperadminModule)
//   module: SuperadminModule;

//   @ApiPropertyOptional({
//     enum: ['ALL', 'OWN', 'ORG'],
//     example: 'ALL',
//     default: 'ALL',
//   })
//   @IsOptional()
//   @IsEnum(['ALL', 'OWN', 'ORG'])
//   scope?: 'ALL' | 'OWN' | 'ORG';

//   @ApiProperty({
//     enum: SuperadminOperations,
//     isArray: true,
//     example: [SuperadminOperations.C, SuperadminOperations.R],
//   })
//   @IsArray()
//   @ArrayNotEmpty()
//   @IsEnum(SuperadminOperations, { each: true })
//   operations!: SuperadminOperations[];
// }

// export class CreateSuperadminRoleDto {
//   @ApiProperty({ example: 'Operations Manager' })
//   @IsString()
//   @IsNotEmpty()
//   name!: string;

//   @ApiPropertyOptional({ example: 'Can manage menu and stock modules' })
//   @IsOptional()
//   @IsString()
//   description?: string;

//   @ApiProperty({ type: [PermissionMatrixDto] })
//   @IsArray()
//   @ArrayNotEmpty()
//   @ValidateNested({ each: true })
//   @Type(() => PermissionMatrixDto)
//   permissionMatrix!: PermissionMatrixDto[];

//   @ApiPropertyOptional({
//     enum: ['active', 'inactive'],
//     example: 'active',
//     default: 'active',
//   })
//   @IsOptional()
//   @IsEnum(['active', 'inactive'])
//   status?: 'active' | 'inactive';

//   @ApiPropertyOptional({ example: false, default: false })
//   @IsOptional()
//   @IsBoolean()
//   isDeleted?: boolean;
// }
