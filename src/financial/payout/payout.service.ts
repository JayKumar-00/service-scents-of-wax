import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';
import {
  FranchiseStatus,
  PayoutStatus,
  CreditTransactionEnum,
  DirectionEnum,
  Role,
} from '@prisma/client';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePayoutDto } from './dto/payout-create.dto';
import { CreatePayoutRequestDto } from './dto/payout-request.dto';
import { PayoutQueryDto } from './dto/payout-query.dto';
import { PayoutEventEmitter } from './events/payout.event-emitter';
import { paginatePrisma } from 'src/common/utils/pagination.util';
import { OrderType } from 'src/common/dto/query.dto';
import { randomUUID } from 'node:crypto';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payoutEventEmitter: PayoutEventEmitter,
    private readonly audit: AuditService,
  ) {}

  async createPayoutRequest(
    user: JwtUser,
    dto: CreatePayoutRequestDto,
    ip: string,
  ) {
    const franchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (!franchiseId) {
      throw new BadRequestException(
        'User is not associated with any franchise',
      );
    }

    const payout = await this.prisma.$transaction(async (tx) => {
      const creditAccount = await tx.creditAccount.findUnique({
        where: { franchiseId },
      });

      if (!creditAccount) {
        throw new NotFoundException('Franchise credit account not found');
      }

      if (creditAccount.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Franchise credit account is in status ${creditAccount.status}`,
        );
      }

      const walletBalance = Number(creditAccount.walletBalance);
      // TODO(security): Temporarily bypassing the wallet balance check to allow payout requests to be received directly,
      // without depending only on the commission/wallet balance.
      /*
      if (walletBalance < dto.amount) {
        throw new BadRequestException(
          'Insufficient wallet balance for this payout request',
        );
      }
      */

      const newWalletBalance = walletBalance - dto.amount;

      // 1. Create Payout record
      const payoutRecord = await tx.payout.create({
        data: {
          payoutCode: `CT-${randomUUID()}`,
          franchiseId: franchiseId,
          accountId: creditAccount.id,
          amount: dto.amount,
          status: PayoutStatus.PENDING,
          notes: dto.notes,
        },
      });

      // 2. Update CreditAccount wallet balance
      await tx.creditAccount.update({
        where: { id: creditAccount.id },
        data: {
          walletBalance: newWalletBalance,
        },
      });

      // 3. Create CreditTransaction record
      await tx.creditTransaction.create({
        data: {
          accountId: creditAccount.id,
          franchiseId: franchiseId,
          type: CreditTransactionEnum.PAYOUT,
          amount: dto.amount,
          direction: DirectionEnum.DEBIT,
          balanceBefore: walletBalance,
          balanceAfter: newWalletBalance,
          referenceType: 'PAYOUT',
          referenceId: payoutRecord.id,
          description: dto.notes ?? 'Payout request created',
        },
      });

      return payoutRecord;
    });

    // Emit event outside the transaction and handle errors gracefully
    this.payoutEventEmitter
      .requested(payout.id, franchiseId, dto.amount)
      .catch((err) => {
        this.logger.error(
          `Failed to emit requested event for payout ${payout.id}: ${err.message}`,
        );
      });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'PAYOUT_REQUEST_CREATE',
        resource: 'PAYOUT',
        resourceId: payout.id,
        metadata: { amount: dto.amount, franchiseId },
        ip,
      }),
      'PAYOUT_REQUEST_CREATE',
    );

    return this.enrichPayout(payout);
  }

  async createPayout(dto: CreatePayoutDto, adminUserId: string, ip: string) {
    const franchise = await this.prisma.franchise.findUniqueOrThrow({
      where: { code: dto.code, status: FranchiseStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        ownerEmail: true,
        badge: true,
        businessName: true,
      },
    });

    const payout = await this.prisma.$transaction(async (tx) => {
      const creditAccount = await tx.creditAccount.findUnique({
        where: { franchiseId: franchise.id },
      });

      if (!creditAccount) {
        throw new NotFoundException('Franchise credit account not found');
      }

      if (creditAccount.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Franchise credit account is in status ${creditAccount.status}`,
        );
      }

      const walletBalance = Number(creditAccount.walletBalance);
      // if (walletBalance < dto.amount) {
      //   throw new BadRequestException(
      //     'Insufficient wallet balance for this direct payout',
      //   );
      // }

      const newWalletBalance = walletBalance - dto.amount;
      const referenceId = `DIR-PAY-${Date.now()}`;

      // TO GET REDABLE
      const last = await tx.payout.count({
        where: { franchiseId: franchise.id },
      });

      const payoutCode = `CT-${franchise.id.substring(0, 4).toUpperCase()}-${last + 1}`;
      // Example: CT-12-57

      // 1. Create Payout record
      const payoutRecord = await tx.payout.create({
        data: {
          payoutCode,
          franchiseId: franchise.id,
          accountId: creditAccount.id,
          amount: dto.amount,
          status: PayoutStatus.COMPLETED,
          referenceId,
          processedAt: new Date(),
          processedBy: adminUserId,
          notes: 'Direct payout by admin',
        },
      });

      // 2. Update CreditAccount wallet balance
      await tx.creditAccount.update({
        where: { id: creditAccount.id },
        data: {
          walletBalance: newWalletBalance,
        },
      });

      // 3. Create CreditTransaction record
      await tx.creditTransaction.create({
        data: {
          accountId: creditAccount.id,
          franchiseId: franchise.id,
          type: CreditTransactionEnum.PAYOUT, // CreditTransactionEnum.CASH_IN,
          amount: dto.amount,
          direction: DirectionEnum.DEBIT,
          balanceBefore: walletBalance,
          balanceAfter: newWalletBalance,
          referenceType: 'PAYOUT',
          referenceId: payoutRecord.id,
          description: 'Direct payout processed by admin',
        },
      });

      return payoutRecord;
    });

    // Emit event outside the transaction and handle errors gracefully
    this.payoutEventEmitter
      .completed(payout.id, franchise.id, dto.amount)
      .catch((err) => {
        this.logger.error(
          `Failed to emit completed event for payout ${payout.id}: ${err.message}`,
        );
      });

    fireAndForget(
      this.audit.log({
        userId: adminUserId,
        action: 'PAYOUT_CREATE',
        resource: 'PAYOUT',
        resourceId: payout.id,
        metadata: { amount: dto.amount, franchiseId: franchise.id },
        ip,
      }),
      'PAYOUT_CREATE',
    );

    return this.enrichPayout(payout);
  }

  async approvePayout(
    payoutId: string,
    adminUserId: string,
    referenceId: string,
    ip: string,
  ) {
    if (!referenceId) {
      throw new BadRequestException(
        'Reference ID is required to approve a payout request',
      );
    }

    const { updatedPayout, payout } = await this.prisma.$transaction(
      async (tx) => {
        const payoutRecord = await tx.payout.findUnique({
          where: { id: payoutId },
          include: { account: true },
        });

        if (!payoutRecord) {
          throw new NotFoundException('Payout request not found');
        }

        if (payoutRecord.status !== PayoutStatus.PENDING) {
          throw new BadRequestException(
            `Payout is already in status ${payoutRecord.status}`,
          );
        }

        const updated = await tx.payout.update({
          where: { id: payoutId },
          data: {
            status: PayoutStatus.COMPLETED,
            referenceId,
            processedAt: new Date(),
            processedBy: adminUserId,
          },
        });

        return { updatedPayout: updated, payout: payoutRecord };
      },
    );

    // Emit event outside the transaction and handle errors gracefully
    this.payoutEventEmitter
      .completed(payout.id, payout.franchiseId, Number(payout.amount))
      .catch((err) => {
        this.logger.error(
          `Failed to emit completed event for payout ${payout.id}: ${err.message}`,
        );
      });

    fireAndForget(
      this.audit.log({
        userId: adminUserId,
        action: 'PAYOUT_APPROVE_UPDATE',
        resource: 'PAYOUT',
        resourceId: payout.id,
        metadata: {
          status: PayoutStatus.COMPLETED,
          referenceId,
          amount: payout.amount,
          franchiseId: payout.franchiseId,
        },
        ip,
      }),
      'PAYOUT_APPROVE_UPDATE',
    );

    return this.enrichPayout(updatedPayout);
  }

  async rejectPayout(
    payoutId: string,
    adminUserId: string,
    reason: string,
    ip: string,
  ) {
    if (!reason) {
      throw new BadRequestException(
        'Reason is required to reject a payout request',
      );
    }

    const { updatedPayout, payout, refundAmount } =
      await this.prisma.$transaction(async (tx) => {
        const payoutRecord = await tx.payout.findUnique({
          where: { id: payoutId },
          include: { account: true },
        });

        if (!payoutRecord) {
          throw new NotFoundException('Payout request not found');
        }

        if (payoutRecord.status !== PayoutStatus.PENDING) {
          throw new BadRequestException(
            `Payout is already in status ${payoutRecord.status}`,
          );
        }

        const walletBalance = Number(payoutRecord.account.walletBalance);
        const refAmount = Number(payoutRecord.amount);
        const newWalletBalance = walletBalance + refAmount;

        // 1. Update Payout status
        const updated = await tx.payout.update({
          where: { id: payoutId },
          data: {
            status: PayoutStatus.REJECTED,
            rejectionReason: reason,
            processedAt: new Date(),
            processedBy: adminUserId,
          },
        });

        // 2. Refund wallet balance
        await tx.creditAccount.update({
          where: { id: payoutRecord.accountId },
          data: {
            walletBalance: newWalletBalance,
          },
        });

        // 3. Create refund CreditTransaction
        await tx.creditTransaction.create({
          data: {
            accountId: payoutRecord.accountId,
            franchiseId: payoutRecord.franchiseId,
            type: CreditTransactionEnum.REFUND,
            amount: refAmount,
            direction: DirectionEnum.CREDIT,
            balanceBefore: walletBalance,
            balanceAfter: newWalletBalance,
            referenceType: 'PAYOUT_REJECTION',
            referenceId: payoutRecord.id,
            description: `Refund: Payout request rejected. Reason: ${reason}`,
          },
        });

        return {
          updatedPayout: updated,
          payout: payoutRecord,
          refundAmount: refAmount,
        };
      });

    // Emit event outside the transaction and handle errors gracefully
    this.payoutEventEmitter
      .rejected(payout.id, payout.franchiseId, refundAmount, reason)
      .catch((err) => {
        this.logger.error(
          `Failed to emit rejected event for payout ${payout.id}: ${err.message}`,
        );
      });

    fireAndForget(
      this.audit.log({
        userId: adminUserId,
        action: 'PAYOUT_REJECT_UPDATE',
        resource: 'PAYOUT',
        resourceId: payout.id,
        metadata: {
          reason,
          amount: refundAmount,
          franchiseId: payout.franchiseId,
        },
        ip,
      }),
      'PAYOUT_REJECT',
    );

    return this.enrichPayout(updatedPayout);
  }

  async getPayoutsForUser(user: JwtUser, query: PayoutQueryDto) {
    const franchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (!franchiseId) {
      throw new BadRequestException(
        'User is not associated with any franchise',
      );
    }

    const where: any = {
      franchiseId,
    };

    if (query.status) {
      where.status = query.status;
    }

    const result = await paginatePrisma({
      model: this.prisma.payout as any,
      where,
      orderBy: { createdAt: query.order || OrderType.DESC },
      page: query.page,
      limit: query.limit,
    });

    result.data = await this.enrichPayouts(result.data);
    return result;
  }

  async getPayoutsForAdmin(query: PayoutQueryDto) {
    const where: any = {};

    if (query.franchiseId) {
      where.franchiseId = query.franchiseId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const result = await paginatePrisma({
      model: this.prisma.payout as any,
      where,
      orderBy: { createdAt: query.order || OrderType.DESC },
      page: query.page,
      limit: query.limit,
      include: {
        franchise: {
          select: {
            id: true,
            code: true,
            businessName: true,
            ownerFullName: true,
          },
        },
      },
    });

    result.data = await this.enrichPayouts(result.data);
    return result;
  }

  async getPayouts(user: JwtUser) {
    if (
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF
    ) {
      let franchiseId: string | undefined;
      if (user.role === Role.FRANCHISE_OWNER) {
        if (!user.franchiseId) {
          throw new BadRequestException(
            'User is not associated with any franchise',
          );
        }
        franchiseId = user.franchiseId;
      } else {
        if (!user.franchiseOwnerId) {
          throw new BadRequestException(
            'User does not have a franchise owner ID',
          );
        }
        franchiseId = user.franchiseOwnerId;
      }

      const payouts = await this.prisma.payout.findMany({
        where: { franchiseId },
      });

      let totalPayout = 0;
      let totalAmount = 0;
      let pendingAmount = 0;
      let pendingPayout = 0;
      let rejectPayout = 0;

      for (const payout of payouts) {
        totalPayout++;
        const amount = Number(payout.amount) || 0;
        if (payout.status === PayoutStatus.COMPLETED) {
          totalAmount += amount;
        } else if (payout.status === PayoutStatus.PENDING) {
          pendingAmount += amount;
          pendingPayout++;
        } else if (payout.status === PayoutStatus.REJECTED) {
          rejectPayout++;
        }
      }

      return {
        franchiseId,
        totalPayout,
        totalAmount,
        pedingAmount: pendingAmount,
        pendingAmount,
        pendingPayout,
        rejectPayout,
      };
    }

    // Admin / Superadmin case
    const payouts = await this.prisma.payout.findMany({
      include: {
        franchise: {
          select: {
            id: true,
            name: true,
            code: true,
            ownerEmail: true,
            ownerPhone: true,
          },
        },
      },
    });

    const franchiseSummaryMap = new Map<string, any>();
    let overallTotalPayout = 0;
    let overallTotalAmount = 0;
    let overallPendingAmount = 0;
    let overallPendingPayout = 0;
    let overallRejectPayout = 0;

    for (const payout of payouts) {
      // Overall stats
      overallTotalPayout++;
      const amount = Number(payout.amount) || 0;
      if (payout.status === PayoutStatus.COMPLETED) {
        overallTotalAmount += amount;
      } else if (payout.status === PayoutStatus.PENDING) {
        overallPendingAmount += amount;
        overallPendingPayout++;
      } else if (payout.status === PayoutStatus.REJECTED) {
        overallRejectPayout++;
      }

      // Grouped stats per franchise
      const fId = payout.franchiseId;
      let summary = franchiseSummaryMap.get(fId);
      if (!summary) {
        summary = {
          franchiseId: fId,
          franchise: payout.franchise
            ? {
                name: payout.franchise.name,
                email: payout.franchise.ownerEmail || '',
                phone: payout.franchise.ownerPhone || '',
                code: payout.franchise.code || '',
              }
            : null,
          totalPayout: 0,
          totalAmount: 0,
          pedingAmount: 0,
          pendingAmount: 0,
          pendingPayout: 0,
          rejectPayout: 0,
        };
        franchiseSummaryMap.set(fId, summary);
      }

      summary.totalPayout++;
      if (payout.status === PayoutStatus.COMPLETED) {
        summary.totalAmount += amount;
      } else if (payout.status === PayoutStatus.PENDING) {
        summary.pendingAmount += amount;
        summary.pedingAmount += amount;
        summary.pendingPayout++;
      } else if (payout.status === PayoutStatus.REJECTED) {
        summary.rejectPayout++;
      }
    }

    const data = Array.from(franchiseSummaryMap.values());

    return {
      data,
      meta: {
        overall: {
          totalPayout: overallTotalPayout,
          totalAmount: overallTotalAmount,
          pedingAmount: overallPendingAmount,
          pendingAmount: overallPendingAmount,
          pendingPayout: overallPendingPayout,
          rejectPayout: overallRejectPayout,
        },
      },
    };
  }

  private async enrichPayouts(payouts: any[]) {
    if (!payouts || payouts.length === 0) return [];

    const processedByUserIds = [
      ...new Set(
        payouts.map((p) => p.processedBy).filter((id): id is string => !!id),
      ),
    ];

    const users =
      processedByUserIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: processedByUserIds } },
            include: {
              adminProfile: true,
            },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const franchiseIds = [
      ...new Set(
        payouts.map((p) => p.franchiseId).filter((id): id is string => !!id),
      ),
    ];

    const franchises =
      franchiseIds.length > 0
        ? await this.prisma.franchise.findMany({
            where: { id: { in: franchiseIds } },
          })
        : [];

    const franchiseMap = new Map(franchises.map((f) => [f.id, f]));

    return payouts.map((payout) => {
      let payer = null;
      if (payout.processedBy) {
        const user = userMap.get(payout.processedBy);
        if (user) {
          payer = {
            id: user.id,
            name: user.adminProfile?.name || 'System Admin',
            email: user.email,
            phone: user.adminProfile?.companyPhone || '',
          };
        } else {
          payer = {
            id: payout.processedBy,
            name: 'Unknown User',
            email: '',
            phone: '',
          };
        }
      }

      const franchise = franchiseMap.get(payout.franchiseId);
      const receiver = franchise
        ? {
            id: franchise.id,
            code: franchise.code,
            name: franchise.name,
            ownerName: franchise.ownerFullName || '',
            email: franchise.ownerEmail || '',
            phone: franchise.ownerPhone || '',
          }
        : {
            id: payout.franchiseId,
            code: '',
            name: 'Unknown Franchise',
            ownerName: '',
            email: '',
            phone: '',
          };

      return {
        ...payout,
        payer,
        receiver,
      };
    });
  }

  private async enrichPayout(payout: any) {
    const enriched = await this.enrichPayouts([payout]);
    return enriched[0];
  }
}
