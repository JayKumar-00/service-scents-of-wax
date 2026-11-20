import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeviceTokenDto {
  @ApiProperty({ description: 'FCM or APNS Device Token' })
  @IsNotEmpty()
  @IsString()
  token!: string;

  @ApiProperty({
    description: 'OS platform: ios, android, web',
    required: false,
  })
  @IsOptional()
  @IsString()
  os?: string;
}

export class RemoveDeviceTokenDto {
  @ApiProperty({ description: 'FCM or APNS Device Token to remove' })
  @IsNotEmpty()
  @IsString()
  token!: string;
}
