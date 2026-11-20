import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtUser } from '../auth/types/jwt-user.type';
import { OrderType } from '../common/dto/query.dto';
import { paginatePrisma } from '../common/utils/pagination.util';
import { buildPrismaTextSearchFilter } from '../common/utils/search.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AdminStaffQueryDto, StaffQueryDto } from './dto/staff-query.dto';
import {
  UpdateAdminStaffProfileDto,
  UpdateFranchiseStaffProfileDto,
  UpdateStaffDto,
} from './dto/update-staff.dto';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';
import { RedisService } from 'src/redis/redis.service';
import { randomUUID } from 'node:crypto';

const staffSelect = {
  id: true,
  isActive: true,
  email: true,
  role: true,
  franchiseId: true,
  franchiseOwnerId: true,
  roleId: true,
  createdAt: true,
  appRole: {
    select: {
      id: true,
      roleName: true,
      franchiseId: true,
      isActive: true,
      permissions: {
        select: {
          moduleName: true,
          actions: true,
          scope: true,
        },
      },
    },
  },
  staffFranchise: true,
  franchise: true,
  adminProfile: true,
} as const;

type StaffRecord = Prisma.UserGetPayload<{ select: typeof staffSelect }>;

type StaffListQuery = Pick<
  StaffQueryDto,
  'search' | 'franchiseId' | 'roleId' | 'page' | 'limit' | 'order'
>;

