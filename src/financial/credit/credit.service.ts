import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/audit/audit.service';
import { ApplyCreditDto } from './dto/apply-credit.dto';
import { CreditPaymentDto } from './dto/credit-payment.dto';
import { CreditTransactionQueryDto } from './dto/credit-transaction-query.dto';
import { CreditStatusDto } from './dto/credit-status.dto';
import { CreditTransactionEnum } from '@prisma/client';
import { CreditEventEmitter } from './events/credit.event-emitter';
import { CreditSummaryQueryDto } from './dto/credit-summary-query.dto';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildPrismaSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import {
  buildPrismaDateRangeFilter,
  buildPrismaPriceRangeFilter,
} from 'src/products/utils/range-filter.util';
import { AdjustCreditLimitDto } from './dto/adjust-credit.dto';
import { Prisma } from '@prisma/client';
import { addTotalCreditAmount } from 'src/common/utils/credit-serializer.util';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@Injectable()
export class CreditService {
  constructor(
    private prisma: PrismaService,
    private creditEventEmitter: CreditEventEmitter,
    private readonly audit: AuditService,
  ) {}

  private buildCreditSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ) => buildPrismaSortOrder(sortBy, order);

  async applyCredit(dto: ApplyCreditDto, actorUserId?: string, ip?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.findUnique({
        where: { franchiseId: dto.franchiseId },
      });

      if (!account) {
        throw new NotFoundException('Credit account not found');
      }

      const maxAllowed = Number(account.totalCredit);

      if (Number(account.usedCredit) + dto.amount > maxAllowed) {
        throw new Error('Credit limit exceeded');
      }

      const before = Number(account.usedCredit);
      const after = before + dto.amount;

      await tx.creditTransaction.create({
        data: {
          franchiseId: dto.franchiseId,
          accountId: account.id,
          type: 'ORDER',
          amount: dto.amount,
          direction: 'DEBIT',
          balanceBefore: before,
          balanceAfter: after,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          description: dto.description,
        },
      });

      await tx.creditAccount.update({
        where: { id: account.id },
        data: {
          usedCredit: after,
          availableCredit: Number(account.totalCredit) - after,
        },
      });

      return { success: true, accountId: account.id };
    });

    fireAndForget(
      this.audit.log({
        userId: actorUserId ?? dto.franchiseId, // Default to franchise owner ID if system-triggered
        action: 'CREDIT_APPLY_CREATE',
        resource: 'CREDIT_ACCOUNT',
        resourceId: result.accountId,
        metadata: { franchiseId: dto.franchiseId, applied: { ...dto } },
        ip,
      }),
      'CREDIT_APPLY',
    );

    return { success: result.success };
  }

  async adjustCreditLimit(
    dto: AdjustCreditLimitDto,
    actorUserId?: string,
    ip?: string,
  ) {
    const { franchiseId, delta, reason } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.findUnique({
        where: { franchiseId },
      });

      if (!account) {
        throw new NotFoundException('Credit account not found');
      }

      const beforeLimit = Number(account.totalCredit);
      const newLimit = beforeLimit + delta;

      const usedCredit = Number(account.usedCredit);

      // 🚨 safety check (important when decreasing limit)
      if (newLimit < usedCredit) {
        throw new BadRequestException(
          'Cannot reduce credit limit below used credit',
        );
      }

      const availableCredit = newLimit - usedCredit;

      const updated = await tx.creditAccount.update({
        where: { id: account.id },
        data: {
          totalCredit: newLimit,
          availableCredit,
        },
      });

      await tx.creditTransaction.create({
        data: {
          franchiseId,
          accountId: account.id,
          type: CreditTransactionEnum.ADJUSTMENT,
          amount: Math.abs(delta),
          direction: delta > 0 ? 'CREDIT' : 'DEBIT',
          balanceBefore: beforeLimit,
          balanceAfter: newLimit,
          description: reason ?? 'Credit limit adjusted',
        },
      });

      return { updated, accountId: account.id };
    });

    fireAndForget(
      this.audit.log({
        userId: actorUserId ?? franchiseId,
        action: 'CREDIT_LIMIT_ADJUST_UPDATE',
        resource: 'CREDIT_ACCOUNT',
        resourceId: result.accountId,
        metadata: { franchiseId, delta, reason, updated: result.updated },
        ip,
      }),
      'CREDIT_LIMIT_ADJUST_UPDATE',
    );

    return addTotalCreditAmount(result.updated);
  }

  // Payment received
  async recordPayment(
    franchiseId: string,
    dto: CreditPaymentDto,
    actorUserId?: string,
    ip?: string,
  ) {
    // 🔐 Generate unique referenceId if not provided
    const referenceId =
      dto.referenceId ||
      `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 🔐 Idempotency check - prevent duplicate payments with same referenceId
    const existingPayment = await this.prisma.creditTransaction.findFirst({
      where: {
        franchiseId,
        referenceId,
        type: 'PAYMENT',
      },
    });

    if (existingPayment) {
      throw new BadRequestException(
        `Payment with referenceId ${referenceId} already exists`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.findUnique({
        where: { franchiseId },
      });

      if (!account) {
        throw new NotFoundException('Credit account not found');
      }

      const before = Number(account.usedCredit);
      const after = Math.max(0, before - dto.amount);

      const transaction = await tx.creditTransaction.create({
        data: {
          franchiseId,
          accountId: account.id,
          type: 'PAYMENT',
          amount: dto.amount,
          direction: 'CREDIT',
          balanceBefore: before,
          balanceAfter: after,
          referenceType: 'PAYMENT',
          referenceId,
          description: dto.description,
        },
      });

      await tx.creditAccount.update({
        where: { id: account.id },
        data: {
          usedCredit: after,
          availableCredit: Number(account.totalCredit) - after,
        },
      });

      return { transaction, accountId: account.id };
    });

    // Emit payment event to queue (with guaranteed referenceId)
    await this.creditEventEmitter.payment(franchiseId, dto.amount, referenceId);

    fireAndForget(
      this.audit.log({
        userId: actorUserId ?? franchiseId,
        action: 'CREDIT_RECORD_PAYMENT_UPDATE',
        resource: 'CREDIT_ACCOUNT',
        resourceId: result.accountId,
        metadata: { franchiseId, amount: dto.amount, referenceId },
        ip,
      }),
      'CREDIT_RECORD_PAYMENT',
    );

    return result.transaction;
  }

  // Summary
  async getSummary(query: CreditSummaryQueryDto) {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
          OR: [
            {
              franchise: {
                ownerFullName: { contains: search, mode: 'insensitive' },
                businessName: { contains: search, mode: 'insensitive' },
                code: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.franchiseId) {
      clauses.push({ franchise: { id: q.franchiseId } });
    }

    if (query.fromDate || q.lastDate) {
      const createdAt = buildPrismaDateRangeFilter({
        fromDate: q.fromDate,
        toDate: q.lastDate,
      });
      if (createdAt) {
        clauses.push({ createdAt });
      }
    }
    if (query.minCredit || query.maxCredit) {
      const totalCredit = buildPrismaPriceRangeFilter({
        minPrice: q.minCredit,
        maxPrice: q.maxCredit,
      });

      if (totalCredit) {
        clauses.push({ totalCredit });
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildCreditSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.creditAccount as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        franchise: {
          select: {
            id: true,
            code: true,
            ownerFullName: true,
            businessName: true,
          },
        },
      },
    });

    // paged.data = paged.data.map((p: any) =>
    //   this.mapProductResponse(this.applyAwsPrefixToProduct(p)),
    // );

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return addTotalCreditAmount(result);
  }

  // History
  async getTransactions(query: CreditTransactionQueryDto) {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
          OR: [
            {
              franchise: {
                ownerFullName: { contains: search, mode: 'insensitive' },
                businessName: { contains: search, mode: 'insensitive' },
                code: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.franchiseId) {
      clauses.push({ franchise: { id: q.franchiseId } });
    }

    if (query.accountId) {
      clauses.push({ accountId: q.accountId });
    }

    if (query.type) {
      clauses.push({
        OR: [
          {
            type: q.type,
            referenceType: q.type,
          },
        ],
      });
    }

    if (query.direction) {
      clauses.push({ direction: q.direction });
    }

    if (query.referenceType) {
      clauses.push({ referenceType: q.referenceType });
    }

    if (query.fromDate || q.lastDate) {
      const createdAt = buildPrismaDateRangeFilter({
        fromDate: q.fromDate,
        toDate: q.lastDate,
      });
      if (createdAt) {
        clauses.push({ createdAt });
      }
    }
    if (query.minAmount || query.maxAmount) {
      const amount = buildPrismaPriceRangeFilter({
        minPrice: q.minAmount,
        maxPrice: q.maxAmount,
      });

      if (amount) {
        clauses.push({ amount });
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildCreditSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.creditTransaction as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        franchise: {
          select: {
            id: true,
            code: true,
            ownerFullName: true,
            businessName: true,
          },
        },
      },
    });

    // paged.data = paged.data.map((p: any) =>
    //   this.mapProductResponse(this.applyAwsPrefixToProduct(p)),
    // );

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;

    // return this.prisma.creditTransaction.findMany({
    //   where: {
    //     franchiseId: query.franchiseId,
    //     createdAt: {
    //       gte: query.fromDate,
    //       lte: query.lastDate,
    //     },
    //   },
    //   orderBy: { createdAt: 'desc' },
    //   take: query.limit ?? 50,
    // });
  }

  async setStatus(
    franchiseId: string,
    actorUserId: string,
    dto: CreditStatusDto,
    ip?: string,
  ) {
    const account = await this.prisma.creditAccount.findUnique({
      where: { franchiseId },
    });

    if (!account) {
      throw new NotFoundException('Credit account not found');
    }

    if (account.status === dto.status) {
      throw new BadRequestException(
        `Account is already in status ${dto.status}`,
      );
    }

    const updated = await this.prisma.creditAccount.update({
      where: { franchiseId },
      data: {
        status: dto.status,
        ...(dto.reason
          ? {
              freezeReason: dto.reason,
              frozenAt: new Date(),
              frozenBy: actorUserId,
            }
          : { frozenAt: null, frozenBy: null, freezeReason: null }),
      },
    });

    fireAndForget(
      this.audit.log({
        userId: actorUserId,
        action: 'CREDIT_SET_STATUS_UPDATE',
        resource: 'CREDIT_ACCOUNT',
        resourceId: account.id,
        metadata: {
          franchiseId,
          status: dto.status,
          reason: dto.reason,
          updated: updated,
        },
        ip,
      }),
      'CREDIT_SET_STATUS',
    );

    return addTotalCreditAmount(updated);
  }

  // ====== AUTOMATION CONTROLS ======

  async updateAutomation(
    user: JwtUser,
    franchiseId: string,
    updates: any,
    ip: string,
  ) {
    const account = await this.prisma.creditAccount.findUnique({
      where: { franchiseId },
    });

    if (!account) {
      throw new NotFoundException('Credit account not found');
    }

    const data: any = {};

    if (updates.autoPenaltyEnabled !== undefined) {
      data.autoPenaltyEnabled = updates.autoPenaltyEnabled;
    }

    if (updates.autoCreditIncreaseEnabled !== undefined) {
      data.autoCreditIncreaseEnabled = updates.autoCreditIncreaseEnabled;
    }

    if (updates.autoReminderEnabled !== undefined) {
      data.autoReminderEnabled = updates.autoReminderEnabled;
    }

    if (updates.automationPausedUntil !== undefined) {
      data.automationPausedUntil = updates.automationPausedUntil
        ? new Date(updates.automationPausedUntil)
        : null;
    }

    const updated = await this.prisma.creditAccount.update({
      where: { franchiseId },
      data,
    } as any);

    fireAndForget(
      this.audit.log({
        userId: user.sub, // Default to franchise owner ID if system-triggered
        action: 'CREDIT_ACCOUNT_AUTOMATION_UPDATE',
        resource: 'CREDIT_ACCOUNT',
        resourceId: updated.id,
        metadata: { franchiseId, updated },
        ip,
      }),
      'CREDIT_ACCOUNT',
    );

    return addTotalCreditAmount(updated);
  }

  async getAutomationStatus(franchiseId: string) {
    const account = await this.prisma.creditAccount.findUnique({
      where: { franchiseId },
    });

    if (!account) {
      throw new NotFoundException('Credit account not found');
    }

    return {
      autoPenaltyEnabled: (account as any).autoPenaltyEnabled ?? true,
      autoCreditIncreaseEnabled:
        (account as any).autoCreditIncreaseEnabled ?? true,
      autoReminderEnabled: (account as any).autoReminderEnabled ?? true,
      automationPausedUntil: (account as any).automationPausedUntil,
      isPaused:
        (account as any).automationPausedUntil &&
        (account as any).automationPausedUntil > new Date(),
    };
  }

  async pauseAutomation(
    user: JwtUser,
    franchiseId: string,
    pauseUntil: Date,
    ip: string,
  ) {
    const account = await this.prisma.creditAccount.findUnique({
      where: { franchiseId },
    });

    if (!account) {
      throw new NotFoundException('Credit account not found');
    }

    if (pauseUntil <= new Date()) {
      throw new BadRequestException('Pause until date must be in the future');
    }

    const updated = await this.prisma.creditAccount.update({
      where: { franchiseId },
      data: { automationPausedUntil: pauseUntil } as any,
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub, // Default to franchise owner ID if system-triggered
        action: 'CREDIT_ACCOUNT_AUTOMATION_PAUSE_UPDATE',
        resource: 'CREDIT_ACCOUNT',
        resourceId: updated.id,
        metadata: { franchiseId, updated },
        ip,
      }),
      'CREDIT_ACCOUNT',
    );

    return addTotalCreditAmount(updated);
  }

  async resumeAutomation(user: JwtUser, franchiseId: string, ip: string) {
    const account = await this.prisma.creditAccount.findUnique({
      where: { franchiseId },
    });

    if (!account) {
      throw new NotFoundException('Credit account not found');
    }

    const updated = await this.prisma.creditAccount.update({
      where: { franchiseId },
      data: { automationPausedUntil: null } as any,
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub, // Default to franchise owner ID if system-triggered
        action: 'CREDIT_ACCOUNT_AUTOMATION_RESUME_UPDATE',
        resource: 'CREDIT_ACCOUNT',
        resourceId: updated.id,
        metadata: { franchiseId, updated },
        ip,
      }),
      'CREDIT_ACCOUNT',
    );

    return addTotalCreditAmount(updated);
  }

  async processCreditPayment(
    tx: Prisma.TransactionClient,

    accountId: string,

    paymentAmount: number,

    paymentReferenceId?: string,
  ) {
    const account = await tx.creditAccount.findUnique({
      where: {
        id: accountId,
      },
    });

    if (!account) {
      throw new NotFoundException('Credit account not found');
    }

    if (account.status !== 'ACTIVE') {
      throw new BadRequestException(`Credit account is ${account.status}`);
    }

    const usedCredit = Number(account.usedCredit);

    const advanceBalance = Number(account.advanceBalance);

    let remainingPayment = paymentAmount;

    let newUsedCredit = usedCredit;

    let newAvailableCredit = Number(account.availableCredit);

    let newAdvance = advanceBalance;

    // 1. FIFO reconciliation of outstanding/overdue CreditDue records
    const dues = await tx.creditDue.findMany({
      where: {
        accountId: account.id,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      orderBy: { dueDate: 'asc' },
    });

    for (const due of dues) {
      if (remainingPayment <= 0) break;

      const outstandingAmount = Number(due.outstanding);
      const payable = Math.min(outstandingAmount, remainingPayment);

      const newOutstanding = outstandingAmount - payable;
      remainingPayment -= payable;

      await tx.creditDue.update({
        where: { id: due.id },
        data: {
          outstanding: newOutstanding,
          status: newOutstanding <= 0 ? 'PAID' : due.status,
        },
      });
    }

    /**
     * =====================================================
     * STEP 1:
     * CLEAR OUTSTANDING DURATION-BASED DUES (advanceBalance)
     * =====================================================
     */
    if (newAdvance > 0 && remainingPayment > 0) {
      const payable = Math.min(newAdvance, remainingPayment);

      newAdvance -= payable;
      remainingPayment -= payable;
    }

    /**
     * =====================================================
     * STEP 2:
     * CLEAR USED CREDIT (usedCredit)
     * =====================================================
     */
    if (newUsedCredit > 0 && remainingPayment > 0) {
      const payable = Math.min(newUsedCredit, remainingPayment);

      newUsedCredit -= payable;
      remainingPayment -= payable;
      newAvailableCredit += payable;
    }

    /**
     * =====================================================
     * STEP 3:
     * DEPOSIT REMAINDER
     * =====================================================
     */
    if (remainingPayment > 0) {
      newAdvance += remainingPayment;
    }

    /**
     * =====================================================
     * UPDATE ACCOUNT
     * =====================================================
     */
    const updatedAccount = await tx.creditAccount.update({
      where: {
        id: account.id,
      },

      data: {
        usedCredit: newUsedCredit,

        availableCredit: newAvailableCredit,

        advanceBalance: newAdvance,
      },
    });

    /**
     * =====================================================
     * TRANSACTION LOG
     * =====================================================
     */
    await tx.creditTransaction.create({
      data: {
        accountId: account.id,

        franchiseId: account.franchiseId,

        type: 'PAYMENT',

        direction: 'CREDIT',

        amount: paymentAmount,

        balanceBefore: usedCredit,

        balanceAfter: newUsedCredit,

        referenceType: 'PAYMENT',

        referenceId: paymentReferenceId,

        description:
          remainingPayment > 0
            ? 'Payment received with extra amount added to advance balance'
            : 'Credit payment received',
      },
    });

    /**
     * =====================================================
     * PROCESSING EVENT
     * =====================================================
     */
    await tx.creditProcessingEvent.create({
      data: {
        type: 'PAYMENT',

        franchiseId: account.franchiseId,

        referenceId: paymentReferenceId,

        status: 'DONE',

        processedAt: new Date(),
      },
    });

    return addTotalCreditAmount(updatedAccount);
  }
}
