import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Notification title', example: 'Order Shipped' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Notification body',
    example: 'Your order #1234 has been shipped.',
  })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.ORDER,
  })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type!: NotificationType;

  @ApiProperty({
    description: 'Additional metadata for the notification',
    example: { orderId: '1234', trackingNumber: 'TRACK123' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Preferred channel for the notification',
    enum: NotificationChannel,
    example: NotificationChannel.IN_APP,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Enable or disable email notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable push notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable SMS notifications',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable order related notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  orderUpdates?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable marketing notifications',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  marketing?: boolean;
}

/**
 * For sending notifications to specific users by ID
 */
export class SendToUserDto extends CreateNotificationDto {
  @ApiProperty({
    description: 'User ID to send the notification to',
    example: 'user_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

/**
 * For sending notifications to franchise owner(s)
 */
export class SendToFranchiseOwnerDto extends CreateNotificationDto {
  @ApiProperty({
    description: 'Franchise ID to target',
    example: 'franchise_123',
  })
  @IsString()
  @IsNotEmpty()
  franchiseId!: string;
}

/**
 * For sending notifications to franchise staff
 */
export class SendToFranchiseStaffDto extends CreateNotificationDto {
  @ApiProperty({
    description: 'Franchise ID to target',
    example: 'franchise_123',
  })
  @IsString()
  @IsNotEmpty()
  franchiseId!: string;
}

/**
 * For sending notifications to all users in a franchise
 */
export class SendToFranchiseAllDto extends CreateNotificationDto {
  @ApiProperty({
    description: 'Franchise ID to target',
    example: 'franchise_123',
  })
  @IsString()
  @IsNotEmpty()
  franchiseId!: string;
}

/**
 * For sending to all super admins
 */
export class SendToSuperAdminsDto extends CreateNotificationDto {}

/**
 * For franchise users sending a notification to all superadmins
 */
export class SendToAdminsDto extends CreateNotificationDto {}

/**
 * For sending to all franchises (broadcast)
 */
export class SendToAllFranchisesDto extends CreateNotificationDto {}
