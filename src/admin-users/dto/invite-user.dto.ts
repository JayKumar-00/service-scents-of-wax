import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'user@gmail.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Password for the user to login. Minimum 8 characters.',
    example: 'password@123',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({
    description: 'Role to assign to the user',
    enum: Role,
    example: Role.FRANCHISE_STAFF,
  })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;

  @ApiPropertyOptional({
    description:
      'Franchise ID to assign to the user. Required if role is FRANCHISE_STAFF or FRANCHISE_ADMIN.',
    example: 'fran-cmopany-123',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string | null;
}
