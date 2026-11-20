import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationQueue } from '../queues/notification.queue';
import { NotificationType } from '../enums/notification-type.enum';
import { Role } from '@prisma/client';

@Injectable()
export class RoleBasedNotificationService {
  private readonly logger = new Logger(RoleBasedNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationQueue: NotificationQueue,
  ) {}

  /**
   * Send notification to all SUPERADMIN users
   * For: System alerts, KYC approvals, financial reports, anomalies
   */
  async notifySuperAdmins(title: string, body: string, metadata?: any) {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: Role.SUPERADMIN },
      select: { id: true },
    });

    this.logger.log(`Notifying ${superAdmins.length} super admins`);

    const notifications = superAdmins.map((admin) => ({
      userId: admin.id,
      title,
      body,
      type: NotificationType.SYSTEM,
      metadata,
    }));

    for (const notification of notifications) {
      await this.notificationQueue.add(notification);
    }

    return notifications.length;
  }

  /**
   * Send notification to franchise owner
   * For: Stock requests, orders, payments, KYC status
   */
  async notifyFranchiseOwner(
    franchiseId: string,
    title: string,
    body: string,
    type: NotificationType,
    metadata?: any,
  ) {
    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      include: {
        users: {
          where: { role: Role.FRANCHISE_OWNER },
          select: { id: true },
        },
      },
    });

    if (!franchise || franchise.users.length === 0) {
      this.logger.warn(`No franchise owner found for franchise ${franchiseId}`);
      return 0;
    }

    const notifications = franchise.users.map((user) => ({
      userId: user.id,
      title,
      body,
      type,
      metadata: { franchiseId, ...metadata },
    }));

    for (const notification of notifications) {
      await this.notificationQueue.add(notification);
    }

    return notifications.length;
  }

  /**
   * Send notification to all staff in a franchise
   * For: Daily operations, inventory updates, customer issues
   */
  async notifyFranchiseStaff(
    franchiseId: string,
    title: string,
    body: string,
    type: NotificationType,
    metadata?: any,
  ) {
    const staff = await this.prisma.user.findMany({
      where: {
        franchiseId,
        role: Role.FRANCHISE_STAFF,
      },
      select: { id: true },
    });

    if (staff.length === 0) {
      this.logger.warn(`No staff found for franchise ${franchiseId}`);
      return 0;
    }

    const notifications = staff.map((user) => ({
      userId: user.id,
      title,
      body,
      type,
      metadata: { franchiseId, ...metadata },
    }));

    for (const notification of notifications) {
      await this.notificationQueue.add(notification);
    }

    return notifications.length;
  }

  /**
   * Send notification to both owner + staff of a franchise
   * For: Important announcements, urgent issues
   */
  async notifyFranchiseAll(
    franchiseId: string,
    title: string,
    body: string,
    type: NotificationType,
    metadata?: any,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        franchiseId,
        role: { in: [Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF] },
      },
      select: { id: true },
    });

    if (users.length === 0) {
      this.logger.warn(`No users found for franchise ${franchiseId}`);
      return 0;
    }

    const notifications = users.map((user) => ({
      userId: user.id,
      title,
      body,
      type,
      metadata: { franchiseId, ...metadata },
    }));

    for (const notification of notifications) {
      await this.notificationQueue.add(notification);
    }

    return notifications.length;
  }

  /**
   * Send notification to all franchises (broadcast)
   * For: Policy changes, system-wide announcements
   */
  async notifyAllFranchises(
    title: string,
    body: string,
    type: NotificationType,
    metadata?: any,
  ) {
    const franchiseUsers = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF] },
      },
      select: { id: true },
    });

    this.logger.log(`Broadcasting to ${franchiseUsers.length} franchise users`);

    const notifications = franchiseUsers.map((user) => ({
      userId: user.id,
      title,
      body,
      type,
      metadata,
    }));

    for (const notification of notifications) {
      await this.notificationQueue.add(notification);
    }

    return notifications.length;
  }

  /**
   * Send to customer
   */
  async notifyCustomer(
    customerId: string,
    title: string,
    body: string,
    type: NotificationType,
    metadata?: any,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { userId: true },
    });

    if (!customer) {
      this.logger.warn(`Customer not found: ${customerId}`);
      return 0;
    }

    await this.notificationQueue.add({
      userId: customer.userId,
      title,
      body,
      type,
      metadata: { customerId, ...metadata },
    });

    return 1;
  }

  /**
   * Send notification to all active customers
   */
  async notifyAllCustomers(
    title: string,
    body: string,
    type: NotificationType,
    metadata?: any,
  ) {
    const customers = await this.prisma.customer.findMany({
      select: { id: true, userId: true },
    });

    this.logger.log(
      `Broadcasting notification to ${customers.length} customers`,
    );

    for (const customer of customers) {
      await this.notificationQueue.add({
        userId: customer.userId,
        title,
        body,
        type,
        metadata: { customerId: customer.id, ...metadata },
      });
    }

    return customers.length;
  }
}
