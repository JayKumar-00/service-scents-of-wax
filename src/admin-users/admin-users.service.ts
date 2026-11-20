import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { AdminUserQueryDto } from './dto/admin-user.query.dto';
import { AuditService } from 'src/audit/audit.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { buildPrismaTextSearchFilter } from 'src/common/utils/search.util';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query?: AdminUserQueryDto): Promise<{
    data: {
      id: string;
      email: string;
      role: Role;
      franchiseId: string | null;
      franchise: { name: string; code: string } | null;
      createdAt: Date;
    }[];
    meta: IMeta;
  }> {
    const q: any = query ?? {};

    const clauses: Record<string, unknown>[] = [];

    const searchFilter = buildPrismaTextSearchFilter(q.search, ['email']);
    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (q.role) {
      clauses.push({ role: q.role });
    }

    if (q.franchiseId) {
      clauses.push({ franchiseId: q.franchiseId });
    }

    if (q.email) {
      clauses.push({
        email: { equals: q.email.trim(), mode: 'insensitive' },
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const allowedSortFields = ['createdAt', 'email'];
    const orderBy = buildSortOrder(q.sortBy, q.order, allowedSortFields);

    return paginatePrisma<{
      id: string;
      email: string;
      role: Role;
      franchiseId: string | null;
      franchise: { name: string; code: string } | null;
      createdAt: Date;
    }>({
      model: this.prisma.user as any,
      where,
      orderBy,
      page,
      limit,
      select: {
        id: true,
        email: true,
        role: true,
        franchiseId: true,
        franchise: { select: { name: true, code: true } },
        createdAt: true,
      },
    });
  }

  async invite(dto: InviteUserDto, actor?: JwtUser, ip?: string) {
    if (dto.role === Role.CUSTOMER) {
      throw new BadRequestException('Use public registration for customers');
    }
    if (
      (dto.role === Role.FRANCHISE_OWNER ||
        dto.role === Role.FRANCHISE_STAFF ||
        dto.role === Role.FRANCHISE_AUDITOR) &&
      !dto.franchiseId
    ) {
      throw new BadRequestException('Franchise roles require franchiseId');
    }
    if (dto.role === Role.SUPERADMIN && dto.franchiseId) {
      throw new BadRequestException('Superadmin cannot be tied to a franchise');
    }
    if (dto.franchiseId) {
      const f = await this.prisma.franchise.findUnique({
        where: { id: dto.franchiseId },
      });
      if (!f) {
        throw new NotFoundException('Franchise not found');
      }
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        franchiseId: dto.franchiseId ?? null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseId: true,
        createdAt: true,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: actor?.sub ?? user.id, // Fall back to invited user's own ID if no actor is passed
        action: 'CREATE',
        resource: 'USER',
        resourceId: user.id,
        metadata: {
          invitedEmail: user.email,
          invitedRole: user.role,
          franchiseId: user.franchiseId,
        },
        ip,
      }),
      'ADMIN_USER_INVITE',
    );

    return user;
  }
}
