import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { JwtService } from '@nestjs/jwt';
import { BusinessType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AppRoleSnapshot } from 'src/common/types/rbac.types';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from './types/jwt-user.type';
// import { LoginDto } from './dto/login.dto';
// import { RegisterDto } from './dto/register.dto';
import { FRANCHISE_ROLES } from 'src/users/franchise/franchise.service';
import { LoginDto, RecoveryDto } from './dto/user.dto';
import { OtpService } from 'src/otp/otp.service';
import { UpsertAdminProfileDto } from 'src/auth/dto/upsert-admin-profile.dto';
import { AuditService } from 'src/audit/audit.service';
import { RedisService } from 'src/redis/redis.service';

const ADMIN_AUTH_ROLES: Role[] = [Role.SUPERADMIN, Role.ADMIN_STAFF];

type AuthUserRecord = {
  id: string;
  isActive?: boolean;
  email: string;
  role: Role;
  franchiseId: string | null;
  adminId: string | null;
  franchiseOwnerId: string | null;
  appRole: {
    id: string;
    roleName: string;
    description: string | null;
    isActive: boolean;
    isSystem: boolean;
    franchiseId: string | null;
    permissions: {
      moduleName: string;
      actions: string[];
      scope: string;
    }[];
  } | null;
};

@Injectable({ scope: Scope.REQUEST })
export class AuthService {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otpService: OtpService,
    private readonly audit: AuditService,
    private readonly redisService: RedisService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isAdminAuthRole(role: Role): boolean {
    return ADMIN_AUTH_ROLES.includes(role);
  }

  private ensureAdminAuthRole(role: Role): void {
    if (!this.isAdminAuthRole(role)) {
      throw new ForbiddenException('Only admin users can access this route');
    }
  }

  private ensureUserCanLogin(user: AuthUserRecord) {
    const { role, appRole } = user;

    if (role !== Role.SUPERADMIN && role !== Role.ADMIN_STAFF) {
      throw new ForbiddenException(
        'Only admin users can access this platform. Please contact support for more information.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account is currently inactive. Please contact support for more platoform team.',
      );
    }

    if (role === Role.ADMIN_STAFF) {
      if (appRole && !appRole.isActive) {
        throw new ForbiddenException(
          'Your account is currently inactive. Please contact your administrator for more information.',
        );
      }
    }

    return;
  }

