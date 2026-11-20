import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RefundStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReturnRefundService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Processes the refund for a return request, saving the transaction reference.
   * Runs inside a transaction context (tx).
   */
  async processRefund(
    tx: any,
    returnRequestId: string,
    amount: Prisma.Decimal | number,
    referenceNumber?: string,
    conversionRate?: number | Prisma.Decimal,
    loyaltyPointsCredited?: number,
    processedByUserId?: string,
  ) {
    return tx.returnRefund.create({
      data: {
        returnRequestId,
        amount: new Prisma.Decimal(amount),
        status: RefundStatus.SUCCESS,
        referenceNumber: referenceNumber ?? null,
        processedAt: new Date(),
        conversionRate: conversionRate
          ? new Prisma.Decimal(conversionRate)
          : null,
        loyaltyPointsCredited: loyaltyPointsCredited ?? null,
        processedByUserId: processedByUserId ?? null,
      },
    });
  }
}
