import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum FirebaseAuthProvider {
  GOOGLE = 'google.com',
  FACEBOOK = 'facebook.com',
  APPLE = 'apple.com',
}

export class FirebaseAuthDto {
  @ApiProperty({
    description: 'Firebase ID token from client SDK',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..._',
  })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@gmail.com',
  })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({
    description: 'User name',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsString()
  @IsOptional()
  avtar?: string;

  @ApiPropertyOptional({
    description: 'Auth provider',
    example: 'google.com',
    enum: FirebaseAuthProvider,
  })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({
    description: 'Firebase refresh token from client SDK',
    example: '...',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class FirebaseRefreshDto {
  @ApiProperty({
    description: 'Firebase refresh token',
    example: '...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