  async register(dto: any) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.CUSTOMER,
      },
    });
    fireAndForget(
      this.audit.log({
        userId: user.id,
        action: 'USER_REGISTER',
        resource: 'USER',
        resourceId: user.id,
        metadata: { email: user.email },
      }),
      'USER_REGISTER',
    );
    return this.issueTokens(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        franchiseId: null,
        adminId: null,
        franchiseOwnerId: null,
        appRole: null,
      },
      user.id,
    );
  }

  async login(dto: LoginDto, ip?: string) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        deletedAt: true,
        franchiseId: true,
        adminId: true,
        franchiseOwnerId: true,
        appRole: {
          select: {
            id: true,
            roleName: true,
            description: true,
            isActive: true,
            isSystem: true,
            franchiseId: true,
            permissions: {
              select: {
                moduleName: true,
                actions: true,
                scope: true,
              },
            },
          },
        },
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.ensureUserCanLogin(user);

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const clientIp = this.request?.ip;
    const userAgent = this.request?.headers?.['user-agent'] as
      | string
      | undefined;

    fireAndForget(
      this.audit.log({
        userId: user.id,
        action: 'USER_LOGIN_AUTH',
        resource: 'USER',
        resourceId: user.id,
        metadata: { email: user.email },
        ip: clientIp || ip,
        userAgent,
      }),
      'USER_LOGIN',
    );
    return this.issueTokens(
      user,
      user.role === Role.CUSTOMER ? user.id : undefined,
    );
  }

  async getMe(user: JwtUser) {
    const cacheKey = `user:getme:${user.sub}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored
    }

    const result = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseId: true,
        adminId: true,
        franchise: true,
        franchiseOwnerId: true,
        appRole: {
          select: {
            id: true,
            roleName: true,
            description: true,
            isActive: true,
            isSystem: true,
            franchiseId: true,
            permissions: {
              select: {
                moduleName: true,
                actions: true,
                scope: true,
              },
            },
          },
        },
        adminProfile: true,
      },
    });
    if (result === null) {
      return null;
    }

    let responseData: any;
    if (result.role === Role.SUPERADMIN) {
      responseData = {
        sub: result.id,
        email: result.email,
        role: result.role,
        franchise: result.franchise,
        franchiseId: result.franchiseId ?? undefined,
        adminOwnerId: result.adminId ?? undefined,
        franchiseOwnerId: result.franchiseOwnerId ?? undefined,
        appRole: {
          id: result.appRole?.id ?? 'superadmin',
          roleName: 'Platfom Owner',
          description:
            'Superadmin has full access to all resources and permissions.',
          isActive: true,
          isSystem: true,
          franchiseId: null,
          permissions: [],
        },
        profile: result.adminProfile,
      };
    } else {
      responseData = {
        ...this.buildJwtUser(result),
        profile: result.adminProfile,
      };
    }

    fireAndForget(
      this.redisService.set(cacheKey, responseData, 300),
      'cache user getme',
    );

    return responseData;
  }

  async requestPasswordReset(email: string) {
    const normalized = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, role: true },
    });
    if (!user || user.role !== Role.CUSTOMER) {
      return { ok: true as const };
    }
    const raw = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hash,
        passwordResetExpires: new Date(Date.now() + 3_600_000),
      },
    });
    const debug = process.env.PASSWORD_RESET_DEBUG === '1';
    return { ok: true as const, ...(debug ? { resetToken: raw } : {}) };
  }

  async resetPassword(token: string, newPassword: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: hash,
        passwordResetExpires: { gt: new Date() },
        role: Role.CUSTOMER,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });
    fireAndForget(
      this.audit.log({
        userId: user.id,
        action: 'PASSWORD_RESET',
        resource: 'USER',
        resourceId: user.id,
        metadata: { email: user.email },
      }),
      'PASSWORD_RESET',
    );
    fireAndForget(
      this.redisService.del([
        `user:session:${user.id}`,
        `user:getme:${user.id}`,
      ]),
      'password reset session clear',
    );
    return { ok: true as const };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ip?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, passwordHash: true, email: true },
    });
    if (!user || user.role !== Role.CUSTOMER) {
      throw new ForbiddenException();
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });
    fireAndForget(
      this.audit.log({
        userId: user.id,
        action: 'PASSWORD_CHANGE',
        resource: 'USER',
        resourceId: user.id,
        metadata: { email: user.email },
        ip,
      }),
      'PASSWORD_CHANGE',
    );
    fireAndForget(
      this.redisService.del([
        `user:session:${user.id}`,
        `user:getme:${user.id}`,
      ]),
      'password change session clear',
    );
    return { ok: true as const };
  }

  async upsertAdminProfile(
    userId: string,
    dto: UpsertAdminProfileDto,
    ip: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        adminId: true,
        adminProfile: { select: { id: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    this.ensureAdminAuthRole(user.role);

    const isCreate = !user.adminProfile;

    if (isCreate) {
      const requiredOnCreate: Array<keyof UpsertAdminProfileDto> = [
        'name',
        'companyName',
        'addressLine1',
        'city',
        'state',
        'country',
        'pincode',
      ];

      const missing = requiredOnCreate.filter((key) => {
        const value = dto[key];
        return typeof value !== 'string' || value.trim().length === 0;
      });

      if (missing.length > 0) {
        throw new BadRequestException(
          `Missing required profile fields for create: ${missing.join(', ')}`,
        );
      }
    }

    const profile = isCreate
      ? await this.prisma.adminProfile.create({
          data: {
            userId,
            name: dto.name!,
            designation: dto.designation,
            profileImage: dto.profileImage,
            companyName: dto.companyName!,
            companyLogo: dto.companyLogo,
            companyEmail: dto.companyEmail,
            companyPhone: dto.companyPhone,
            gstNumber: dto.gstNumber,
            panNumber: dto.panNumber,
            businessType: dto.businessType ?? BusinessType.OTHER,
            website: dto.website,
            addressLine1: dto.addressLine1!,
            addressLine2: dto.addressLine2,
            city: dto.city!,
            state: dto.state!,
            country: dto.country!,
            pincode: dto.pincode!,
            timezone: dto.timezone,
            currency: dto.currency,
            isActive: dto.isActive ?? true,
            deletedAt: dto.deletedAt,
          },
          select: {
            id: true,
            userId: true,
            name: true,
            designation: true,
            profileImage: true,
            companyName: true,
            companyLogo: true,
            companyEmail: true,
            companyPhone: true,
            gstNumber: true,
            panNumber: true,
            businessType: true,
            website: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            country: true,
            pincode: true,
            timezone: true,
            currency: true,
            isActive: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : await this.prisma.adminProfile.update({
          where: { userId },
          data: {
            name: dto.name,
            designation: dto.designation,
            profileImage: dto.profileImage,
            companyName: dto.companyName,
            companyLogo: dto.companyLogo,
            companyEmail: dto.companyEmail,
            companyPhone: dto.companyPhone,
            gstNumber: dto.gstNumber,
            panNumber: dto.panNumber,
            businessType: dto.businessType,
            website: dto.website,
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2,
            city: dto.city,
            state: dto.state,
            country: dto.country,
            pincode: dto.pincode,
            timezone: dto.timezone,
            currency: dto.currency,
            isActive: dto.isActive,
            deletedAt: dto.deletedAt,
          },
          select: {
            id: true,
            userId: true,
            name: true,
            designation: true,
            profileImage: true,
            companyName: true,
            companyLogo: true,
            companyEmail: true,
            companyPhone: true,
            gstNumber: true,
            panNumber: true,
            businessType: true,
            website: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            country: true,
            pincode: true,
            timezone: true,
            currency: true,
            isActive: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

    if (user.adminId !== profile.id) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { adminId: profile.id },
      });
    }

    fireAndForget(
      this.audit.log({
        userId: user.id,
        action: 'PROFILE_UPDATE',
        resource: 'USER',
        resourceId: user.id,
        metadata: {
          from: JSON.stringify({ user: user, profile }),
          to: JSON.stringify(dto),
        },
        ip,
      }),
      'ACCOUNT_RECOVERY',
    );

    fireAndForget(
      this.redisService.del([`user:session:${userId}`, `user:getme:${userId}`]),
      'upsert admin profile session clear',
    );

    return profile;
  }

  async requestAdminPasswordReset(email: string) {
    const normalized = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, role: true },
    });

    if (!user || !this.isAdminAuthRole(user.role)) {
      return { ok: true as const };
    }

    const raw = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hash,
        passwordResetExpires: new Date(Date.now() + 3_600_000),
      },
    });

    const debug = process.env.PASSWORD_RESET_DEBUG === '1';
    return { ok: true as const, ...(debug ? { resetToken: raw } : {}) };
  }

  async resetAdminPassword(token: string, newPassword: string, ip: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: hash,
        passwordResetExpires: { gt: new Date() },
        role: { in: ADMIN_AUTH_ROLES },
      },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.id,
        action: 'PASSWORD_RESET_UPDATE',
        resource: 'USER',
        resourceId: user.id,
        metadata: { user: JSON.stringify({ ...user, passwordHash: 'XXXXXX' }) },
        ip,
      }),
      'RESET_PASSWORD',
    );

    return { ok: true as const };
  }

  async changeAdminPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ip: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, passwordHash: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    this.ensureAdminAuthRole(user.role);

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.id,
        action: 'PASSWORD_CHANGE_UPDATE',
        resource: 'USER',
        resourceId: user.id,
        metadata: { user: JSON.stringify({ ...user, passwordHash: 'XXXXXX' }) },
        ip,
      }),
      'PASSWORD_CHANGE',
    );

    return { ok: true as const };
  }

  async requestAccountRecoveryOtp(email: string) {
    const normalized = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, role: true },
    });

    if (!user || !this.isAdminAuthRole(user.role)) {
      return { ok: true as const };
    }

    const { otp, valid } = await this.otpService.generateOtp({
      email: normalized,
      purpose: 'account-recovery',
    });
    const debug = process.env.PASSWORD_RESET_DEBUG === '1';

    return {
      ok: true as const,
      validMinutes: valid,
      ...(debug ? { otp } : {}),
    };
  }

  async accountRecovery(dto: RecoveryDto, ip?: string) {
    const normalized = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseId: true,
        adminId: true,
        franchiseOwnerId: true,
        appRole: {
          select: {
            id: true,
            roleName: true,
            description: true,
            isActive: true,
            isSystem: true,
            franchiseId: true,
            permissions: {
              select: {
                moduleName: true,
                actions: true,
                scope: true,
              },
            },
          },
        },
        adminProfile: {
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!user || !this.isAdminAuthRole(user.role)) {
      throw new NotFoundException('Admin account not found');
    }

    const otpValid = await this.otpService.verifyOtpByEmail(
      normalized,
      dto.otp,
      'account-recovery',
    );
    if (!otpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    if (
      user.adminProfile &&
      (!user.adminProfile.isActive || user.adminProfile.deletedAt)
    ) {
      await this.prisma.adminProfile.update({
        where: { userId: user.id },
        data: {
          isActive: true,
          deletedAt: null,
        },
      });
    }

    if (user.adminProfile && user.adminId !== user.adminProfile.id) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { adminId: user.adminProfile.id },
      });
      user.adminId = user.adminProfile.id;
    }

    fireAndForget(
      this.audit.log({
        userId: user.id,
        action: 'PROFILE_UPDATE',
        resource: 'USER',
        resourceId: user.id,
        metadata: {
          from: JSON.stringify({
            id: user.id,
            email: user.email,
            status: user.adminProfile?.isActive,
          }),
          to: JSON.stringify({ id: user.id, email: user.email, status: true }),
        },
        ip,
      }),
      'ACCOUNT_RECOVERY',
    );
    fireAndForget(
      this.redisService.del([
        `user:session:${user.id}`,
        `user:getme:${user.id}`,
      ]),
      'account recovery session clear',
    );
    return this.issueTokens(user);
  }

  private buildAppRoleSnapshot(
    appRole: AuthUserRecord['appRole'],
  ): AppRoleSnapshot | null {
    if (!appRole) {
      return null;
    }

    const convertedPermissions = appRole.permissions.map((permission) => ({
      canCreate: permission.actions.includes('CREATE'),
      canRead: permission.actions.includes('READ'),
      canUpdate: permission.actions.includes('UPDATE'),
      canDelete: permission.actions.includes('DELETE'),
      canExport: permission.actions.includes('EXPORT'),
      moduleName: permission.moduleName,
    }));

    return {
      id: appRole.id,
      roleName: appRole.roleName,
      description: appRole.description,
      isActive: appRole.isActive,
      isSystem: appRole.isSystem,
      franchiseId: appRole.franchiseId,
      permissions: convertedPermissions,
    };
  }

  private buildJwtUser(user: AuthUserRecord): JwtUser {
    const franchiseId =
      user.franchiseId ??
      (user.role === Role.FRANCHISE_STAFF ? user.id : undefined);

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      franchiseId,
      adminOwnerId: user.adminId ?? undefined,
      franchiseOwnerId: user.franchiseOwnerId ?? undefined,
      appRole: this.buildAppRoleSnapshot(user.appRole),
    };
  }

  private issueTokens(user: AuthUserRecord, customerId?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(FRANCHISE_ROLES.includes(user.role) && user.franchiseId
        ? { franchiseId: user.franchiseId }
        : {}),
      ...(user.role === Role.CUSTOMER && customerId ? { customerId } : {}),
      ...(user.adminId ? { adminOwnerId: user.adminId } : {}),
      ...(user.franchiseOwnerId
        ? { franchiseOwnerId: user.franchiseOwnerId }
        : {}),
    };

    const access_token = this.jwt.sign(payload);
    return {
      access_token,
      token_type: 'Bearer' as const,
      expires_in: 900,
      user: this.buildJwtUser(user),
    };
  }
}
