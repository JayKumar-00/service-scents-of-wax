import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  SettlementType,
  OrderSettlementStatus,
  Prisma,
  CreditTransactionEnum,
  DirectionEnum,
  PaymentModeEnum,
} from '@prisma/client';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class OrderSettlementService {
  private readonly logger = new Logger(OrderSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async settleFranchise(orderId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check: check if a settlement record already exists
      const existing = await tx.orderSettlement.findUnique({
        where: {
          orderId_type: {
            orderId,
            type: SettlementType.FRANCHISE,
          },
        },
      });

      if (existing) {
        this.logger.warn(
          `Franchise settlement already exists for order ${orderId}. Skipping.`,
        );
        return existing;
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const isCashOrCod =
        order.paymentMode === PaymentModeEnum.COD ||
        order.paymentMode === PaymentModeEnum.CASH;

      const isPickupOrWalkIn =
        order.saleType === 'Pickup' ||
        order.saleType === 'Walk-in' ||
        order.saleType === 'PICKUP' ||
        order.saleType === 'WALK_IN';

      const amount = (isCashOrCod && isPickupOrWalkIn)
        ? new Prisma.Decimal(0)
        : new Prisma.Decimal(order.franchisePaybleAmount ?? 0);

      // Create PENDING settlement record to lock the transaction
      const settlement = await tx.orderSettlement.create({
        data: {
          orderId,
          type: SettlementType.FRANCHISE,
          amount,
          status: OrderSettlementStatus.PENDING,
        },
      });

      try {
        let creditTransactionId: string | null = null;

        // If franchise payable amount is greater than 0, update their wallet balance
        if (amount.gt(0)) {
          // Fetch CreditAccount for franchise
          const creditAccount = await tx.creditAccount.findUnique({
            where: { franchiseId: order.franchiseId },
          });

          if (!creditAccount) {
            throw new Error(
              `Credit account not found for franchiseId: ${order.franchiseId}`,
            );
          }

          const balanceBefore = Number(creditAccount.walletBalance);
          const balanceAfter = balanceBefore + amount.toNumber();

          // Create CreditTransaction record
          const creditTx = await tx.creditTransaction.create({
            data: {
              accountId: creditAccount.id,
              franchiseId: order.franchiseId,
              type: CreditTransactionEnum.COMMISSION, // COMMISSION indicates order fulfillment profit
              direction: DirectionEnum.CREDIT,
              amount,
              balanceBefore,
              balanceAfter,
              description: `Order settlement earnings for order #${order.orderNumber}`,
              referenceId: order.id,
              referenceType: 'ORDER',
            },
          });

          creditTransactionId = creditTx.id;

          // Update CreditAccount wallet balance
          await tx.creditAccount.update({
            where: { id: creditAccount.id },
            data: {
              walletBalance: balanceAfter,
            },
          });
        }

        // Update settlement status to SETTLED
        return await tx.orderSettlement.update({
          where: { id: settlement.id },
          data: {
            status: OrderSettlementStatus.SETTLED,
            creditTransactionId,
            processedAt: new Date(),
          },
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to execute franchise settlement for order ${orderId}: ${error.message}`,
        );
        // Mark settlement as FAILED
        await tx.orderSettlement.update({
          where: { id: settlement.id },
          data: {
            status: OrderSettlementStatus.FAILED,
            errorReason: error.message,
          },
        });
        throw error;
      }
    });

    try {
      await this.redisService.clearCacheByPrefix('settlements:');
    } catch (e: any) {
      this.logger.error(`Failed to clear settlements cache: ${e.message}`);
    }

    return result;
  }

  async settleAffiliate(orderId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.orderSettlement.findUnique({
        where: {
          orderId_type: {
            orderId,
            type: SettlementType.AFFILIATE,
          },
        },
      });

      if (existing) {
        this.logger.warn(
          `Affiliate settlement already exists for order ${orderId}. Skipping.`,
        );
        return existing;
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Try to find the affiliate / referrer customer profile
      let affiliateCustomerId: string | null = null;

      if (order.referralCode) {
        const customer = await tx.customer.findFirst({
          where: { retentionSnapshot: { referralCode: order.referralCode } },
        });
        if (customer) {
          affiliateCustomerId = customer.id;
        }
      }

      // If no referralCode on order, check customer's registered referrer relationship
      if (!affiliateCustomerId && order.customerId) {
        const referral = await tx.referral.findUnique({
          where: { refereeId: order.customerId },
        });
        if (referral) {
          affiliateCustomerId = referral.referrerId;
        }
      }

      if (!affiliateCustomerId) {
        // No affiliate code or referral mapping exists, so we mark it as CANCELLED (no affiliate to credit)
        return await tx.orderSettlement.create({
          data: {
            orderId,
            type: SettlementType.AFFILIATE,
            amount: new Prisma.Decimal(0),
            status: OrderSettlementStatus.CANCELLED,
            errorReason: 'No affiliate referral associated with this order',
            processedAt: new Date(),
          },
        });
      }

      const commissionPercent = this.configService.get<number>(
        'AFFILIATE_COMMISSION_PERCENT',
        10,
      );
      const orderTotal = new Prisma.Decimal(order.total);
      const amount = orderTotal
        .mul(commissionPercent)
        .div(100)
        .toDecimalPlaces(2);

      const settlement = await tx.orderSettlement.create({
        data: {
          orderId,
          type: SettlementType.AFFILIATE,
          amount,
          status: OrderSettlementStatus.PENDING,
          affiliateCustomerId,
        },
      });

      try {
        // Mark as SETTLED
        return await tx.orderSettlement.update({
          where: { id: settlement.id },
          data: {
            status: OrderSettlementStatus.SETTLED,
            processedAt: new Date(),
          },
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to execute affiliate settlement for order ${orderId}: ${error.message}`,
        );
        await tx.orderSettlement.update({
          where: { id: settlement.id },
          data: {
            status: OrderSettlementStatus.FAILED,
            errorReason: error.message,
          },
        });
        throw error;
      }
    });

    try {
      await this.redisService.clearCacheByPrefix('settlements:');
    } catch (e: any) {
      this.logger.error(`Failed to clear settlements cache: ${e.message}`);
    }

    return result;
  }
}
