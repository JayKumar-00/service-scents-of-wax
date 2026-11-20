import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, SettlementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderSettlementService } from '../services/order-settlement.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrderSettlementCron {
  private readonly logger = new Logger(OrderSettlementCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementService: OrderSettlementService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM) // Run every day at 1:00 AM
  async processExpiredOrderSettlements() {
    this.logger.log('Starting daily order settlement check...');
    try {
      // Find all delivered orders that are missing either FRANCHISE or AFFILIATE settlements
      const orders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.DELIVERED,
          deliveredAt: { not: null },
          OR: [
            {
              settlements: {
                none: { type: SettlementType.FRANCHISE },
              },
            },
            {
              settlements: {
                none: { type: SettlementType.AFFILIATE },
              },
            },
          ],
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          settlements: true,
        },
      });

      this.logger.log(
        `Found ${orders.length} delivered orders pending settlement checks.`,
      );

      const defaultReturnWindowDays = this.configService.get<number>(
        'DEFAULT_RETURN_WINDOW_DAYS',
        30,
      );
      const now = new Date();

      for (const order of orders) {
        try {
          // 1. Calculate max return window across all items in the order
          let returnWindowDays = defaultReturnWindowDays;
          if (order.items && order.items.length > 0) {
            const windows = order.items
              .map((item) => item.product?.returnWindow)
              .filter((w): w is number => w !== null && w !== undefined);
            if (windows.length > 0) {
              returnWindowDays = Math.max(...windows);
            }
          }

          // 2. Check if the return window has closed
          const deliveredTime = new Date(order.deliveredAt!).getTime();
          const expiryTime =
            deliveredTime + returnWindowDays * 24 * 60 * 60 * 1000;

          if (now.getTime() >= expiryTime) {
            this.logger.log(
              `Order ${order.orderNumber} return window has expired. Processing settlements...`,
            );

            // Process Franchise Settlement
            const hasFranchiseSettlement = order.settlements.some(
              (s) => s.type === SettlementType.FRANCHISE,
            );
            if (!hasFranchiseSettlement) {
              try {
                await this.settlementService.settleFranchise(order.id);
                this.logger.log(
                  `Successfully completed franchise settlement for order ${order.orderNumber}`,
                );
              } catch (e: any) {
                this.logger.error(
                  `Franchise settlement failed for order ${order.orderNumber}: ${e.message}`,
                );
              }
            }

            // Process Affiliate Settlement
            const hasAffiliateSettlement = order.settlements.some(
              (s) => s.type === SettlementType.AFFILIATE,
            );
            if (!hasAffiliateSettlement) {
              try {
                await this.settlementService.settleAffiliate(order.id);
                this.logger.log(
                  `Successfully completed affiliate settlement for order ${order.orderNumber}`,
                );
              } catch (e: any) {
                this.logger.error(
                  `Affiliate settlement failed for order ${order.orderNumber}: ${e.message}`,
                );
              }
            }
          } else {
            const daysRemaining = (
              (expiryTime - now.getTime()) /
              (1000 * 60 * 60 * 24)
            ).toFixed(1);
            this.logger.debug(
              `Order ${order.orderNumber} return window has not expired yet. ${daysRemaining} days remaining.`,
            );
          }
        } catch (orderError: any) {
          this.logger.error(
            `Error processing settlement evaluation for order ${order.id}: ${orderError.message}`,
          );
        }
      }
    } catch (cronError: any) {
      this.logger.error(
        `Failed to process order settlements cron job: ${cronError.message}`,
      );
    }
  }
}
