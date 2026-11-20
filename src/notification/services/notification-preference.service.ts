import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationChannel } from '../enums/notification-channel.enum';

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get notification preferences for a user
   * Returns default preferences if user has no preferences yet
   */
  async getPreferences(userId: string) {
    let preferences = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    // If no preferences exist, return defaults
    if (!preferences) {
      preferences = {
        id: 'default',
        userId,
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        orderUpdates: true,
        marketing: false,
      };
    }

    return preferences;
  }

  /**
   * Get enabled channels for a user based on preferences
   */
  async getEnabledChannels(userId: string): Promise<NotificationChannel[]> {
    const preferences = await this.getPreferences(userId);
    const channels: NotificationChannel[] = [NotificationChannel.IN_APP]; // Always in-app

    if (preferences.pushEnabled) {
      channels.push(NotificationChannel.PUSH);
    }
    if (preferences.emailEnabled) {
      channels.push(NotificationChannel.EMAIL);
    }
    if (preferences.smsEnabled) {
      channels.push(NotificationChannel.SMS);
    }

    return channels;
  }

  /**
   * Check if a notification type should be delivered to this user
   */
  async canDeliver(userId: string, type: string): Promise<boolean> {
    const preferences = await this.getPreferences(userId);

    // Map notification types to preferences
    if (type === 'MARKETING') {
      return preferences.marketing;
    }

    if (type === 'ORDER' || type === 'DELIVERY' || type === 'PAYMENT') {
      return preferences.orderUpdates;
    }

    // System, support, stock - always deliver if user exists
    return true;
  }

  /**
   * Create or update user notification preferences
   */
  async upsertPreferences(userId: string, data: any) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });
  }

  /**
   * Get users who want to receive a specific notification type
   */
  async getUsersForType(type: string, limit = 100) {
    const query: any = {};

    if (type === 'MARKETING') {
      query.marketing = true;
    } else if (type === 'ORDER' || type === 'DELIVERY' || type === 'PAYMENT') {
      query.orderUpdates = true;
    }

    return this.prisma.notificationPreference.findMany({
      where: query,
      take: limit,
      select: { userId: true },
    });
  }
}
