import {
  BadRequestException,
  ForbiddenException,
  // ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Role,
  SupportTicket,
  SupportTicketStatus,
  TicketPriority,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import {
  franchiseCanMutate,
  franchiseHasReadAccess,
} from '../common/franchise-roles';
import {
  buildSortOrder,
  paginatePrisma,
} from '../common/utils/pagination.util';
import { OrderType } from '../common/dto/query.dto';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { TicketQueryDto } from './dto/support-ticket-query.dto';
import { buildPrismaTextSearchFilter } from 'src/common/utils/search.util';
import { RedisService } from 'src/redis/redis.service';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { NotificationService } from 'src/notification/services/notification.service';
import { NotificationType } from 'src/notification/enums/notification-type.enum';
import { CreateCustomerTicketDto } from './dto/create-customer-ticket.dto';
import { AuditService } from 'src/audit/audit.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';

@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    private readonly audit: AuditService,
  ) { }

  private buildSupportTicketSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'name']);

  async create(dto: CreateSupportTicketDto, user: JwtUser, ip: string) {
    // if (!franchiseCanMutate(user.role) || !user.franchiseId) {
    //   throw new ForbiddenException();
    // }
    const msg = dto.initialMessage?.trim() || 'Ticket opened.';
    const ticket = await this.prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({
        data: {
          franchiseId: user.franchiseOwnerId ?? user.franchiseId,
          type: dto.type,
          subject: dto.subject.trim(),
          priority: dto.priority ?? undefined,
          createdByUserId: user.sub,
        },
      });
      await tx.ticketMessage.create({
        data: {
          ticketId: t.id,
          authorUserId: user.sub,
          body: msg,
          isInternal: false,
        },
      });
      return tx.supportTicket.findUnique({
        where: { id: t.id },
        include: {
          franchise: { select: { id: true, name: true, code: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { email: true, role: true } } },
          },
        },
      });
    });

    if (ticket) {
      const franchiseName = ticket.franchise?.name || 'Unknown';
      const title = 'New Support Ticket';
      const body = `A new support ticket has been created for franchise ${franchiseName}: "${ticket.subject}" (Priority: ${ticket.priority || 'NORMAL'}).`;

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'SUPPORT_TICKET_CREATED',
          resource: 'SupportTicket',
          resourceId: ticket.id,
          metadata: { ticket },
          ip,
        }),
        'SUPPORT_TICKET_CREATED',
      );

      void this.notifyAdmins(title, body, {
        ticketId: ticket.id,
        franchiseId: ticket.franchiseId,
        subject: ticket.subject,
        priority: ticket.priority,
      });
    }

    return ticket;
  }

  async raiseCustomerTicket(
    dto: CreateCustomerTicketDto,
    user: JwtUser,
    ip?: string,
    customerUserId?: string,
    franchiseId?: string,
  ) {
    let targetCustomerUserId = '';

    if (user.role === Role.CUSTOMER) {
      targetCustomerUserId = user.sub;
    } else if (
      user.role === Role.SUPERADMIN ||
      user.role === Role.ADMIN_STAFF
    ) {
      if (!customerUserId) {
        throw new BadRequestException(
          'customerUserId is required when ticket is raised by admin/superadmin',
        );
      }
      const customerUser = await this.prisma.user.findFirst({
        where: { id: customerUserId, role: Role.CUSTOMER },
      });
      if (!customerUser) {
        throw new NotFoundException(
          `Customer user with ID ${customerUserId} not found`,
        );
      }
      targetCustomerUserId = customerUserId;
    } else {
      throw new ForbiddenException(
        'Only CUSTOMER, SUPERADMIN, and ADMIN_STAFF can raise customer tickets',
      );
    }

    let targetFranchiseId = '';
    if (franchiseId) {
      const franchiseExists = await this.prisma.franchise.findUnique({
        where: { id: franchiseId },
      });
      if (!franchiseExists) {
        throw new NotFoundException(
          `Franchise with ID ${franchiseId} not found`,
        );
      }
      targetFranchiseId = franchiseId;
    } else {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetCustomerUserId },
        select: { franchiseId: true },
      });
      if (targetUser?.franchiseId) {
        targetFranchiseId = targetUser.franchiseId;
      } else {
        const central = await this.prisma.franchise.findUnique({
          where: { code: 'CENTRAL_WAREHOUSE' },
        });
        if (!central) {
          throw new BadRequestException(
            'No franchise found and CENTRAL_WAREHOUSE franchise is not configured',
          );
        }
        targetFranchiseId = central.id;
      }
    }

    const msg = dto.initialMessage?.trim() || 'Ticket opened.';

    const resultTicket = await this.prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({
        data: {
          franchiseId: targetFranchiseId,
          type: dto.type,
          subject: dto.subject.trim(),
          priority: TicketPriority.MEDIUM,
          createdByUserId: targetCustomerUserId,
        },
      });

      await tx.ticketMessage.create({
        data: {
          ticketId: t.id,
          authorUserId: user.sub,
          body: msg,
          isInternal: false,
        },
      });

      return tx.supportTicket.findUnique({
        where: { id: t.id },
        include: {
          franchise: { select: { id: true, name: true, code: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { email: true, role: true } } },
          },
        },
      });
    });

    if (resultTicket) {
      const franchiseName = resultTicket.franchise?.name || 'Unknown';
      const title = 'New Support Ticket';
      const body = `A new support ticket has been created for franchise ${franchiseName}: "${resultTicket.subject}" (Priority: ${resultTicket.priority || 'NORMAL'}).`;

      void this.notifyAdmins(title, body, {
        ticketId: resultTicket.id,
        franchiseId: resultTicket.franchiseId,
        subject: resultTicket.subject,
        priority: resultTicket.priority,
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'SUPPORT_TICKET_CREATED',
          resource: 'SupportTicket',
          resourceId: resultTicket.id,
          metadata: {
            role: user.role,
            subject: resultTicket.subject,
            type: resultTicket.type,
            priority: resultTicket.priority,
            franchiseId: resultTicket.franchiseId,
            createdForUserId: targetCustomerUserId,
          },
          ip,
        }),
        'SUPPORT_TICKET_CREATED',
      );
    }

    return resultTicket;
  }

  async list(
    user: JwtUser,
    franchiseId?: string,
    status?: SupportTicketStatus,
  ) {
    if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF) {
      return this.prisma.supportTicket.findMany({
        where: {
          ...(franchiseId ? { franchiseId } : {}),
          ...(status ? { status } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: {
          franchise: { select: { id: true, name: true, code: true } },
          createdBy: { select: { email: true, role: true } },
          assignedTo: { select: { email: true } },
          _count: { select: { messages: true } },
        },
      });
    }
    if (user.role === Role.CUSTOMER) {
      return this.prisma.supportTicket.findMany({
        where: {
          createdByUserId: user.sub,
          ...(status ? { status } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          createdBy: { select: { email: true, role: true } },
          assignedTo: { select: { email: true } },
          _count: { select: { messages: true } },
        },
      });
    }
    const userFranchiseId = user.franchiseId ?? user.franchiseOwnerId;
    if (franchiseHasReadAccess(user.role) && userFranchiseId) {
      return this.prisma.supportTicket.findMany({
        where: { franchiseId: userFranchiseId, ...(status ? { status } : {}) },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          createdBy: { select: { email: true, role: true } },
          assignedTo: { select: { email: true } },
          _count: { select: { messages: true } },
        },
      });
    }
    return [];
  }

  async listWithFilter(user: JwtUser, query: TicketQueryDto) {
    const q: any = query ?? {};

    const clauses: Record<string, unknown>[] = [];

    // Build search filter for ticket fields
    const searchFilter = buildPrismaTextSearchFilter(q.search, ['subject']);

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    // Add priority filter if provided
    if (query.priority) {
      clauses.push({ priority: q.priority });
    }

    // Add status filter if provided
    if (q.status) {
      clauses.push({ status: q.status });
    }

    if (user.role === Role.CUSTOMER) {
      clauses.push({ createdByUserId: user.sub });
    } else if (
      user.role !== Role.SUPERADMIN &&
      user.role !== Role.ADMIN_STAFF
    ) {
      clauses.push({ franchiseId: user.franchiseId ?? user.franchiseOwnerId });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const orderBy = this.buildSupportTicketSortOrder(q.sortBy, q.order);

    const cacheKey = `support-ticket:page=${page}:limit=${limit}:order=${q.order ?? ''}:sortBy=${q.sortBy ?? ''}:search=${encodeURIComponent(
      String(q.search ?? ''),
    )}:status=${q.status ?? ''}:kycStatus=${q.kycStatus ?? ''}`;

    let cached: any = null;
    try {
      cached = await this.redisService.get<{
        data: SupportTicket[];
        meta: IMeta;
      }>(cacheKey);
    } catch (err) {
      // Direct PostgreSQL fallback
    }

    if (cached) {
      return cached;
    }

    // Determine include fields based on user role
    const include =
      user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF
        ? {
          franchise: { select: { id: true, name: true, code: true } },
          createdBy: { select: { email: true, role: true } },
          assignedTo: { select: { email: true } },
          _count: { select: { messages: true } },
        }
        : {
          createdBy: { select: { email: true, role: true } },
          assignedTo: { select: { email: true } },
          _count: { select: { messages: true } },
        };

    const result = await paginatePrisma<any>({
      model: this.prisma.supportTicket as any,
      where,
      orderBy,
      page,
      limit,
      include,
    });

    return result;
    // // Build where clause based on user role
    // let where: Record<string, unknown> = { ...searchFilter, ...clauses };

    // // Add franchise filter based on user role
    // if (user.role === Role.SUPERADMIN) {
    //   // Superadmin can see all tickets
    // } else if (franchiseHasReadAccess(user.role) && user.franchiseId) {
    //   where.franchiseId = user.franchiseId;
    // } else {
    //   // No access
    //   return {
    //     data: [],
    //     meta: {
    //       count: 0,
    //       totalPages: 0,
    //       page: 1,
    //       limit: limit || 10,
    //     },
    //   };
    // }

    // // Build sort order
    // const orderBy = buildSortOrder(
    //   sortBy,
    //   order as OrderType,
    //   [SortBy.CREATED_AT, SortBy.PRIORITY],
    //   SortBy.CREATED_AT,
    // );

    // // Determine include fields based on user role
    // const include =
    //   user.role === Role.SUPERADMIN
    //     ? {
    //         franchise: { select: { id: true, name: true, code: true } },
    //         createdBy: { select: { email: true, role: true } },
    //         assignedTo: { select: { email: true } },
    //         _count: { select: { messages: true } },
    //       }
    //     : {
    //         createdBy: { select: { email: true, role: true } },
    //         assignedTo: { select: { email: true } },
    //         _count: { select: { messages: true } },
    //       };

    // // Use pagination utility
    // return paginatePrisma({
    //   model: this.prisma.supportTicket,
    //   where,
    //   orderBy,
    //   page,
    //   limit,
    //   include,
    // });
  }

  async getById(id: string, user: JwtUser) {
    const row = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        franchise: { select: { id: true, name: true, code: true } },
        createdBy: { select: { email: true, role: true } },
        assignedTo: { select: { email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { email: true, role: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF) {
      return row;
    }
    if (user.role === Role.CUSTOMER) {
      if (row.createdByUserId !== user.sub) {
        throw new ForbiddenException();
      }
      return {
        ...row,
        messages: row.messages.filter((m) => !m.isInternal),
      };
    }
    if (
      // franchiseHasReadAccess(user.role) &&
      user.franchiseId === row.franchiseId ||
      user.franchiseOwnerId === row.franchiseId
    ) {
      return {
        ...row,
        messages: row.messages.filter((m) => !m.isInternal),
      };
    }
    throw new ForbiddenException();
  }

  async addMessage(
    id: string,
    dto: AddTicketMessageDto,
    user: JwtUser,
    ip?: string,
  ) {
    const row = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Ticket not found');
    const internal =
      !!dto.isInternal &&
      (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF);
    if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF) {
      // ok
    } else if (user.role === Role.CUSTOMER) {
      if (row.createdByUserId !== user.sub) {
        throw new ForbiddenException();
      }
      if (dto.isInternal) {
        throw new ForbiddenException();
      }
    } else if (
      // franchiseHasReadAccess(user.role) &&
      user.adminOwnerId === row.franchiseId ||
      user.franchiseId === row.franchiseId ||
      user.franchiseOwnerId === row.franchiseId
    ) {
      if (dto.isInternal) {
        throw new ForbiddenException();
      }
    } else {
      throw new ForbiddenException();
    }
    // if (user.role !== Role.SUPERADMIN && user.role === Role.FRANCHISE_AUDITOR) {
    //   throw new ForbiddenException('Read-only role');
    // }
    if (
      user.role !== Role.SUPERADMIN &&
      user.role !== Role.ADMIN_STAFF &&
      (user.role === Role.FRANCHISE_OWNER ||
        user.role === Role.FRANCHISE_STAFF ||
        user.role === Role.CUSTOMER)
    ) {
      if (
        row.status === SupportTicketStatus.CLOSED ||
        row.status === SupportTicketStatus.RESOLVED
      ) {
        throw new BadRequestException('Ticket is closed');
      }
    }
    await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        authorUserId: user.sub,
        body: dto.body.trim(),
        isInternal: internal,
      },
    });
    const updatedTicket = await this.getById(id, user);

    if (!internal && updatedTicket) {
      const messageSnippet =
        dto.body.trim().substring(0, 60) +
        (dto.body.trim().length > 60 ? '...' : '');
      const isSenderAdmin =
        user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;

      if (isSenderAdmin) {
        const franchiseUsers = row.franchiseId
          ? await this.prisma.user.findMany({
            where: {
              franchiseId: row.franchiseId,
              role: { in: [Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF] },
            },
            select: { id: true },
          })
          : [];
        const recipientIds = [
          row.createdByUserId,
          ...franchiseUsers.map((u) => u.id),
        ];

        void this.sendSupportNotification(
          recipientIds,
          'New Message on Support Ticket',
          `Support Team: "${messageSnippet}"`,
          {
            ticketId: row.id,
            franchiseId: row.franchiseId,
          },
          user.sub,
        );
      } else {
        const title = 'New Message on Support Ticket';
        const franchiseName =
          (updatedTicket as any).franchise?.name || 'Unknown';
        const body = `Franchise ${franchiseName}: "${messageSnippet}"`;

        if (row.assignedToUserId) {
          void this.sendSupportNotification(
            [row.assignedToUserId],
            title,
            body,
            {
              ticketId: row.id,
              franchiseId: row.franchiseId,
            },
            user.sub,
          );
        } else {
          void this.notifyAdmins(
            title,
            body,
            {
              ticketId: row.id,
              franchiseId: row.franchiseId,
            },
            user.sub,
          );
        }

        // Also notify the customer (creator) and other franchise users
        const franchiseUsers = row.franchiseId
          ? await this.prisma.user.findMany({
            where: {
              franchiseId: row.franchiseId,
              role: { in: [Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF] },
            },
            select: { id: true },
          })
          : [];
        const otherRecipientIds = [
          row.createdByUserId,
          ...franchiseUsers.map((u) => u.id),
        ];

        void this.sendSupportNotification(
          otherRecipientIds,
          'New Message on Support Ticket',
          `New message on ticket: "${messageSnippet}"`,
          {
            ticketId: row.id,
            franchiseId: row.franchiseId,
          },
          user.sub,
        );
      }
    }

    if (updatedTicket) {
      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'SUPPORT_TICKET_MESSAGE_ADDED_UPDATE',
          resource: 'SupportTicket',
          resourceId: id,
          metadata: {
            role: user.role,
            body: dto.body,
            isInternal: internal
          },
          ip,
        }),
        'SUPPORT_TICKET_MESSAGE_ADDED_UPDATE',
      );
    }

    return updatedTicket;
  }

  async updateTicket(
    id: string,
    dto: UpdateSupportTicketDto,
    user?: JwtUser,
    ip?: string,
  ) {
    const originalTicket = await this.prisma.supportTicket.findUniqueOrThrow({
      where: { id },
    });
    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.assignedToUserId !== undefined
          ? { assignedToUserId: dto.assignedToUserId }
          : {}),
      },
      include: {
        franchise: { select: { id: true, name: true, code: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { email: true, role: true } } },
        },
      },
    });

    if (updatedTicket) {
      let statusDesc = '';
      if (dto.status !== undefined && dto.status !== originalTicket.status) {
        statusDesc = `status updated to ${dto.status}`;
      }
      if (
        dto.priority !== undefined &&
        dto.priority !== originalTicket.priority
      ) {
        statusDesc = statusDesc
          ? `${statusDesc} and priority updated to ${dto.priority}`
          : `priority updated to ${dto.priority}`;
      }

      const bodyDesc = statusDesc
        ? `Support ticket "${updatedTicket.subject}" ${statusDesc}.`
        : `Support ticket "${updatedTicket.subject}" has been updated by support team.`;

      void this.notifyFranchiseUsers(
        updatedTicket.franchiseId,
        'Support Ticket Updated',
        bodyDesc,
        {
          ticketId: updatedTicket.id,
          franchiseId: updatedTicket.franchiseId,
        },
      );

      if (
        dto.assignedToUserId &&
        dto.assignedToUserId !== originalTicket.assignedToUserId
      ) {
        void this.sendSupportNotification(
          [dto.assignedToUserId],
          'Assigned Support Ticket',
          `You have been assigned to support ticket "${updatedTicket.subject}".`,
          {
            ticketId: updatedTicket.id,
            franchiseId: updatedTicket.franchiseId,
          },
        );
      }
    }

    if (user && updatedTicket) {
      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'SUPPORT_TICKET_UPDATED',
          resource: 'SupportTicket',
          resourceId: id,
          metadata: JSON.parse(JSON.stringify(dto)),
          ip,
        }),
        'SUPPORT_TICKET_UPDATED',
      );
    }

    return updatedTicket;
  }

  private async sendSupportNotification(
    userIds: string[],
    title: string,
    body: string,
    metadata?: Record<string, any>,
    excludeUserId?: string,
  ) {
    try {
      let filteredIds = userIds.filter(Boolean);
      if (excludeUserId) {
        filteredIds = filteredIds.filter((id) => id !== excludeUserId);
      }
      const uniqueUserIds = Array.from(new Set(filteredIds));
      for (const userId of uniqueUserIds) {
        await this.notificationService.notify({
          userId,
          title,
          body,
          type: NotificationType.SUPPORT,
          metadata,
        });
      }
    } catch (error: any) {
      console.error(
        `[SupportTicketsService] Failed to send support notification: ${error.message}`,
        error.stack,
      );
    }
  }

  private async notifyAdmins(
    title: string,
    body: string,
    metadata?: any,
    excludeUserId?: string,
  ) {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          role: { in: [Role.SUPERADMIN, Role.ADMIN_STAFF] },
        },
        select: { id: true },
      });
      const adminIds = admins.map((admin) => admin.id);
      await this.sendSupportNotification(
        adminIds,
        title,
        body,
        metadata,
        excludeUserId,
      );
    } catch (error: any) {
      console.error(
        `[SupportTicketsService] Failed to notify admins: ${error.message}`,
      );
    }
  }

  private async notifyFranchiseUsers(
    franchiseId: string,
    title: string,
    body: string,
    metadata?: any,
    excludeUserId?: string,
  ) {
    try {
      const franchiseUsers = await this.prisma.user.findMany({
        where: {
          franchiseId,
          role: { in: [Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF] },
        },
        select: { id: true },
      });
      const userIds = franchiseUsers.map((u) => u.id);
      await this.sendSupportNotification(
        userIds,
        title,
        body,
        metadata,
        excludeUserId,
      );
    } catch (error: any) {
      console.error(
        `[SupportTicketsService] Failed to notify franchise users: ${error.message}`,
      );
    }
  }
}
