import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { RoleBasedNotificationService } from '../services/role-based-notification.service';
import { NotificationType } from '../enums/notification-type.enum';

@Injectable()
export class LowStockAlertCron {
  private readonly logger = new Logger(LowStockAlertCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly roleBasedService: RoleBasedNotificationService,
  ) {}

  /**
   * Scans all inventory hourly to detect products that newly fall below their low-stock thresholds.
   * Send alerts only once when crossing the threshold downwards.
   */
  @Cron('0 0 * * * *') // Run hourly
  async scanLowStock() {
    this.logger.log('Starting scheduled stateful scan for low stock items...');
    try {
      await this.runScan(false);
      this.logger.log('Finished scheduled low stock stateful scan.');
    } catch (error: any) {
      this.logger.error(`Error during low stock cron scan: ${error.message}`, error.stack);
    }
  }

  /**
   * Main scan function, supporting normal stateful mode or force mode.
   */
  async runScan(force: boolean = false): Promise<{ franchiseAlertsSent: number; adminAlertsSent: number }> {
    let franchiseAlertsSent = 0;
    let adminAlertsSent = 0;

    // --- 1. SCAN FRANCHISE STOCKS ---
    const franchiseStocks = await this.prisma.franchiseStock.findMany({
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    const franchiseGroups = new Map<string, Array<any>>();
    const franchiseReplenishedKeys: string[] = [];

    for (const fs of franchiseStocks) {
      const available = Math.max(0, fs.quantity - fs.reserved);
      const redisKey = `low-stock-alert:franchise:${fs.franchiseId}:${fs.productId}:${fs.variantId}`;

      if (available <= fs.lowStockThreshold) {
        const isNotified = !force && (await this.redisService.redisClient.get(redisKey)) === 'true';
        if (!isNotified) {
          if (!franchiseGroups.has(fs.franchiseId)) {
            franchiseGroups.set(fs.franchiseId, []);
          }
          franchiseGroups.get(fs.franchiseId)!.push({
            ...fs,
            available,
            redisKey,
          });
        }
      } else {
        // Stock is replenished, track key to clear it
        franchiseReplenishedKeys.push(redisKey);
      }
    }

    // Clear alert state for replenished franchise items
    if (franchiseReplenishedKeys.length > 0) {
      this.logger.debug(`Clearing alert state for ${franchiseReplenishedKeys.length} replenished franchise items`);
      await this.redisService.redisClient.del(...franchiseReplenishedKeys);
    }

    // Send notifications for newly low franchise items
    for (const [franchiseId, items] of franchiseGroups.entries()) {
      try {
        const title = `Low Stock Alert: ${items.length} product${items.length > 1 ? 's' : ''} need reordering`;
        const body = items
          .map((item) => `- ${item.product.name} (Available: ${item.available}, Threshold: ${item.lowStockThreshold})`)
          .join('\n');

        const metadata = {
          lowStockCount: items.length,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.product.name,
            available: item.available,
            lowStockThreshold: item.lowStockThreshold,
          })),
        };

        // Notify Owner
        await this.roleBasedService.notifyFranchiseOwner(
          franchiseId,
          title,
          body,
          NotificationType.LOW_STOCK,
          metadata,
        );

        // Notify Staff
        await this.roleBasedService.notifyFranchiseStaff(
          franchiseId,
          title,
          body,
          NotificationType.LOW_STOCK,
          { lowStockCount: items.length },
        );

        // Mark items as notified in Redis
        for (const item of items) {
          await this.redisService.redisClient.set(item.redisKey, 'true');
        }

        franchiseAlertsSent++;
      } catch (err: any) {
        this.logger.error(`Failed to notify low stock for franchise ${franchiseId}: ${err.message}`, err.stack);
      }
    }

    // --- 2. SCAN WAREHOUSE STOCKS ---
    const warehouseStocks = await this.prisma.warehouseStock.findMany({
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    const newLowStockWarehouseItems: Array<any> = [];
    const warehouseReplenishedKeys: string[] = [];

    for (const ws of warehouseStocks) {
      const available = Math.max(0, ws.quantity - ws.reserved);
      const redisKey = `low-stock-alert:warehouse:${ws.productId}`;

      if (available <= ws.lowStockThreshold) {
        const isNotified = !force && (await this.redisService.redisClient.get(redisKey)) === 'true';
        if (!isNotified) {
          newLowStockWarehouseItems.push({
            ...ws,
            available,
            redisKey,
          });
        }
      } else {
        // Stock is replenished, track key to clear it
        warehouseReplenishedKeys.push(redisKey);
      }
    }

    // Clear alert state for replenished warehouse items
    if (warehouseReplenishedKeys.length > 0) {
      this.logger.debug(`Clearing alert state for ${warehouseReplenishedKeys.length} replenished warehouse items`);
      await this.redisService.redisClient.del(...warehouseReplenishedKeys);
    }

    // Send single aggregated notification to Superadmins if any new warehouse items are low
    if (newLowStockWarehouseItems.length > 0) {
      try {
        const title = `Warehouse Low Stock Alert: ${newLowStockWarehouseItems.length} product${newLowStockWarehouseItems.length > 1 ? 's' : ''} running low`;
        const body = newLowStockWarehouseItems
          .map((item) => `- ${item.product.name} (Available: ${item.available}, Threshold: ${item.lowStockThreshold})`)
          .join('\n');

        const metadata = {
          lowStockCount: newLowStockWarehouseItems.length,
          items: newLowStockWarehouseItems.map((item) => ({
            productId: item.productId,
            name: item.product.name,
            available: item.available,
            lowStockThreshold: item.lowStockThreshold,
          })),
        };

        await this.roleBasedService.notifySuperAdmins(
          title,
          body,
          metadata,
        );

        // Mark items as notified in Redis
        for (const item of newLowStockWarehouseItems) {
          await this.redisService.redisClient.set(item.redisKey, 'true');
        }

        adminAlertsSent++;
      } catch (err: any) {
        this.logger.error(`Failed to send warehouse low stock notification to superadmins: ${err.message}`, err.stack);
      }
    }

    return { franchiseAlertsSent, adminAlertsSent };
  }
}
