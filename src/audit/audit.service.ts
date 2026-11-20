import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto, FranchiseAuditQueryDto } from './dto/audit-query.dto';
import { JwtUser } from '../auth/types/jwt-user.type';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as zlib from 'zlib';
import { AuditQueue } from './queues/audit.queue';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private s3Client: S3Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: AuditQueue,
  ) {
    this.initS3();
  }

  private initS3() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'ap-south-1';

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  async log(input: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    try {
      await this.eventBus.emit('audit.created', {
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata: input.metadata,
        ipAddress: input.ip,
        userAgent: input.userAgent,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to publish audit event to bus: ${err.message}`,
        err.stack,
      );
    }
  }

  async saveToDb(input: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ip?: string | null;
    userAgent?: string | null;
    createdAt?: Date;
  }) {
    try {
      return await this.prisma.partitionedAuditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? undefined,
          metadata: input.metadata ?? undefined,
          ipAddress: input.ip ?? undefined,
          userAgent: input.userAgent ?? undefined,
          createdAt: input.createdAt ?? undefined,
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Audit logging saveToDb failed: ${err.message}`,
        err.stack,
      );
    }
  }

  async list(query: AuditQueryDto | FranchiseAuditQueryDto, user?: JwtUser) {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];
    const search = q.search?.trim();
    let franchiseReturnRequestIds: string[] = [];
    let customerReturnRequestIds: string[] = [];

    if (search) {
      const matchingUsers = await this.prisma.user.findMany({
        where: { email: { contains: search, mode: 'insensitive' } },
        select: { id: true },
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);
      clauses.push({ userId: { in: matchingUserIds } });
    }

    if (q.action) {
      clauses.push({ action: { contains: q.action, mode: 'insensitive' } });
    }

    let resourceFilter = q.resource;
    if (q.resource) {
      const isFranchiseRole =
        user &&
        (user.role === Role.FRANCHISE_OWNER ||
          user.role === Role.FRANCHISE_STAFF);
      if (isFranchiseRole && q.resource.toLowerCase() === 'warehousestock') {
        resourceFilter = 'FranchiseStock';
      }

      const rLower = resourceFilter.toLowerCase();
      const resourceMatchClauses: any[] = [
        { resource: { contains: resourceFilter, mode: 'insensitive' } },
      ];

      if (rLower === 'creditaccount' || rLower === 'credit_account') {
        resourceMatchClauses.push({
          resource: { equals: 'CREDIT_ACCOUNT', mode: 'insensitive' },
        });
      } else if (
        rLower === 'credittransaction' ||
        rLower === 'credit_transaction'
      ) {
        resourceMatchClauses.push({
          resource: { equals: 'CREDIT_TRANSACTION', mode: 'insensitive' },
        });
      } else if (
        rLower === 'financialevent' ||
        rLower === 'financial_event' ||
        rLower === 'payment'
      ) {
        resourceMatchClauses.push({
          resource: { equals: 'FINANCIAL_EVENT', mode: 'insensitive' },
        });
        resourceMatchClauses.push({
          resource: { equals: 'PAYMENT', mode: 'insensitive' },
        });
      } else if (rLower === 'stocktransfer' || rLower === 'stock_transfer') {
        resourceMatchClauses.push({
          resource: { equals: 'STOCK_TRANSFER', mode: 'insensitive' },
        });
      } else if (rLower === 'approle' || rLower === 'app_role') {
        resourceMatchClauses.push({
          resource: { equals: 'APP_ROLE', mode: 'insensitive' },
        });
      } else if (
        rLower === 'franchisereturn' ||
        rLower === 'franchise_return'
      ) {
        resourceMatchClauses.push({
          resource: { equals: 'FRANCHISE_RETURN', mode: 'insensitive' },
        });

        let localFranchiseId: string | null = null;
        if (isFranchiseRole) {
          const fid = user.franchiseId ?? user.franchiseOwnerId;
          localFranchiseId = fid ?? null;
        }

        const stockRequestReturnReqs = await this.prisma.returnRequest.findMany(
          {
            where: {
              sourceType: 'STOCK_REQUEST',
              ...(localFranchiseId ? { franchiseId: localFranchiseId } : {}),
            },
            select: { id: true },
          },
        );
        franchiseReturnRequestIds = stockRequestReturnReqs.map((rr) => rr.id);

        resourceMatchClauses.push({
          AND: [
            { resource: { equals: 'ReturnRequest', mode: 'insensitive' } },
            { resourceId: { in: franchiseReturnRequestIds } },
          ],
        });
      } else if (rLower === 'customerreturn' || rLower === 'customer_return') {
        let localFranchiseId: string | null = null;
        if (isFranchiseRole) {
          const fid = user.franchiseId ?? user.franchiseOwnerId;
          localFranchiseId = fid ?? null;
        }

        const customerOrderReturnReqs =
          await this.prisma.returnRequest.findMany({
            where: {
              sourceType: 'CUSTOMER_ORDER',
              ...(localFranchiseId ? { franchiseId: localFranchiseId } : {}),
            },
            select: { id: true },
          });
        customerReturnRequestIds = customerOrderReturnReqs.map((rr) => rr.id);

        resourceMatchClauses.push({
          AND: [
            { resource: { equals: 'ReturnRequest', mode: 'insensitive' } },
            { resourceId: { in: customerReturnRequestIds } },
          ],
        });
      }

      clauses.push({
        OR: resourceMatchClauses,
      });
    }

    if (q.role) {
      const matchingRoleUsers = await this.prisma.user.findMany({
        where: { role: q.role },
        select: { id: true },
      });
      const matchingRoleUserIds = matchingRoleUsers.map((u) => u.id);
      clauses.push({ userId: { in: matchingRoleUserIds } });
    }

    let franchiseUserIds: string[] = [];
    let franchiseId: string | null = null;
    const isFranchiseRole =
      user &&
      (user.role === Role.FRANCHISE_OWNER ||
        user.role === Role.FRANCHISE_STAFF);

    let orderIds: string[] = [];
    let stockRequestIds: string[] = [];
    let payoutIds: string[] = [];
    let returnIds: string[] = [];
    let financialEventIds: string[] = [];
    let razorpayPaymentIds: string[] = [];
    let razorpayOrderIds: string[] = [];
    let supportTicketIds: string[] = [];
    let retailCustomerIds: string[] = [];
    let noticeIds: string[] = [];
    let transferIds: string[] = [];
    let creditAccountId: string | null = null;
    let creditTransactionIds: string[] = [];
    let refundIds: string[] = [];
    let returnRequestIds: string[] = [];
    let appRoleIds: string[] = [];
    let profileIds: string[] = [];
    let nodeIds: string[] = [];

    if (isFranchiseRole) {
      const fid = user.franchiseId ?? user.franchiseOwnerId;
      franchiseId = fid ?? null;
      if (franchiseId) {
        const franchiseUsers = await this.prisma.user.findMany({
          where: {
            OR: [
              { franchiseId: franchiseId },
              { franchiseOwnerId: franchiseId },
            ],
          },
          select: { id: true },
        });
        franchiseUserIds = franchiseUsers.map((u) => u.id);

        const resourceLower = q.resource?.toLowerCase();

        // Dynamically fetch relation IDs based on the requested resource filter
        if (resourceLower === 'order') {
          const orders = await this.prisma.order.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          orderIds = orders.map((o) => o.id);
        } else if (resourceLower === 'stockrequest') {
          const stockRequests = await this.prisma.stockRequest.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          stockRequestIds = stockRequests.map((sr) => sr.id);
        } else if (resourceLower === 'payout') {
          const payouts = await this.prisma.payout.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          payoutIds = payouts.map((p) => p.id);
        } else if (
          resourceLower === 'franchisereturn' ||
          resourceLower === 'franchise_return'
        ) {
          const returns = await this.prisma.franchiseReturn.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          returnIds = returns.map((r) => r.id);

          const returnRequests = await this.prisma.returnRequest.findMany({
            where: { franchiseId, sourceType: 'STOCK_REQUEST' },
            select: { id: true },
          });
          franchiseReturnRequestIds = returnRequests.map((rr) => rr.id);
          returnRequestIds = franchiseReturnRequestIds;
        } else if (
          resourceLower === 'customerreturn' ||
          resourceLower === 'customer_return'
        ) {
          const returnRequests = await this.prisma.returnRequest.findMany({
            where: { franchiseId, sourceType: 'CUSTOMER_ORDER' },
            select: { id: true },
          });
          customerReturnRequestIds = returnRequests.map((rr) => rr.id);
          returnRequestIds = customerReturnRequestIds;
        } else if (
          resourceLower === 'financialevent' ||
          resourceLower === 'financial_event' ||
          resourceLower === 'payment'
        ) {
          const financialEvents = await this.prisma.financialEvent.findMany({
            where: {
              OR: [
                {
                  metadata: {
                    path: ['franchiseId'],
                    equals: franchiseId,
                  },
                },
                {
                  ledgerEntries: {
                    some: {
                      actorType: 'FRANCHISE',
                      actorId: franchiseId,
                    },
                  },
                },
              ],
            },
            select: {
              id: true,
              razorpayPaymentId: true,
              razorpayOrderId: true,
            },
          });
          financialEventIds = financialEvents.map((fe) => fe.id);
          razorpayPaymentIds = financialEvents
            .map((fe) => fe.razorpayPaymentId)
            .filter(Boolean) as string[];
          razorpayOrderIds = financialEvents
            .map((fe) => fe.razorpayOrderId)
            .filter(Boolean) as string[];
        }

        if (!resourceLower || resourceLower === 'supportticket') {
          const supportTickets = await this.prisma.supportTicket.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          supportTicketIds = supportTickets.map((st) => st.id);
        }

        if (resourceLower === 'supportticket') {
          // Handled above
        } else if (resourceLower === 'retailcustomer') {
          const retailCustomers = await this.prisma.retailCustomer.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          retailCustomerIds = retailCustomers.map((rc) => rc.id);
        } else if (resourceLower === 'franchisenotice') {
          const notices = await this.prisma.franchiseNotice.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          noticeIds = notices.map((n) => n.id);
        } else if (
          resourceLower === 'stocktransfer' ||
          resourceLower === 'stock_transfer'
        ) {
          const stockingNodes = await this.prisma.stockingNode.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          const stockingNodeIds = stockingNodes.map((n) => n.id);
          const transfers = await this.prisma.stockTransfer.findMany({
            where: {
              OR: [
                { fromNodeId: { in: stockingNodeIds } },
                { toNodeId: { in: stockingNodeIds } },
              ],
            },
            select: { id: true },
          });
          transferIds = transfers.map((t) => t.id);
        } else if (
          resourceLower === 'creditaccount' ||
          resourceLower === 'credit_account'
        ) {
          const creditAccount = await this.prisma.creditAccount.findUnique({
            where: { franchiseId },
            select: { id: true },
          });
          creditAccountId = creditAccount?.id ?? null;
        } else if (
          resourceLower === 'credittransaction' ||
          resourceLower === 'credit_transaction'
        ) {
          const txs = await this.prisma.creditTransaction.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          creditTransactionIds = txs.map((t) => t.id);
        } else if (resourceLower === 'refund') {
          const orders = await this.prisma.order.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          const localOrderIds = orders.map((o) => o.id);
          const stockRequests = await this.prisma.stockRequest.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          const localStockRequestIds = stockRequests.map((sr) => sr.id);

          const invoices = await this.prisma.invoice.findMany({
            where: {
              OR: [
                { orderId: { in: localOrderIds } },
                { stockRequestId: { in: localStockRequestIds } },
              ],
            },
            select: { id: true },
          });
          const invoiceIds = invoices.map((i) => i.id);

          const refunds = await this.prisma.refund.findMany({
            where: { invoiceId: { in: invoiceIds } },
            select: { id: true },
          });
          refundIds = refunds.map((r) => r.id);
        } else if (resourceLower === 'returnrequest') {
          const returnRequests = await this.prisma.returnRequest.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          returnRequestIds = returnRequests.map((rr) => rr.id);
        } else if (
          resourceLower === 'approle' ||
          resourceLower === 'app_role'
        ) {
          const appRoles = await this.prisma.appRole.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          appRoleIds = appRoles.map((ar) => ar.id);
        } else if (
          resourceLower === 'franchisestaffprofile' ||
          resourceLower === 'franchise_staff_profile'
        ) {
          const profiles = await this.prisma.franchiseStaffProfile.findMany({
            where: {
              user: {
                OR: [{ franchiseId }, { franchiseOwnerId: franchiseId }],
              },
            },
            select: { id: true },
          });
          profileIds = profiles.map((p) => p.id);
        } else if (resourceLower === 'warehouse') {
          const stockingNodes = await this.prisma.stockingNode.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          nodeIds = stockingNodes.map((n) => n.id);
        }

        // Build scoping clauses
        const scopeOrClauses: any[] = [
          { userId: { in: franchiseUserIds } },
          {
            metadata: {
              path: ['franchiseId'],
              equals: franchiseId,
            },
          },
        ];

        if (resourceLower === 'order') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'Order', mode: 'insensitive' } },
              { resourceId: { in: orderIds } },
            ],
          });
        } else if (resourceLower === 'stockrequest') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'StockRequest', mode: 'insensitive' } },
              { resourceId: { in: stockRequestIds } },
            ],
          });
        } else if (resourceLower === 'payout') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'Payout', mode: 'insensitive' } },
              { resourceId: { in: payoutIds } },
            ],
          });
        } else if (
          resourceLower === 'franchisereturn' ||
          resourceLower === 'franchise_return'
        ) {
          scopeOrClauses.push({
            AND: [
              {
                OR: [
                  {
                    resource: {
                      equals: 'FranchiseReturn',
                      mode: 'insensitive',
                    },
                  },
                  {
                    resource: {
                      equals: 'FRANCHISE_RETURN',
                      mode: 'insensitive',
                    },
                  },
                ],
              },
              { resourceId: { in: returnIds } },
            ],
          });
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'ReturnRequest', mode: 'insensitive' } },
              { resourceId: { in: returnRequestIds } },
            ],
          });
        } else if (
          resourceLower === 'customerreturn' ||
          resourceLower === 'customer_return'
        ) {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'ReturnRequest', mode: 'insensitive' } },
              { resourceId: { in: returnRequestIds } },
            ],
          });
        } else if (
          resourceLower === 'financialevent' ||
          resourceLower === 'financial_event'
        ) {
          scopeOrClauses.push({
            AND: [
              {
                OR: [
                  {
                    resource: { equals: 'FinancialEvent', mode: 'insensitive' },
                  },
                  {
                    resource: {
                      equals: 'FINANCIAL_EVENT',
                      mode: 'insensitive',
                    },
                  },
                ],
              },
              { resourceId: { in: financialEventIds } },
            ],
          });
        } else if (resourceLower === 'payment') {
          scopeOrClauses.push({
            AND: [
              { resource: { in: ['Payment', 'PAYMENT'] } },
              {
                resourceId: {
                  in: [
                    ...razorpayPaymentIds,
                    ...financialEventIds,
                    ...razorpayOrderIds,
                  ],
                },
              },
            ],
          });
        }

        if (!resourceLower || resourceLower === 'supportticket') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'SupportTicket', mode: 'insensitive' } },
              { resourceId: { in: supportTicketIds } },
            ],
          });
        }

        if (resourceLower === 'supportticket') {
          // Handled above
        } else if (resourceLower === 'retailcustomer') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'RetailCustomer', mode: 'insensitive' } },
              { resourceId: { in: retailCustomerIds } },
            ],
          });
        } else if (resourceLower === 'franchisenotice') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'FranchiseNotice', mode: 'insensitive' } },
              { resourceId: { in: noticeIds } },
            ],
          });
        } else if (
          resourceLower === 'stocktransfer' ||
          resourceLower === 'stock_transfer'
        ) {
          scopeOrClauses.push({
            AND: [
              {
                OR: [
                  {
                    resource: { equals: 'StockTransfer', mode: 'insensitive' },
                  },
                  {
                    resource: { equals: 'STOCK_TRANSFER', mode: 'insensitive' },
                  },
                ],
              },
              { resourceId: { in: transferIds } },
            ],
          });
        } else if (
          resourceLower === 'creditaccount' ||
          resourceLower === 'credit_account' ||
          resourceLower === 'credittransaction' ||
          resourceLower === 'credit_transaction'
        ) {
          const orConditions: any[] = [];
          if (creditAccountId) {
            orConditions.push({ resourceId: creditAccountId });
          }
          if (creditTransactionIds.length > 0) {
            orConditions.push({ resourceId: { in: creditTransactionIds } });
          }
          scopeOrClauses.push({
            AND: [
              {
                OR: [
                  {
                    resource: { equals: 'CreditAccount', mode: 'insensitive' },
                  },
                  {
                    resource: { equals: 'CREDIT_ACCOUNT', mode: 'insensitive' },
                  },
                  {
                    resource: {
                      equals: 'CreditTransaction',
                      mode: 'insensitive',
                    },
                  },
                  {
                    resource: {
                      equals: 'CREDIT_TRANSACTION',
                      mode: 'insensitive',
                    },
                  },
                ],
              },
              {
                OR:
                  orConditions.length > 0
                    ? orConditions
                    : [{ resourceId: 'NONE' }],
              },
            ],
          });
        } else if (resourceLower === 'refund') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'Refund', mode: 'insensitive' } },
              { resourceId: { in: refundIds } },
            ],
          });
        } else if (resourceLower === 'returnrequest') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'ReturnRequest', mode: 'insensitive' } },
              { resourceId: { in: returnRequestIds } },
            ],
          });
        } else if (
          resourceLower === 'approle' ||
          resourceLower === 'app_role'
        ) {
          scopeOrClauses.push({
            AND: [
              {
                OR: [
                  { resource: { equals: 'AppRole', mode: 'insensitive' } },
                  { resource: { equals: 'APP_ROLE', mode: 'insensitive' } },
                ],
              },
              { resourceId: { in: appRoleIds } },
            ],
          });
        } else if (
          resourceLower === 'franchisestaffprofile' ||
          resourceLower === 'franchise_staff_profile'
        ) {
          scopeOrClauses.push({
            AND: [
              {
                resource: {
                  equals: 'FranchiseStaffProfile',
                  mode: 'insensitive',
                },
              },
              { resourceId: { in: profileIds } },
            ],
          });
        } else if (resourceLower === 'warehouse') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'Warehouse', mode: 'insensitive' } },
              { resourceId: { in: nodeIds } },
            ],
          });
        } else if (resourceLower === 'user') {
          scopeOrClauses.push({
            AND: [
              {
                OR: [
                  { resource: { equals: 'User', mode: 'insensitive' } },
                  { resource: { equals: 'USER', mode: 'insensitive' } },
                ],
              },
              { resourceId: { in: franchiseUserIds } },
            ],
          });
        } else if (resourceLower === 'franchise') {
          scopeOrClauses.push({
            AND: [
              { resource: { equals: 'Franchise', mode: 'insensitive' } },
              { resourceId: franchiseId },
            ],
          });
        } else if (
          resourceLower === 'franchisestock' ||
          resourceLower === 'warehousestock'
        ) {
          scopeOrClauses.push({
            AND: [
              {
                OR: [
                  {
                    resource: { equals: 'FranchiseStock', mode: 'insensitive' },
                  },
                  {
                    resource: { equals: 'WarehouseStock', mode: 'insensitive' },
                  },
                ],
              },
              {
                metadata: {
                  path: ['franchiseId'],
                  equals: franchiseId,
                },
              },
            ],
          });
        }

        clauses.push({
          OR: scopeOrClauses,
        });
      } else {
        clauses.push({ userId: { in: [] } });
      }
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const fromDate = q.fromDate ? new Date(q.fromDate) : null;
    const toDate = q.lastDate ? new Date(q.lastDate) : null;

    // Filter DB query to only fetch non-archived hot logs
    const dbFromDate =
      fromDate && fromDate > sixMonthsAgo ? fromDate : sixMonthsAgo;
    const dbClauses = [...clauses];

    const dbDateFilter: Record<string, any> = {};
    dbDateFilter.gte = dbFromDate;
    if (toDate) {
      dbDateFilter.lte = toDate;
    }
    dbClauses.push({ createdAt: dbDateFilter });

    const where = dbClauses.length > 0 ? { AND: dbClauses } : {};

    const dbRecords = await this.prisma.partitionedAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const allRecords = [...dbRecords];

    // If query extends past 6 months, search warm S3 archives
    const needsArchivedSearch = !fromDate || fromDate < sixMonthsAgo;
    if (needsArchivedSearch && this.s3Client) {
      const registryQuery = {
        verified: true,
        toDate: { gte: fromDate || new Date(2020, 0, 1) },
        fromDate: { lte: sixMonthsAgo },
      };

      const archives = await this.prisma.auditArchiveRegistry.findMany({
        where: registryQuery,
      });

      const archiveFilters = {
        userId: clauses.find((c) => c.userId)?.[0], // simple mapping
        action: q.action,
        resource: resourceFilter,
        fromDate,
        toDate: toDate || new Date(),
        franchiseId,
        franchiseUserIds: isFranchiseRole ? franchiseUserIds : undefined,
        orderIds,
        stockRequestIds,
        payoutIds,
        returnIds,
        financialEventIds,
        paymentResourceIds: [
          ...razorpayPaymentIds,
          ...financialEventIds,
          ...razorpayOrderIds,
        ],
        supportTicketIds,
        retailCustomerIds,
        noticeIds,
        transferIds,
        creditAccountId,
        creditTransactionIds,
        refundIds,
        returnRequestIds,
        franchiseReturnRequestIds,
        customerReturnRequestIds,
        appRoleIds,
        profileIds,
        nodeIds,
      };

      for (const archive of archives) {
        const s3Records = await this.fetchAndFilterS3Archive(
          archive.s3Key,
          archiveFilters,
        );
        allRecords.push(...s3Records);
      }
    }

    // Sort combined results
    allRecords.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Paginate manually since we combined DB and S3 sources
    const page = Number(q.page ?? 1);
    const limit = Number(q.limit ?? 200);
    const total = allRecords.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const pagedRecords = allRecords.slice(startIndex, startIndex + limit);

    // Hydrate user info
    const userIds = [...new Set(pagedRecords.map((r) => r.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, role: true, franchiseId: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = pagedRecords.map((r) => ({
      ...r,
      ip: r.ipAddress, // map key back for compatibility
      user: userMap.get(r.userId) || null,
    }));

    return {
      data,
      meta: {
        count: total,
        page,
        limit,
        totalPages,
      },
    };
  }

  private async fetchAndFilterS3Archive(
    s3Key: string,
    filters: any,
  ): Promise<any[]> {
    try {
      const bucket = process.env.AWS_S3_BUCKET || 'audit-archive';
      const response = await this.s3Client!.send(
        new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
      );

      const stream = response.Body as Readable;
      if (!stream) return [];

      const buffer = await this.streamToBuffer(
        stream.pipe(zlib.createGunzip()),
      );
      const lines = buffer.toString('utf8').split('\n');

      const results: any[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const record = JSON.parse(line);
        if (this.matchesFilters(record, filters)) {
          results.push(record);
        }
      }
      return results;
    } catch (err: any) {
      this.logger.error(
        `Failed to fetch/filter S3 archive ${s3Key}: ${err.message}`,
      );
      return [];
    }
  }

  private matchesFilters(record: any, filters: any): boolean {
    if (filters.userId && record.userId !== filters.userId) return false;
    if (
      filters.action &&
      !record.action.toLowerCase().includes(filters.action.toLowerCase())
    )
      return false;
    if (filters.resource) {
      const filterRes = filters.resource.toLowerCase();
      const recRes = record.resource.toLowerCase();
      const normalizedFilterRes = filterRes.replace(/_/g, '');
      const normalizedRecRes = recRes.replace(/_/g, '');
      let match =
        recRes.includes(filterRes) ||
        normalizedRecRes.includes(normalizedFilterRes);
      if (!match) {
        if (
          (filterRes === 'payment' ||
            filterRes === 'financialevent' ||
            filterRes === 'financial_event') &&
          (recRes === 'payment' ||
            recRes === 'financialevent' ||
            recRes === 'financial_event')
        ) {
          match = true;
        } else if (
          (filterRes === 'franchisereturn' ||
            filterRes === 'franchise_return') &&
          (recRes === 'returnrequest' || recRes === 'return_request') &&
          filters.franchiseReturnRequestIds?.includes(record.resourceId)
        ) {
          match = true;
        } else if (
          (filterRes === 'customerreturn' || filterRes === 'customer_return') &&
          (recRes === 'returnrequest' || recRes === 'return_request') &&
          filters.customerReturnRequestIds?.includes(record.resourceId)
        ) {
          match = true;
        }
      }
      if (!match) {
        return false;
      }
    }
    if (
      filters.fromDate &&
      new Date(record.createdAt) < new Date(filters.fromDate)
    )
      return false;
    if (filters.toDate && new Date(record.createdAt) > new Date(filters.toDate))
      return false;
    if (
      filters.franchiseUserIds &&
      filters.franchiseUserIds.length > 0 &&
      filters.franchiseId
    ) {
      const isCreatedByFranchiseUser = filters.franchiseUserIds.includes(
        record.userId,
      );

      let isAllowedByRelation = false;
      const resLower = record.resource?.toLowerCase();

      if (
        resLower === 'order' &&
        filters.orderIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'stockrequest' &&
        filters.stockRequestIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'payout' &&
        filters.payoutIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        (resLower === 'franchisereturn' || resLower === 'franchise_return') &&
        filters.returnIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        (resLower === 'financialevent' || resLower === 'financial_event') &&
        filters.financialEventIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'payment' &&
        filters.paymentResourceIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'supportticket' &&
        filters.supportTicketIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'retailcustomer' &&
        filters.retailCustomerIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'franchisenotice' &&
        filters.noticeIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        (resLower === 'stocktransfer' || resLower === 'stock_transfer') &&
        filters.transferIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        (resLower === 'creditaccount' || resLower === 'credit_account') &&
        record.resourceId === filters.creditAccountId
      ) {
        isAllowedByRelation = true;
      } else if (
        (resLower === 'credittransaction' ||
          resLower === 'credit_transaction') &&
        filters.creditTransactionIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'refund' &&
        filters.refundIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'returnrequest' &&
        filters.returnRequestIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        (resLower === 'approle' || resLower === 'app_role') &&
        filters.appRoleIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        (resLower === 'franchisestaffprofile' ||
          resLower === 'franchise_staff_profile') &&
        filters.profileIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'warehouse' &&
        filters.nodeIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'user' &&
        filters.franchiseUserIds?.includes(record.resourceId)
      ) {
        isAllowedByRelation = true;
      } else if (
        resLower === 'franchise' &&
        record.resourceId === filters.franchiseId
      ) {
        isAllowedByRelation = true;
      } else if (record.metadata?.franchiseId === filters.franchiseId) {
        isAllowedByRelation = true;
      }

      if (!isCreatedByFranchiseUser && !isAllowedByRelation) {
        return false;
      }
    }
    return true;
  }

  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