@Injectable()
export class StaffManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redisService: RedisService,
  ) { }

  private async resolveRole(roleId: string) {
    const role = await this.prisma.appRole.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        roleName: true,
        franchiseId: true,
        isSystem: true,
        isActive: true,
      },
    });

    if (!role) {
      throw new NotFoundException('AppRole not found');
    }

    if (!role.isActive) {
      throw new BadRequestException('AppRole is inactive');
    }

    return role;
  }

  private async resolveActorFranchiseId(actor: JwtUser) {
    if (actor.role === Role.FRANCHISE_STAFF && actor.franchiseOwnerId) {
      return actor.franchiseOwnerId;
    }
    if (actor.franchiseId) {
      return actor.franchiseId;
    }

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { franchiseId: true, franchiseOwnerId: true, role: true },
    });

    if (actorUser?.role === Role.FRANCHISE_STAFF) {
      return actorUser.franchiseOwnerId ?? null;
    }

    return actorUser?.franchiseId ?? null;
  }

  private async resolveActorFranchiseOrThrow(actor: JwtUser) {
    const franchiseId = await this.resolveActorFranchiseId(actor);

    if (!franchiseId) {
      throw new ForbiddenException('Franchise owner must have franchiseId');
    }

    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      select: { id: true },
    });

    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }

    return franchise.id;
  }

  private async resolveStaffOrThrow(id: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id },
      select: staffSelect,
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (
      staff.role !== Role.ADMIN_STAFF &&
      staff.role !== Role.FRANCHISE_STAFF
    ) {
      throw new BadRequestException('Target user is not a staff member');
    }

    if (staff.franchiseId && staff.franchiseId !== id) {
      throw new BadRequestException(
        'Target staff has invalid franchise association',
      );
    }

    return staff;
  }

  private async assertStaffScope(
    actor: JwtUser,
    staff: StaffRecord,
    id: string,
  ) {
    if (actor.sub === id) {
      throw new BadRequestException('You cannot modify your own staff record');
    }

    if (actor.role === Role.SUPERADMIN) {
      return;
    }

    if (
      actor.role !== Role.FRANCHISE_OWNER &&
      actor.role !== Role.FRANCHISE_STAFF
    ) {
      throw new ForbiddenException(
        'Only superadmin, franchise owner or franchise staff can manage staff',
      );
    }

    const actorFranchiseId = await this.resolveActorFranchiseId(actor);

    if (!actorFranchiseId) {
      throw new ForbiddenException('Franchise owner must have franchiseId');
    }

    if (staff.franchiseOwnerId !== actorFranchiseId) {
      throw new ForbiddenException(
        'Staff member belongs to a different franchise',
      );
    }
  }

  private async createStaff(actor: JwtUser, dto: CreateStaffDto, ip: string) {
    if (
      actor.role !== Role.SUPERADMIN &&
      actor.role !== Role.ADMIN_STAFF &&
      actor.role !== Role.FRANCHISE_OWNER &&
      actor.role !== Role.FRANCHISE_STAFF
    ) {
      throw new ForbiddenException(
        'Only superadmin, admin staff, franchise owner or franchise staff can create staff',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const role = await this.resolveRole(dto.roleId);
    let franchiseId: string | null = null;
    let franchiseOwnerId: string | null = null;
    let createdRole: Role;

    const actorFranchiseId = await this.resolveActorFranchiseId(actor);

    if (actor.role === Role.SUPERADMIN || actor.role === Role.ADMIN_STAFF) {
      if (role.franchiseId && role.franchiseId !== actorFranchiseId) {
        throw new BadRequestException(
          'Admin staff cannot be assigned a franchise-specific role',
        );
      }

      // franchiseId = actorFranchiseId;
      // franchiseOwnerId = null;
      createdRole = Role.ADMIN_STAFF;
    } else {
      if (!actorFranchiseId) {
        throw new ForbiddenException(
          'Franchise owner or staff must have franchiseId',
        );
      }

      if (role.franchiseId !== actorFranchiseId) {
        throw new ForbiddenException(
          'You can only assign roles from your franchise',
        );
      }

      franchiseId = actorFranchiseId;
      franchiseOwnerId = actorFranchiseId;
      createdRole = Role.FRANCHISE_STAFF;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        passwordHash,
        role: createdRole,
        franchiseId: createdRole === Role.FRANCHISE_STAFF ? null : franchiseId,
        franchiseOwnerId:
          createdRole === Role.FRANCHISE_STAFF
            ? (franchiseOwnerId ?? franchiseId)
            : null,
        roleId: role.id,
      },
      select: staffSelect,
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'STAFF_CREATE',
        resource: 'STAFF',
        resourceId: result.id,
        metadata: {
          created: JSON.stringify(result),
        },
        ip,
      }),
      'CREATE_STAFF',
    );

    return result;
  }

  createAdminStaff(
    actor: JwtUser,
    dto: CreateStaffDto,
    ip: string
  ) {
    if (actor.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmin can use this endpoint');
    }

    return this.createStaff(actor, dto, ip);
  }

  createFranchiseStaff(actor: JwtUser, dto: CreateStaffDto, ip: string) {
    if (
      actor.role !== Role.FRANCHISE_OWNER &&
      actor.role !== Role.FRANCHISE_STAFF
    ) {
      throw new ForbiddenException(
        'Only franchise owner or franchise staff can use this endpoint',
      );
    }

    return this.createFranchiseStaffOnly(actor, dto, ip);
  }

  private async createFranchiseStaffOnly(actor: JwtUser, dto: CreateStaffDto, ip: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const role = await this.resolveRole(dto.roleId);
    const franchiseOwnerId = await this.resolveActorFranchiseOrThrow(actor);

    if (role.franchiseId !== franchiseOwnerId) {
      throw new ForbiddenException(
        'You can only assign roles from your franchise',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        passwordHash,
        role: Role.FRANCHISE_STAFF,
        franchiseOwnerId,
        roleId: role.id,
      },
      select: staffSelect,
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'franchise_staff.create',
        resource: 'User',
        resourceId: result.id,
        metadata: {
          created: JSON.stringify(result),
        },
        ip,
      }),
      'CREATE_FRANCHISE_STAFF',
    );

    return result;
  }

  async listAdminStaff(actor: JwtUser, query: AdminStaffQueryDto) {
    const clauses: Prisma.UserWhereInput[] = [];

    const search = buildPrismaTextSearchFilter(query.search, [
      'email',
      'appRole.roleName',
      'franchiseOwner.ownerEmail',
    ]);

    if (Object.keys(search).length > 0) {
      clauses.push(search as Prisma.UserWhereInput);
    }

    const franchiseId = query.franchiseId?.trim();

    if (franchiseId) {
      clauses.push({ franchiseId });
    }

    const roleId = query.roleId?.trim();

    if (roleId) {
      clauses.push({ roleId });
    }

    clauses.push(
      query.role
        ? { role: query.role }
        : {
          role: {
            in: [Role.ADMIN_STAFF, Role.FRANCHISE_STAFF],
          },
        },
    );

    const where = { AND: clauses };
    return this.getPaginatedStaffWithStatusCounts(where, query);
  }

  private async getPaginatedStaffWithStatusCounts(
    where: Prisma.UserWhereInput,
    query: StaffListQuery | AdminStaffQueryDto,
  ) {
    const [statusCounts, paginatedResult] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['isActive'],
        where,
        _count: { id: true },
      }),
      paginatePrisma({
        model: this.prisma.user as any,
        where: where,
        page: query.page,
        limit: query.limit,
        orderBy: { createdAt: query.order ?? OrderType.DESC },
        select: staffSelect,
      }),
    ]);

    const activeStaffCount =
      statusCounts.find((s) => s.isActive)?._count.id ?? 0;
    const inactiveStaffCount =
      statusCounts.find((s) => !s.isActive)?._count.id ?? 0;

    (paginatedResult.meta as any).active = activeStaffCount;
    (paginatedResult.meta as any).inactive = inactiveStaffCount;

    return paginatedResult;
  }

  async listFranchiseStaff(actor: JwtUser, query: StaffListQuery) {
    if (
      actor.role !== Role.FRANCHISE_OWNER &&
      actor.role !== Role.FRANCHISE_STAFF
    ) {
      throw new ForbiddenException(
        'Only franchise owner or franchise staff can use this endpoint',
      );
    }

    const actorFranchiseId = await this.resolveActorFranchiseOrThrow(actor);

    const clauses: Prisma.UserWhereInput[] = [
      { role: Role.FRANCHISE_STAFF },
      { franchiseOwnerId: actorFranchiseId },
    ];

    const search = buildPrismaTextSearchFilter(query.search, [
      'email',
      'appRole.roleName',
    ]);
    if (Object.keys(search).length > 0) {
      clauses.push(search as Prisma.UserWhereInput);
    }

    const roleId = query.roleId?.trim();
    if (roleId) {
      clauses.push({ roleId });
    }

    const where = { AND: clauses };
    return this.getPaginatedStaffWithStatusCounts(where, query);
  }

  private async updateStaff(actor: JwtUser, id: string, dto: UpdateStaffDto, ip: string) {
    const staff = await this.resolveStaffOrThrow(id);
    await this.assertStaffScope(actor, staff, id);

    const nextEmail = dto.email?.trim().toLowerCase();
    if (nextEmail && nextEmail !== staff.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: nextEmail },
        select: { id: true },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    let nextRoleId = staff.roleId;
    let nextFranchiseId = staff.franchiseId;
    let nextFranchiseOwnerId = staff.franchiseOwnerId;
    let shouldUpdateFranchiseId = false;

    if (dto.roleId) {
      const role = await this.resolveRole(dto.roleId);

      if (
        actor.role === Role.FRANCHISE_OWNER ||
        actor.role === Role.FRANCHISE_STAFF
      ) {
        const actorFranchiseId = await this.resolveActorFranchiseId(actor);

        if (!actorFranchiseId || role.franchiseId !== actorFranchiseId) {
          throw new ForbiddenException(
            'You can only assign roles from your franchise',
          );
        }

        // nextFranchiseId = actorFranchiseId;
        nextFranchiseOwnerId = actorFranchiseId;
      } else {
        const actorFranchiseId = await this.resolveActorFranchiseId(actor);

        if (staff.role === Role.ADMIN_STAFF) {
          if (role.franchiseId && role.franchiseId !== actorFranchiseId) {
            throw new BadRequestException(
              'Admin staff cannot be assigned a franchise-specific role',
            );
          }
          nextFranchiseId = actorFranchiseId;
          nextFranchiseOwnerId = null;
        } else if (staff.role === Role.FRANCHISE_STAFF) {
          if (role.franchiseId !== staff.franchiseOwnerId) {
            throw new BadRequestException(
              'Role must match the franchise of the staff member',
            );
          }
          nextFranchiseId = null;
          nextFranchiseOwnerId = staff.franchiseOwnerId;
        }
        shouldUpdateFranchiseId = true;
      }

      nextRoleId = role.id;
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(nextRoleId ? { roleId: nextRoleId } : {}),
        ...(shouldUpdateFranchiseId && nextFranchiseId !== undefined
          ? { franchiseId: nextFranchiseId }
          : {}),
        ...(nextFranchiseOwnerId !== undefined
          ? { franchiseOwnerId: nextFranchiseOwnerId }
          : {}),
      },
      select: staffSelect,
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: staff.role === Role.ADMIN_STAFF ? 'admin_staff.update' : 'franchise_staff.update',
        resource: 'User',
        resourceId: id,
        metadata: {
          previous: JSON.stringify(staff),
          updated: JSON.stringify(updated),
        },
        ip,
      }),
      'UPDATE_STAFF_AUDIT',
    );

    fireAndForget(
      this.redisService.del([`user:session:${id}`, `user:getme:${id}`]),
      'update staff cache clear',
    );

    return updated;
  }

  async updateAdminStaff(actor: JwtUser, id: string, dto: UpdateStaffDto, ip: string) {
    return this.updateStaff(actor, id, dto, ip);
  }

  async updateFranchiseStaff(actor: JwtUser, id: string, dto: UpdateStaffDto, ip: string) {
    if (
      actor.role !== Role.FRANCHISE_OWNER &&
      actor.role !== Role.FRANCHISE_STAFF
    ) {
      throw new ForbiddenException(
        'Only franchise owner or franchise staff can use this endpoint',
      );
    }

    const staff = await this.resolveStaffOrThrow(id);
    const franchiseId = await this.resolveActorFranchiseOrThrow(actor);

    if (staff.franchiseOwnerId !== franchiseId) {
      throw new ForbiddenException(
        'Staff member belongs to a different franchise',
      );
    }

    return this.updateStaff(actor, id, dto, ip);
  }

  async toggleFranchiseStaffStatus(actor: JwtUser, id: string, ip: string) {
    if (
      actor.role !== Role.FRANCHISE_OWNER &&
      actor.role !== Role.FRANCHISE_STAFF
    ) {
      throw new ForbiddenException(
        'Only franchise owner or franchise staff can use this endpoint',
      );
    }

    const staff = await this.resolveStaffOrThrow(id);
    const franchiseId = await this.resolveActorFranchiseOrThrow(actor);

    if (staff.franchiseOwnerId !== franchiseId) {
      throw new ForbiddenException(
        'Staff member belongs to a different franchise',
      );
    }

    // Resolve current status
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { isActive: true },
    });

    const newStatus = !user.isActive;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: newStatus,
      },
      select: {
        ...staffSelect,
        isActive: true,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'franchise_staff.status.toggle',
        resource: 'User',
        resourceId: id,
        metadata: { isActive: newStatus } as any,
        ip,
      }),
    );

    fireAndForget(
      this.redisService.del([`user:session:${id}`, `user:getme:${id}`]),
      'toggle franchise staff status cache clear',
    );

    return updated;
  }

  async toggleAdminStaffStatus(actor: JwtUser, id: string, ip: string) {
    // Resolve current status
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { isActive: true },
    });

    const newStatus = !user.isActive;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: newStatus,
      },
      select: {
        ...staffSelect,
        isActive: true,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'franchise_staff.status.toggle',
        resource: 'User',
        resourceId: id,
        metadata: { isActive: newStatus } as any,
        ip,
      }),
    );

    fireAndForget(
      this.redisService.del([`user:session:${id}`, `user:getme:${id}`]),
      'toggle admin staff status cache clear',
    );

    return updated;
  }

  private async deleteStaff(actor: JwtUser, id: string, ip: string) {
    const staff = await this.resolveStaffOrThrow(id);
    await this.assertStaffScope(actor, staff, id);

    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: staff.role === Role.ADMIN_STAFF ? 'admin_staff.delete' : 'franchise_staff.delete',
        resource: 'User',
        resourceId: id,
        metadata: {
          deletedStaff: JSON.stringify(staff),
        },
        ip,
      }),
      'DELETE_STAFF_AUDIT',
    );

    fireAndForget(
      this.redisService.del([`user:session:${id}`, `user:getme:${id}`]),
      'delete staff cache clear',
    );

    return { success: true, id };
  }

  async deleteAdminStaff(actor: JwtUser, id: string, ip: string) {
    if (actor.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmin can use this endpoint');
    }

    return this.deleteStaff(actor, id, ip);
  }

  async deleteFranchiseStaff(actor: JwtUser, id: string, ip: string) {
    if (
      actor.role !== Role.FRANCHISE_OWNER &&
      actor.role !== Role.FRANCHISE_STAFF
    ) {
      throw new ForbiddenException(
        'Only franchise owner or franchise staff can use this endpoint',
      );
    }

    const staff = await this.resolveStaffOrThrow(id);
    const franchiseId = await this.resolveActorFranchiseOrThrow(actor);

    if (staff.franchiseOwnerId !== franchiseId) {
      throw new ForbiddenException(
        'Staff member belongs to a different franchise',
      );
    }

    return this.deleteStaff(actor, id, ip);
  }

  async upsertAdminStaffProfile(
    actor: JwtUser,
    adminStaffId: string,
    dto: UpdateAdminStaffProfileDto,
    ip: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.user.findUniqueOrThrow({
        where: { id: adminStaffId },

        include: {
          adminProfile: true,
        },
      });

      if (staff.role !== Role.ADMIN_STAFF) {
        throw new BadRequestException(
          'Target user is not an admin staff member',
        );
      }

      // Admin staff can only edit self
      if (actor.role === Role.ADMIN_STAFF && actor.sub !== adminStaffId) {
        throw new ForbiddenException('You can only update your own profile');
      }

      const existing = staff.adminProfile;

      // CREATE CASE
      if (!existing) {
        return tx.adminProfile.create({
          data: {
            userId: adminStaffId,

            name: dto.name!,
            code: `STAFF-FRC-${adminStaffId.slice(0, 8).toUpperCase()}-${randomUUID().toUpperCase()}`,
            designation: dto.designation,
            profileImage: dto.profileImage,

            companyName: dto.companyName!,

            addressLine1: dto.addressLine1!,
            addressLine2: dto.addressLine2,

            city: dto.city!,
            state: dto.state!,

            country: dto.country ?? 'India',
            pincode: dto.pincode ?? '495001',
          },
        });
      }

      // SAFE UPDATE BUILDER
      const data: Prisma.AdminProfileUpdateInput = {};

      const set = (
        key: keyof Prisma.AdminProfileUpdateInput,
        value: any,
        existingValue: any,
      ) => {
        if (value !== undefined && value !== existingValue) {
          data[key] = typeof value === 'string' ? value.trim() : value;
        }
      };

      set('name', dto.name, existing.name);

      set('designation', dto.designation, existing.designation);

      set('profileImage', dto.profileImage, existing.profileImage);

      set('companyName', dto.companyName, existing.companyName);

      set('addressLine1', dto.addressLine1, existing.addressLine1);

      set('addressLine2', dto.addressLine2, existing.addressLine2);

      set('city', dto.city, existing.city);

      set('state', dto.state, existing.state);

      set('country', dto.country, existing.country);

      set('pincode', dto.pincode, existing.pincode);

      // UPDATE ONLY IF NEEDED
      if (Object.keys(data).length > 0) {
        await tx.adminProfile.update({
          where: {
            userId: adminStaffId,
          },
          data,
        });
      }

      // SINGLE SOURCE OF TRUTH
      const profile = await tx.adminProfile.findUniqueOrThrow({
        where: { userId: adminStaffId },
      });

      // Upsert documents if provided
      const upsertedDocs: any[] = [];
      if (dto.documents && dto.documents.length > 0) {
        for (const d of dto.documents) {
          if (!d.kind) {
            throw new BadRequestException('Document kind is required');
          }

          const up = await tx.profileDocument.upsert({
            where: {
              ownerType_ownerId_kind: {
                ownerType: 'ADMIN_PROFILE',
                ownerId: profile.id,
                kind: d.kind,
              },
            },
            create: {
              ownerType: 'ADMIN_PROFILE',
              ownerId: profile.id,
              kind: d.kind,
              title: d.title,
              fileUrl: d.fileUrl,
              uploadedByUserId: actor.sub,
              expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined,
            },
            update: {
              title: d.title,
              fileUrl: d.fileUrl,
              expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
              uploadedByUserId: actor.sub,
            },
          });

          upsertedDocs.push(up);
        }
      }

      return { profile, documents: upsertedDocs };
    });

    // NON BLOCKING SIDE EFFECTS
    // NON BLOCKING SIDE EFFECTS
    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'admin_staff.profile.upsert',
        resource: 'AdminProfile',
        resourceId: result.profile.id,
        metadata: dto as unknown as Prisma.InputJsonValue,
        ip,
      }),
    );

    fireAndForget(
      this.redisService.del([
        `user:session:${adminStaffId}`,
        `user:getme:${adminStaffId}`,
      ]),
      'upsert admin staff profile session clear',
    );

    return result;
  }

  async upsertFranchiseStaffProfile(
    actor: JwtUser,
    franchiseStaffId: string,
    dto: UpdateFranchiseStaffProfileDto,
    ip: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.user.findUniqueOrThrow({
        where: {
          id: franchiseStaffId,
        },
        select: {
          id: true,
          role: true,
          franchiseId: true,
          franchiseOwnerId: true,
          staffFranchise: true,
        },
      });

      if (staff.role !== Role.FRANCHISE_STAFF) {
        throw new BadRequestException(
          'Target user is not a franchise staff member',
        );
      }

      if (
        actor.role === Role.FRANCHISE_STAFF &&
        actor.sub !== franchiseStaffId
      ) {
        throw new ForbiddenException('You can only update your own profile');
      }

      if (
        actor.role === Role.FRANCHISE_OWNER &&
        actor.franchiseId !== staff.franchiseOwnerId
      ) {
        throw new ForbiddenException('Unauthorized franchise or staff access');
      }

      const existingProfile = staff.staffFranchise;

      if (!existingProfile) {
        await tx.franchiseStaffProfile.create({
          data: {
            userId: franchiseStaffId,
            code: `STAFF-FRC-${franchiseStaffId.slice(0, 8).toUpperCase()}-${randomUUID().toUpperCase()}`,
            name: dto.name ?? null,
            designation: dto.designation ?? null,
            phoneNumber: dto.phoneNumber ?? null,
            aadharNumber: dto.aadharNumber ?? null,
            panNumber: dto.panNumber ?? null,
            profileImage: dto.profileImage ?? null,
            addressLine1: dto.addressLine1 ?? null,
            addressLine2: dto.addressLine2 ?? null,
            city: dto.city ?? null,
            state: dto.state ?? null,
            country: dto.country ?? null,
            pincode: dto.pincode ?? null,
          },
        });
      } else {
        const data: Prisma.FranchiseStaffProfileUpdateInput = {};

        const set = (
          key: keyof Prisma.FranchiseStaffProfileUpdateInput,
          value: string | undefined,
          existingValue: string | null | undefined,
        ) => {
          if (value !== undefined && value !== existingValue) {
            data[key] = value.trim();
          }
        };

        set('name', dto.name, existingProfile.name);
        set('designation', dto.designation, existingProfile.designation);
        set('phoneNumber', dto.phoneNumber, existingProfile.phoneNumber);
        set('aadharNumber', dto.aadharNumber, existingProfile.aadharNumber);
        set('panNumber', dto.panNumber, existingProfile.panNumber);
        set('profileImage', dto.profileImage, existingProfile.profileImage);
        set('addressLine1', dto.addressLine1, existingProfile.addressLine1);
        set('addressLine2', dto.addressLine2, existingProfile.addressLine2);
        set('city', dto.city, existingProfile.city);
        set('state', dto.state, existingProfile.state);
        set('country', dto.country, existingProfile.country);
        set('pincode', dto.pincode, existingProfile.pincode);

        if (Object.keys(data).length > 0) {
          await tx.franchiseStaffProfile.update({
            where: { userId: franchiseStaffId },
            data,
          });
        }
      }

      const profile = await tx.franchiseStaffProfile.findUniqueOrThrow({
        where: { userId: franchiseStaffId },
      });

      // Upsert profile documents against the staff user
      const upsertedDocs: any[] = [];
      if (dto.documents && dto.documents.length > 0) {
        for (const d of dto.documents) {
          if (!d.kind) {
            throw new BadRequestException('Document kind is required');
          }

          const up = await tx.profileDocument.upsert({
            where: {
              ownerType_ownerId_kind: {
                ownerType: 'FRANCHISE_STAFF',
                ownerId: franchiseStaffId,
                kind: d.kind,
              },
            },
            create: {
              ownerType: 'FRANCHISE_STAFF',
              ownerId: franchiseStaffId,
              kind: d.kind,
              title: d.title,
              fileUrl: d.fileUrl,
              uploadedByUserId: actor.sub,
              expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined,
            },
            update: {
              title: d.title,
              fileUrl: d.fileUrl,
              expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
              uploadedByUserId: actor.sub,
            },
          });

          upsertedDocs.push(up);
        }
      }

      return { profile, documents: upsertedDocs };
    });

    // =========================
    // AUDIT
    // =========================

    // NON BLOCKING SIDE EFFECTS
    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'franchise_staff.profile.upsert',
        resource: 'FranchiseStaffProfile',
        resourceId: result.profile.id,
        metadata: dto as unknown as Prisma.InputJsonValue,
        ip,
      }),
    );

    // CACHE INVALIDATION
    fireAndForget(
      this.redisService.del([
        `franchise`,
        `user:session:${franchiseStaffId}`,
        `user:getme:${franchiseStaffId}`,
      ]),
      'upsert franchise staff profile cache clear',
    );

    return result;
  }
}
