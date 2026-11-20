import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import {
  FranchiseStatus,
  Role,
  Prisma,
  DeliveryStatus,
  NotificationType,
  NotificationChannel,
  ProductStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { FranchiseProfileUpdateDto } from './dto/update-franchise.dto';
import { RegisterFranchiseDto } from './dto/register-franchise.dto';
import { FranchiseDocumentDto } from './dto/franchise-document.dto';
import { AppRoleSnapshot } from 'src/common/types/rbac.types';
import { addTotalCreditAmount } from 'src/common/utils/credit-serializer.util';
import {
  ChangePasswordDto,
  LoginDto,
  RecoveryDto,
  ResetPasswordDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from 'src/auth/dto/user.dto';
import { OtpService } from 'src/otp/otp.service';
import { ConfigService } from '@nestjs/config';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';
import { RedisService } from 'src/redis/redis.service';
import { BrevoService } from 'src/notification/services/brevo.service';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { SendOtpDto } from 'src/otp/dto/send-otp.dto';
import { OtpModeEnum } from 'src/otp/enums/otp-mode.enum';
import { OtpTemplate } from 'src/notification/templates/otp.template';
import { FranchiseInventoryQueryDto } from './dto/franchise-inventory-query.dto';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

type FranchiseAuthUser = {
  id: string;
  isActive?: boolean;
  email: string;
  role: Role;
  franchiseId: string | null;
  franchiseOwnerId: string | null;
  status: FranchiseStatus | null;
  passwordHash: string;
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

type FranchiseTokenUser = {
  id: string;
  email: string;
  role: Role;
  franchiseId: string | null;
  franchiseOwnerId: string | null;
  appRole?: FranchiseAuthUser['appRole'];
};

// Used for notification preferences
export const FRANCHISE_ROLES: Role[] = [
  Role.FRANCHISE_OWNER,
  Role.FRANCHISE_STAFF,
  Role.FRANCHISE_AUDITOR,
];

@Injectable({ scope: Scope.REQUEST })
export class FranchiseService {
  private readonly logger = new Logger(FranchiseService.name);
  private readonly franchiseStockProductSelect = {
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      imageUrls: true,
      basePrice: true,
      wholesalePrice: true,
      price: true,
      mrpPrice: true,
      category: { select: { name: true } },
      variants: true,
    },
  } as const;

  private readonly categoryWebListSelect = {
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      sortOrder: true,
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          sortOrder: true,
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
              parentId: true,
              sortOrder: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  parentId: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
    },
  } as const;

  private readonly franchiseProductWebListSelect = {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      mrpPrice: true,
      stock: true,
      isFeatured: true,
      fastDelivery: true,
      ratingAvg: true,
      reviewCount: true,
      viewCount: true,
      imageUrl: true,
      imageUrls: true,
      createdAt: true,
      category: this.categoryWebListSelect,
      brandRef: {
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      variants: {
        include: {
          attributes: {
            include: {
              attributeValue: {
                include: {
                  attributeName: true,
                },
              },
            },
          },
        },
      },
      seo: true,
      reservations: {
        where: { status: 'ACTIVE' },
        select: { quantity: true, note: true },
      },
    },
  } as const;

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otpService: OtpService,
    private readonly brevoService: BrevoService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
    private readonly redisService: RedisService,
    private readonly roleBasedNotificationService: RoleBasedNotificationService,
  ) {}

  private isMissingReservedColumn(err: unknown): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
    const missingColumns = [
      'FranchiseStock.reserved',
      'FranchiseStock.defectiveQuantity',
      'FranchiseStock.conflictQuantity',
    ];
    return (
      err.code === 'P2022' &&
      missingColumns.some((column) => String(err.message).includes(column))
    );
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private buildAutoFranchiseCode(userId: string) {
    return `AUTO-${userId
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-12)
      .toUpperCase()}`;
  }

  private mapFranchiseDocuments(
    documents: FranchiseDocumentDto[] | undefined,
    uploadedByUserId: string,
  ) {
    return (documents ?? []).map((document) => ({
      kind: document.kind,
      title: document.title.trim(),
      fileUrl: document.fileUrl.trim(),
      uploadedByUserId,
    }));
  }

  private async resolveFranchiseIdForAuth(
    user: Pick<FranchiseTokenUser, 'email' | 'franchiseId'>,
  ) {
    if (user.franchiseId) {
      return user.franchiseId;
    }

    const franchise = await this.prisma.franchise.findFirst({
      where: { ownerEmail: this.normalizeEmail(user.email) },
      select: { id: true },
    });

    return franchise?.id ?? null;
  }

  private async issueTokens(
    user: FranchiseTokenUser,
    extra?: {
      firebaseUid?: string | null;
      firebaseIdToken?: string | null;
      firebaseRefreshToken?: string | null;
      name?: string | null;
      avatar?: string | null;
      deviceId?: string;
      ip?: string;
    },
  ) {
    const franchiseId = await this.resolveFranchiseIdForAuth(user);
    const responseFranchiseId =
      user.role === Role.FRANCHISE_STAFF ? user.id : franchiseId;
    const appRoleSnapshot = this.buildAppRoleSnapshot(user.appRole ?? null);
    const appRole = appRoleSnapshot
      ? (() => {
          const { franchiseId: _franchiseId, ...rest } = appRoleSnapshot;
          return rest;
        })()
      : null;
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      franchiseId,
      // ...(appRole ? { appRole } : {}),
    };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, { expiresIn: '30d' });

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
        metadata: {
          email: user.email,
          role: user.role,
          franchiseId,
          loginType: extra?.firebaseUid ? 'FIREBASE' : 'PASSWORD_OR_OTP',
        },
        ip: clientIp,
        userAgent,
      }),
      'USER_LOGIN',
    );

    return {
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        franchiseId: responseFranchiseId,
        franchiseOwnerId: user.franchiseOwnerId ?? franchiseId,
        appRole:
          user.role === Role.FRANCHISE_OWNER
            ? {
                roleName: appRole?.roleName ?? 'Franchise Owner (Default)',
                description:
                  appRole?.description ??
                  'Default role with access to all franchise permissions',
                isActive: true,
              }
            : appRole,
      },
      accessToken,
      refreshToken,
    };
  }

  private buildAppRoleSnapshot(
    appRole: FranchiseAuthUser['appRole'],
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
      // isSystem: appRole.isSystem,
      franchiseId: appRole.franchiseId,
      permissions: convertedPermissions,
    };
  }

  private async resolveFranchiseForLogin(user: {
    email: string;
    franchiseId: string | null;
  }) {
    if (user.franchiseId) {
      return this.prisma.franchise.findUnique({
        where: { id: user.franchiseId },
        select: { id: true, status: true },
      });
    }

    return this.prisma.franchise.findFirst({
      where: { ownerEmail: this.normalizeEmail(user.email) },
      select: { id: true, status: true },
    });
  }

  private ensureFranchiseCanLogin(user: FranchiseAuthUser) {
    const { role, franchiseId, franchiseOwnerId, status, appRole } = user;

    // if (!user.isActive) {
    //   throw new ForbiddenException(
    //     'Your account is currently inactive. Please contact support for more platoform team.',
    //   );
    // }

    if (franchiseOwnerId && role === Role.FRANCHISE_STAFF) {
      if (appRole && !appRole.isActive && !user.isActive) {
        throw new ForbiddenException(
          'Your account is currently inactive. Please contact your franchise owner for more information.',
        );
      }
      return; // Staff can log in even if franchise status is not active, as long as they have access to the system. Their permissions will be enforced at the module level.
    }

    if (!franchiseId || !status) {
      throw new NotFoundException('Franchise not found or status not set');
    }

    if (!FRANCHISE_ROLES.includes(role)) {
      throw new ForbiddenException('Franchise access required');
    }

    if (status === FranchiseStatus.BLOCKED) {
      throw new ForbiddenException(
        'Account is blocked. Please contact support for more information.',
      );
    }

    if (status !== FranchiseStatus.ACTIVE) {
      throw new ForbiddenException(
        'Account not active yet. Please contact support for more information.',
      );
    }
  }

  private async findAuthUserByEmail(email: string) {
    const row = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseId: true,
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
        franchise: {
          select: {
            id: true,
            status: true,
          },
        },
        passwordHash: true,
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      franchiseId: row.franchise?.id ?? null,
      franchiseOwnerId: row.franchiseOwnerId,
      passwordHash: row.passwordHash,
      status: row.franchise?.status,
      appRole: row.appRole,
    } as FranchiseAuthUser;
  }

  private async findAuthUserByPhone(phone: string) {
    const normalizedPhone = phone.trim();
    const franchise = await this.prisma.franchise.findFirst({
      where: { ownerPhone: normalizedPhone },
      select: {
        id: true,
        status: true,
      },
    });

    if (!franchise) {
      return null;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        franchiseId: franchise.id,
        role: { in: FRANCHISE_ROLES },
      },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseId: true,
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
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      franchiseId: user.franchiseId ?? franchise.id,
      franchiseOwnerId: user.franchiseOwnerId,
      status: franchise.status,
      passwordHash: user.passwordHash,
      appRole: user.appRole,
    } as FranchiseAuthUser;
  }

  private ensureFranchiseRole(role: Role) {
    if (
      role !== Role.FRANCHISE_OWNER &&
      role !== Role.FRANCHISE_STAFF &&
      role !== Role.FRANCHISE_AUDITOR
    ) {
      throw new ForbiddenException('Franchise access required');
    }
  }

  firebaseAuth(_token: string) {
    console.log(`Received Firebase auth token: ${_token}`);
    throw new BadRequestException(
      'Firebase auth is not configured in this project yet',
    );
  }

  async sendOtpSms(_phone: string) {
    const phone = _phone.trim().toLowerCase();
    const existing = await this.prisma.franchise.findFirstOrThrow({
      where: { ownerPhone: phone },
    });

    if (existing) {
      throw new ConflictException('Phone number already registered');
    }

    const { otp, valid } = await this.otpService.generateOtp({ phone });
    console.log(
      `Generated OTP for ${phone}: ${otp} (valid for ${valid} seconds)`,
    );
    await this.brevoService.sendSms({
      to: phone,
      content: `Your OTP code is: ${otp}. This code is valid for 10 minutes.`,
    });

    return { message: 'OTP Sent successfully (Valid only for 10 minutes).' };
  }

  async sendOtpEmail(_email: string) {
    const email = _email.trim().toLowerCase();
    const existing = await this.findAuthUserByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const { otp, valid } = await this.otpService.generateOtp({ email: _email });
    console.log(
      `Generated OTP for ${_email}: ${otp} (valid for ${valid} seconds)`,
    );

    const html = OtpTemplate.build({
      otp,
      validMinutes: valid,
    });

    await this.brevoService.sendEmail({
      to: _email,
      subject: 'Your OTP Code',
      htmlContent: html,
    });

    return { message: 'OTP Sent successfully (Valid only for 10 minutes).' };
  }

  async registrationByEmail(dto: RegisterFranchiseDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.findAuthUserByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const otpValid = await this.otpService.verifyOtpByEmail(dto.email, dto.otp);

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      if (!otpValid) {
        throw new BadRequestException('Invalid OTP');
      }
    } else if (dto.otp !== '123456' && !otpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 2nd only they wannna pass email otp & password
    // if (!dto.latitude || !dto.longitude) {
    //   const address = buildAddressString({
    //     // area: dto.addressLine1,
    //     city: dto.city,
    //     state: dto.state,
    //     country: dto.country,
    //   });

    //   if (!address) {
    //     throw new BadRequestException('At least one address field is required');
    //   }

    //   try {
    //     const {
    //       lat,
    //       lng,
    //       address: displayName,
    //     } = await this.locationService.geocode(address);

    //     if (!lat || !lng) {
    //       throw new Error('Empty geocode result');
    //     }

    //     dto.latitude = lat;
    //     dto.longitude = lng;
    //     dto.territory = displayName;
    //   } catch (err: any) {
    //     // Don't block registration on geocoding failure. Log and fall back to safe defaults.
    //     this.logger.warn(
    //       `Geocoding failed for address "${address}": ${err?.message || err}. Falling back to defaults.`,
    //     );

    //     // Fallback coordinates (0,0) are used to allow registration to proceed.
    //     // This keeps the DB constraints satisfied; later processes can update precise coords.
    //     dto.latitude = dto.latitude ?? 0;
    //     dto.longitude = dto.longitude ?? 0;
    //     dto.territory = dto.territory ?? address;
    //   }

    //   if (!dto.latitude || !dto.longitude) {
    //     throw new BadRequestException(
    //       'Valid address is required to fetch latitude and longitude',
    //     );
    //   }

    //   console.log(
    //     `Geocoded address "${address}" to lat: ${dto.latitude}, lng: ${dto.longitude}, territory: ${dto.territory}`,
    //   );
    // }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: Role.FRANCHISE_OWNER,
        },
        select: {
          id: true,
          email: true,
          role: true,
          franchiseId: true,
        },
      });

      const franchise = await tx.franchise.create({
        data: {
          name: dto.name,
          dob: dto.dob ?? null,
          gender: dto.gender,
          code: `GBLR-${user.id.slice(0, 8).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`,
          latitude: dto.latitude ?? 0,
          longitude: dto.longitude ?? 0,
          territory: dto.territory,
          state: dto.state ?? undefined,
          status: FranchiseStatus.INACTIVE,
          addressLine1: dto.addressLine1,
          city: dto.city,
          postalCode: dto.postalCode,
          country: dto.country ?? 'IN',
          ownerFullName: dto.ownerFullName ?? undefined,
          ownerPhone: dto.ownerPhone ?? undefined,
          ownerEmail: email,
          businessName: dto.businessName ?? undefined,
          gstNumber: dto.gstNumber ?? undefined,
          panNumber: dto.panNumber ?? undefined,
          kycDocumentType: dto.kycDocumentType ?? undefined,
          kycDocumentNumber: dto.kycDocumentNumber ?? undefined,
          sopTrainingCompleted: dto.sopTrainingCompleted ?? false,
          sopBrandingCompleted: dto.sopBrandingCompleted ?? false,
          sopInfraAuditCompleted: dto.sopInfraAuditCompleted ?? false,
          sopPosSetupCompleted: dto.sopPosSetupCompleted ?? false,
          sopSafetyCompleted: dto.sopSafetyCompleted ?? false,
          sopChecklistCompleted:
            !!dto.sopTrainingCompleted &&
            !!dto.sopBrandingCompleted &&
            !!dto.sopInfraAuditCompleted &&
            !!dto.sopPosSetupCompleted &&
            !!dto.sopSafetyCompleted,
          sopLastReviewedAt:
            !!dto.sopTrainingCompleted &&
            !!dto.sopBrandingCompleted &&
            !!dto.sopInfraAuditCompleted &&
            !!dto.sopPosSetupCompleted &&
            !!dto.sopSafetyCompleted
              ? new Date()
              : undefined,
          sopNote: dto.sopNote ?? undefined,
        },
      });

      if (dto.bankDetails?.accountNumber) {
        await tx.bankDetails.create({
          data: {
            userId: user.id,
            accountNumber: dto.bankDetails.accountNumber,
            bankName: dto.bankDetails.bankName,
            ifscCode: dto.bankDetails.ifscCode,
            accountHolderName: dto.bankDetails.accountHolderName,
          },
        });
      }

      // Keep the owner user linked to the franchise so franchise.users resolves correctly
      // and downstream recipient lookups can find the owner reliably.
      await tx.user.update({
        where: { id: user.id },
        data: {
          franchiseId: franchise.id,
          // franchiseOwnerId: franchise.id,
        },
      });

      const documents = this.mapFranchiseDocuments(dto.documents, user.id);
      if (documents.length > 0) {
        await tx.franchiseDocument.createMany({
          data: documents.map((document) => ({
            ...document,
            franchiseId: franchise.id,
          })),
        });
      }

      return { user, franchise };
    });

    // 📧 Notify SuperAdmins about new franchise registration
    fireAndForget(
      this.notifyNewFranchiseRegistration(result.franchise),
      'franchise-registration-notification-email',
    );

    fireAndForget(
      this.audit.log({
        userId: result.user.id,
        action: 'USER_REGISTER_AUTH',
        resource: 'USER',
        resourceId: result.user.id,
        metadata: { email: result.user.email },
        ip: this.request?.ip,
        userAgent: this.request?.headers?.['user-agent'] as string | undefined,
      }),
      'USER_REGISTER',
    );

    return this.issueTokens({
      ...result.user,
      franchiseId: result.franchise.id,
    });
  }

  private async notifyNewFranchiseRegistration(franchise: any) {
    console.log(
      `Notifying SuperAdmins about new franchise registration: ${franchise.name} (${franchise.ownerFullName})`,
    );
    try {
      const user = await this.prisma.user.findFirstOrThrow({
        where: { role: Role.SUPERADMIN },
      });

      const title = 'New Franchise Registration';
      const body = `New franchise registration from ${franchise.ownerFullName} (${franchise.name}). Please review and approve the registration.`;

      // Create in-app notification and send email to each SuperAdmin
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title,
          body,
          type: NotificationType.FRANCHISE_REGISTRATION,
          channel: NotificationChannel.IN_APP,
          metadata: {
            franchiseId: franchise.id,
            franchiseName: franchise.name,
            franchiseCode: franchise.code,
            ownerName: franchise.ownerFullName,
            ownerEmail: franchise.ownerEmail,
            kycStatus: franchise.kycStatus,
          },
        },
      });
    } catch (error: any) {
      console.error(
        `Failed to notify SuperAdmins about new franchise: ${error.message}`,
      );
      // Non-critical operation, don't throw
    }
  }

  async sendOtp(dto: SendOtpDto) {
    const { mode, email, phone } = dto;

    const isEmailMode = mode === OtpModeEnum.EMAIL;
    const identifier = isEmailMode ? email : phone;

    if (!identifier) {
      throw new BadRequestException(
        `${isEmailMode ? 'Email' : 'Phone'} is required`,
      );
    }

    // Validate user existence
    if (isEmailMode) {
      const user = await this.findAuthUserByEmail(email ?? '');

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.status === FranchiseStatus.BLOCKED) {
        throw new ForbiddenException(
          'Account is blocked. Please contact support for more information.',
        );
      }
    } else {
      const user = await this.findAuthUserByPhone(phone ?? '');

      if (!user) {
        throw new NotFoundException('User with this phone does not exist');
      }

      if (user.status === FranchiseStatus.BLOCKED) {
        throw new ForbiddenException(
          'Account is blocked. Please contact support for more information.',
        );
      }
    }

    // Generate OTP
    const { otp, valid } = await this.otpService.generateOtp({
      email: isEmailMode ? email : undefined,
      phone: !isEmailMode ? phone : undefined,
    });

    this.logger.log(
      `Generated OTP for ${identifier} (valid for ${valid} seconds)`,
    );

    // Send OTP
    if (isEmailMode) {
      const html = OtpTemplate.build({
        otp,
        validMinutes: Math.ceil(valid / 60),
      });

      await this.brevoService.sendEmail({
        to: email!,
        subject: 'Your OTP Code',
        htmlContent: html,
      });
    } else {
      await this.brevoService.sendSms({
        to: phone!,
        content: `Your OTP code is: ${otp}. This code is valid for ${Math.ceil(valid / 60)} minutes.`,
      });
    }

    return {
      message: `OTP sent successfully (Valid only for ${Math.ceil(valid / 60)} minutes).`,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.findAuthUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.ensureFranchiseCanLogin(user);

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user);
  }

  async loginWithOtpByEmail(dto: VerifyEmailOtpDto) {
    const user = await this.findAuthUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.ensureFranchiseRole(user.role);
    this.ensureFranchiseCanLogin(user);

    const otpValid = await this.otpService.verifyOtpByEmail(dto.email, dto.otp);

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      if (!otpValid) {
        throw new BadRequestException('Invalid OTP');
      }
    } else if (dto.otp !== '123456' && !otpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    return this.issueTokens(user);
  }

  async loginWithOtpByPhone(dto: VerifyPhoneOtpDto) {
    const user = await this.findAuthUserByPhone(dto.phone);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.ensureFranchiseRole(user.role);

    this.ensureFranchiseCanLogin(user);

    const otpValid = await this.otpService.verifyOtpByPhone(dto.phone, dto.otp);

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      if (!otpValid) {
        throw new BadRequestException('Invalid OTP');
      }
    } else if (dto.otp !== '123456' && !otpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    return this.issueTokens(user);
  }

  async verifyOtpByEmail(user: JwtUser, dto: VerifyEmailOtpDto) {
    this.ensureFranchiseRole(user.role);

    const email = dto.email.trim().toLowerCase();

    const otpValid = await this.otpService.verifyOtpByEmail(email, dto.otp);
    if (!otpValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.sub },
        select: { id: true, email: true, franchiseId: true, role: true },
      });
      if (!currentUser) {
        throw new NotFoundException('Franchise user not found');
      }

      const nextUser = await tx.user.update({
        where: { id: user.sub },
        data: { email },
        // select: {
        //   id: true,
        //   email: true,
        //   role: true,
        //   franchiseId: true,
        // },
      });

      if (currentUser.franchiseId) {
        await tx.franchise.update({
          where: { id: currentUser.franchiseId },
          data: { ownerEmail: email },
        });
      }

      return nextUser;
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'franchise_verification_auth.updated',
        resource: 'Franchise',
        resourceId: user.franchiseId,
        metadata: {
          franchiseId: user.franchiseId,
          email: dto.email,
          otp: dto.otp,
          role: user.role,
        },
      }),
      'audit-log-franchise-verify-email',
    );

    return {
      verified: true,
      data: updated,
    };
  }

  async verifyOtpByPhone(user: JwtUser, dto: VerifyPhoneOtpDto) {
    this.ensureFranchiseRole(user.role);

    const phone = dto.phone.trim();
    const otpValid = await this.otpService.verifyOtpByPhone(phone, dto.otp);
    if (!otpValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.sub },
        select: { id: true, franchiseId: true, role: true },
      });
      if (!currentUser) {
        throw new NotFoundException('Franchise user not found');
      }
      if (!currentUser.franchiseId) {
        throw new BadRequestException(
          'This account is not linked to a franchise',
        );
      }

      const franchise = await tx.franchise.update({
        where: { id: currentUser.franchiseId },
        data: { ownerPhone: phone },
      });

      return franchise;
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'franchise_verification_auth.updated',
        resource: 'Franchise',
        resourceId: user.franchiseId,
        metadata: {
          franchiseId: user.franchiseId,
          phone: dto.phone,
          otp: dto.otp,
          role: user.role,
        },
      }),
      'audit-log-franchise-verify-phone',
    );

    return {
      verified: true,
      data: updated,
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    let payload: {
      sub: string;
      email: string;
      role: Role;
      franchiseId: string | null;
      franchiseOwnerId?: string | null;
    };
    try {
      payload = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.sub !== userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseId: true,
        franchiseOwnerId: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    this.ensureFranchiseRole(user.role);

    fireAndForget(
      this.audit.log({
        userId: user.id,
        action: 'franchise_refresh_token.created',
        resource: 'Franchise',
        resourceId: user.franchiseId,
        metadata: {
          franchiseId: user.franchiseId,
          role: user.role,
        },
      }),
      'audit-log-franchise-refresh-token',
    );

    return this.issueTokens(user);
  }

  async changePassword(user: JwtUser, dto: ChangePasswordDto, ip: string) {
    this.ensureFranchiseRole(user.role);
    const row = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, passwordHash: true, role: true },
    });
    if (!row || row.role !== user.role) {
      throw new UnauthorizedException();
    }
    const ok = await bcrypt.compare(dto.currentPassword, row.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'franchise_change_password_auth.updated',
        resource: 'Franchise',
        resourceId: user.franchiseId,
        metadata: {
          franchiseId: user.franchiseId,
          role: user.role,
          password: 'XXXXXXXX',
        },
        ip,
      }),
      'audit-log-franchise-change-password',
    );

    fireAndForget(
      this.redisService.del([
        `user:session:${user.sub}`,
        `franchise:profile:${user.sub}`,
      ]),
      'franchise changePassword session clear',
    );
    return { ok: true as const };
  }

  async forgotPasswordViaEmailViaToken(email: string) {
    const user = await this.findAuthUserByEmail(email);
    if (!user) {
      return { ok: true as const };
    }
    this.ensureFranchiseRole(user.role);
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

    console.log('Token:', raw);

    fireAndForget(
      this.redisService.del([
        `user:session:${user.id}`,
        `franchise:profile:${user.id}`,
      ]),
      'franchise forgotPasswordViaEmailViaToken session clear',
    );
    return { ok: true as const, ...(debug ? { resetToken: raw } : {}) };
  }

  async resetPasswordViaEmailViaToken(dto: ResetPasswordDto) {
    const hash = createHash('sha256').update(dto.token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: hash,
        passwordResetExpires: { gt: new Date() },
      },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }
    this.ensureFranchiseRole(user.role);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });

    fireAndForget(
      this.redisService.del([
        `user:session:${user.id}`,
        `franchise:profile:${user.id}`,
      ]),
      'franchise resetPasswordViaEmailViaToken session clear',
    );
    return { ok: true as const };
  }

  async forgotPasswordViaEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        role: { in: FRANCHISE_ROLES },
      },
      select: {
        id: true,
        franchiseId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    const franchise = await this.prisma.franchise.findFirst({
      where: {
        OR: [
          { id: user.franchiseId ?? undefined },
          { ownerEmail: normalizedEmail },
        ],
        status: FranchiseStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!franchise) {
      throw new NotFoundException(
        'User with this email does not exist or blocked',
      );
    }

    return this.sendOtp({
      mode: OtpModeEnum.EMAIL,
      email: normalizedEmail,
    });
  }

  async resetPasswordViaEmail(inputReset: {
    email: string;
    otp: string;
    password: string;
    confirmPassword: string;
  }) {
    const { email, otp, password, confirmPassword } = inputReset;

    if (password !== confirmPassword) {
      throw new BadRequestException('Password mismatch');
    }

    const user = await this.findAuthUserByEmail(email);
    if (!user) {
      return { ok: true as const };
    }

    this.ensureFranchiseRole(user.role);

    if (!/^\d{6}$/.test(otp)) {
      throw new BadRequestException('OTP must be 6 digits');
    }

    const otpValid = await this.otpService.verifyOtpByEmail(email, otp);
    if (!otpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    // // Dev Case - Accepting any OTP but must be 123456 for testing purposes
    // if (otp !== '123456') {
    //   throw new BadRequestException('Invalid OTP');
    // }

    const passwordHash = await bcrypt.hash(password, 10);
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
        action: 'franchise_auth_password_reset.updated',
        resource: 'Franchise',
        resourceId: user.franchiseId,
        metadata: {
          franchiseId: user.franchiseId,
          role: user.role,
          password: 'XXXXXXXX',
        },
      }),
      'audit-log-franchise-password-reset',
    );

    fireAndForget(
      this.redisService.del([
        `user:session:${user.id}`,
        `franchise:profile:${user.id}`,
      ]),
      'franchise password reset session clear',
    );
    return { ok: true as const };
  }

  async logOut(user: JwtUser, ip: string) {
    const userAgent = this.request?.headers?.['user-agent'] as
      | string
      | undefined;

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'franchise_auth_logout.updated',
        resource: 'Franchise',
        resourceId: user.sub,
        metadata: {
          franchiseId: user.franchiseId,
          role: user.role,
        },
        ip,
        userAgent,
      }),
      'audit-log-franchise-logout',
    );

    fireAndForget(
      this.redisService.del([
        `user:session:${user.sub}`,
        `franchise:profile:${user.sub}`,
      ]),
      'franchise logOut session clear',
    );
    return {
      ok: true as const,
      message: 'Logged out successfully',
      userId: user.sub,
    };
  }

  async getMe(user: JwtUser) {
    const cacheKey = `franchise:profile:${user.sub}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored
    }

    const select =
      user.role === Role.FRANCHISE_STAFF
        ? ({
            id: true,
            email: true,
            role: true,
            franchiseId: true,
            franchiseOwnerId: true,
            franchiseOwner: {
              select: {
                code: true,
                ownerFullName: true,
                ownerEmail: true,
                businessName: true,
                kycVerifiedAt: true,
                approvedAt: true,
                updatedAt: true,
                createdAt: true,
              },
            },
            staffFranchise: true,
            appRole: {
              select: {
                roleName: true,
                description: true,
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
          } as const)
        : {
            id: true,
            email: true,
            role: true,
            franchise: {
              include: {
                creditAccount: true,
                documents: true,
              },
            },
            bank: true,
            appRole: true,
          };

    let responseData: any;

    if (user.role === Role.FRANCHISE_STAFF) {
      const staffUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select,
      });

      responseData = {
        ...staffUser,
        franchiseId: staffUser?.franchiseId ?? user.sub,
        joiningAt: staffUser?.franchiseOwner?.createdAt ?? null,
        approvedAt: staffUser?.franchiseOwner?.approvedAt ?? null,
        updatedAt: staffUser?.franchiseOwner?.updatedAt ?? null,
        kycVerifiedAt: staffUser?.franchiseOwner?.kycVerifiedAt ?? null,
      };
    } else {
      const ownerUser: any = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select,
      });

      if (!ownerUser) {
        throw new NotFoundException('User not found');
      }

      const awsPrefix = this.configService
        .get<string>('AWS_PREFIX_URL')
        ?.replace(/\/$/, '');

      responseData = {
        id: ownerUser.franchise?.id,
        code: ownerUser.franchise?.code,
        name: ownerUser.franchise?.name,
        dob: ownerUser.franchise?.dob,
        gender: ownerUser.franchise?.gender,
        latitude: ownerUser.franchise?.latitude,
        longitude: ownerUser.franchise?.longitude,
        territory: ownerUser.franchise?.territory,
        state: ownerUser.franchise?.state,
        status: ownerUser.franchise?.status,
        addressLine1: ownerUser.franchise?.addressLine1,
        city: ownerUser.franchise?.city,
        postalCode: ownerUser.franchise?.postalCode,
        country: ownerUser.franchise?.country,
        ownerFullName: ownerUser.franchise?.ownerFullName,
        ownerEmail: ownerUser.franchise?.ownerEmail,
        ownerPhone: ownerUser.franchise?.ownerPhone,
        businessName: ownerUser.franchise?.businessName,
        gstNumber: ownerUser.franchise?.gstNumber,
        panNumber: ownerUser.franchise?.panNumber,
        kycStatus: ownerUser.franchise?.kycStatus,
        kycNote: ownerUser.franchise?.kycNote,
        kycDocumentType: ownerUser.franchise?.kycDocumentType,
        kycDocumentNumber: ownerUser.franchise?.kycDocumentNumber,
        sopNote: ownerUser.franchise?.sopNote,
        sopTrainingCompleted: ownerUser.franchise?.sopTrainingCompleted,
        sopBrandingCompleted: ownerUser.franchise?.sopBrandingCompleted,
        sopInfraAuditCompleted: ownerUser.franchise?.sopInfraAuditCompleted,
        sopPosSetupCompleted: ownerUser.franchise?.sopPosSetupCompleted,
        sopSafetyCompleted: ownerUser.franchise?.sopSafetyCompleted,
        sopChecklistCompleted: ownerUser.franchise?.sopChecklistCompleted,
        sopLastReviewedAt: ownerUser.franchise?.sopLastReviewedAt,
        user: {
          id: ownerUser.id,
          email: ownerUser.email,
          role: ownerUser.role,
        },
        documents: (ownerUser.franchise?.documents ?? []).map((d: any) => ({
          ...d,
          fileUrl: awsPrefix ? `${awsPrefix}/${d.fileUrl}` : d.fileUrl,
        })),
        creditAccount: addTotalCreditAmount(ownerUser.franchise?.creditAccount),
        appRole: ownerUser.appRole,
        staffFranchise: ownerUser.staffFranchise,
        bankDetails: ownerUser.bank,
        kycVerifiedAt: ownerUser.franchise?.kycVerifiedAt,
        approvedAt: ownerUser.franchise?.approvedAt,
        updatedAt: ownerUser.franchise?.updatedAt,
        joiningAt: ownerUser.franchise?.createdAt,
      };
    }

    fireAndForget(
      this.redisService.set(cacheKey, responseData, 300),
      'cache franchise profile',
    );

    return responseData;
  }

  async update(user: JwtUser, dto: FranchiseProfileUpdateDto, ip: string) {
    this.ensureFranchiseRole(user.role);

    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1. Get franchise (ONLY by identity, not email)
        const existing = user.franchiseId
          ? await tx.franchise.findUnique({
              where: { id: user.franchiseId },
            })
          : await tx.franchise.findFirst({
              where: { ownerEmail: this.normalizeEmail(user.email) },
            });

        if (!existing) {
          throw new NotFoundException('Franchise not found');
        }

        // 2. HARD AUTH (secure identity check)
        // if (existing.ownerEmail !== this.normalizeEmail(user.email)) {
        //   throw new ForbiddenException('Unauthorized franchise access');
        // }

        // 2.1 Update bank details (if provided) - simple upsert by userId
        if (dto.bankDetails?.accountNumber) {
          await tx.bankDetails.upsert({
            where: {
              userId_accountNumber: {
                userId: user.sub,
                accountNumber: dto.bankDetails.accountNumber,
              },
            },
            update: {
              accountNumber: dto.bankDetails.accountNumber,
              bankName: dto.bankDetails.bankName,
              ifscCode: dto.bankDetails.ifscCode,
              accountHolderName: dto.bankDetails.accountHolderName,
            },
            create: {
              userId: user.sub,
              accountNumber: dto.bankDetails.accountNumber,
              bankName: dto.bankDetails.bankName,
              ifscCode: dto.bankDetails.ifscCode,
              accountHolderName: dto.bankDetails.accountHolderName,
            },
          });
        }

        // 3. Documents (safe upsert, no delete-all)
        if (dto.documents?.length) {
          const upserts = dto.documents
            .filter((doc) => doc.kind)
            .map((doc) =>
              tx.franchiseDocument.upsert({
                where: {
                  franchiseId_kind: {
                    franchiseId: existing.id,
                    kind: doc.kind!,
                  },
                },
                update: {
                  title: doc.title,
                  fileUrl: doc.fileUrl,
                },
                create: {
                  ...doc,
                  franchiseId: existing.id,
                  uploadedByUserId: user.sub,
                },
              }),
            );

          const newDocs = dto.documents
            .filter((doc) => !doc.kind)
            .map((doc) => ({
              ...doc,
              franchiseId: existing.id,
              uploadedByUserId: user.sub,
            }));

          const creates = newDocs.length
            ? tx.franchiseDocument.createMany({
                data: newDocs,
              })
            : null;

          await Promise.all([...upserts, creates].filter(Boolean));
        }

        // 4. Safe update builder
        const data: any = {};

        const set = (key: string, value: any, existingValue: any) => {
          if (value !== undefined && value !== existingValue) {
            data[key] = value;
          }
        };

        set('name', dto.name, existing.name);
        set('dob', dto.dob, existing.dob);
        set('gender', dto.gender, existing.gender);
        set('latitude', dto.latitude, existing.latitude);
        set('longitude', dto.longitude, existing.longitude);
        set('addressLine1', dto.addressLine1?.trim(), existing.addressLine1);
        set('city', dto.city?.trim(), existing.city);
        set('postalCode', dto.postalCode?.trim(), existing.postalCode);
        set('country', dto.country?.trim(), existing.country);
        set('state', dto.state?.trim(), existing.state);

        set('ownerFullName', dto.ownerFullName?.trim(), existing.ownerFullName);
        set('ownerPhone', dto.ownerPhone, existing.ownerPhone);

        if (dto.ownerEmail && dto.ownerEmail !== existing.ownerEmail) {
          data.ownerEmail = this.normalizeEmail(dto.ownerEmail);
        }

        set('businessName', dto.businessName, existing.businessName);
        set('gstNumber', dto.gstNumber, existing.gstNumber);
        set('panNumber', dto.panNumber, existing.panNumber);
        set('territory', dto.territory, existing.territory);
        set('kycNote', dto.kycNote, existing.kycNote);
        set('kycDocumentType', dto.kycDocumentType, existing.kycDocumentType);
        set(
          'kycDocumentNumber',
          dto.kycDocumentNumber,
          existing.kycDocumentNumber,
        );
        set('sopNote', dto.sopNote, existing.sopNote);

        // 5. UPDATE ONLY IF REQUIRED
        if (Object.keys(data).length > 0) {
          await tx.franchise.update({
            where: { id: existing.id },
            data,
          });
        }

        // 6. Final fetch (single source of truth)
        return tx.franchise.findUnique({
          where: { id: existing.id },
          include: {
            documents: {
              orderBy: { createdAt: 'asc' },
            },
            _count: {
              select: {
                orders: true,
                users: true,
              },
            },
          },
        });
      },
      { timeout: 10000 },
    );

    // Non-blocking side effects
    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'franchise_profile.update',
        resource: 'Franchise',
        resourceId: result.id,
        metadata: dto as unknown as Prisma.InputJsonValue,
        ip,
      }),
    );

    fireAndForget(this.redisService.clearCacheByPrefix('admin:franchises:'));
    fireAndForget(this.redisService.del([`admin:franchise:${result.id}`]));
    fireAndForget(
      this.redisService.del([
        `user:session:${user.sub}`,
        `user:getme:${user.sub}`,
        `franchise:profile:${user.sub}`,
      ]),
      'franchise update profile session clear',
    );

    return result;
  }

  async accountRecovery(dto: RecoveryDto, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseId: true,
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
        franchise: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(
        'User not found or not linked to a franchise',
      );
    }

    let franchiseId = user.franchiseId;
    if (!franchiseId) {
      franchiseId = await this.resolveFranchiseIdForAuth({
        email: user.email,
        franchiseId: null,
      });
    }

    if (!franchiseId) {
      throw new NotFoundException(
        'User not found or not linked to a franchise',
      );
    }

    if (!user.franchiseId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { franchiseId },
      });
    }

    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      select: { id: true, status: true },
    });

    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }

    if (franchise.status === FranchiseStatus.ACTIVE) {
      throw new BadRequestException('Account is already active');
    }

    const otpValid = await this.otpService.verifyOtpByEmail(dto.email, dto.otp);

    if (!otpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    const updated = await this.prisma.franchise.update({
      where: { id: franchise.id },
      data: { status: FranchiseStatus.ACTIVE },
    });

    fireAndForget(
      this.audit.log({
        userId: updated.id,
        action: 'franchise.account_recovery.update',
        resource: 'Franchise',
        resourceId: updated.id,
        metadata: {
          previousStatus: franchise.status,
          newStatus: updated.status,
        },
        ip,
      }),
      'audit-log-franchise-account-recovery.update',
    );

    fireAndForget(this.redisService.clearCacheByPrefix('admin:franchises:'));
    fireAndForget(this.redisService.del([`admin:franchise:${updated.id}`]));
    fireAndForget(
      this.redisService.del([
        `user:session:${user.id}`,
        `franchise:profile:${user.id}`,
      ]),
      'franchise verifyOtpAndRecovery session clear',
    );
    return this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      franchiseId: updated.id,
      franchiseOwnerId: user.franchiseOwnerId,
      appRole: user.appRole,
    });
  }

  async softDelete(user: JwtUser, ip?: string) {
    this.ensureFranchiseRole(user.role);
    const existing = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { franchiseId: true },
    });

    if (!user.franchiseId && !existing) {
      throw new BadRequestException(
        'This account is not linked to a franchise',
      );
    }

    const franchise = await this.prisma.franchise.update({
      where: { id: user.franchiseId },
      data: { status: FranchiseStatus.ARCHIVED },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'franchise.archived',
        resource: 'Franchise',
        resourceId: franchise.id,
        metadata: {
          previousStatus: franchise.status,
          newStatus: FranchiseStatus.ARCHIVED,
        },
        ip,
      }),
      'audit-log-franchise-archived',
    );

    fireAndForget(this.redisService.clearCacheByPrefix('admin:franchises:'));
    fireAndForget(this.redisService.del([`admin:franchise:${franchise.id}`]));

    return { ok: true as const, franchise };
  }

  // async reorderSuggestionsForFranchise(
  //   franchiseId: string | null,
  // ): Promise<{ data: unknown[]; meta: IMeta }> {
  //   if (!franchiseId) {
  //     throw new NotFoundException('No franchise linked');
  //   }
  //   let rows: Array<{
  //     productId: string;
  //     quantity: number;
  //     lowStockThreshold: number;
  //     reserved?: number;
  //     product: { name: string; category: { name: string } };
  //   }> = [];
  //   try {
  //     rows = await this.prisma.franchiseStock.findMany({
  //       where: { franchiseId },
  //       orderBy: { product: { name: 'asc' } },
  //       include: { product: this.franchiseStockProductSelect },
  //     });
  //   } catch (err) {
  //     if (!this.isMissingReservedColumn(err)) throw err;
  //     const fallback = await this.prisma.franchiseStock.findMany({
  //       where: { franchiseId },
  //       orderBy: { product: { name: 'asc' } },
  //       select: {
  //         productId: true,
  //         quantity: true,
  //         lowStockThreshold: true,
  //         product: {
  //           select: { name: true, category: { select: { name: true } } },
  //         },
  //       },
  //     });
  //     rows = fallback.map((r) => ({ ...r, reserved: 0 }));
  //   }

  //   const result = rows
  //     .map((r) => {
  //       const available = Math.max(0, r.quantity - (r.reserved ?? 0));
  //       return { ...r, available };
  //     })
  //     .filter((r) => r.available <= r.lowStockThreshold)
  //     .map((r) => ({
  //       productId: r.productId,
  //       name: r.product.name,
  //       category: r.product.category.name,
  //       quantity: r.quantity,
  //       reserved: r.reserved ?? 0,
  //       available: r.available,
  //       lowStockThreshold: r.lowStockThreshold,
  //       suggestedOrderQty: Math.max(
  //         r.lowStockThreshold * 2 - r.available,
  //         r.lowStockThreshold,
  //       ),
  //     }));

  //   // Send low stock alert notifications to franchise owner and staff
  //   if (result.length > 0) {
  //     fireAndForget(
  //       this.sendLowStockAlerts(franchiseId, result),
  //       'low-stock-alert-notification',
  //     );
  //   }

  //   return {
  //     data: result,
  //     meta: {
  //       count: result.length,
  //     },
  //   };
  // }

  private async sendLowStockAlerts(
    franchiseId: string,
    lowStockItems: Array<{
      productId: string;
      name: string;
      category: string;
      quantity: number;
      reserved: number;
      available: number;
      lowStockThreshold: number;
      suggestedOrderQty: number;
    }>,
  ) {
    try {
      const itemCount = lowStockItems.length;
      const criticalItems = lowStockItems.filter(
        (item) => item.available === 0,
      ).length;

      const title = `Low Stock Alert: ${itemCount} product${itemCount > 1 ? 's' : ''} need reordering`;
      const body =
        criticalItems > 0
          ? `${criticalItems} product${criticalItems > 1 ? 's are' : ' is'} completely out of stock. ${itemCount - criticalItems} more product${itemCount - criticalItems > 1 ? 's are' : ' is'} below threshold.`
          : `${itemCount} product${itemCount > 1 ? 's are' : ' is'} below the low stock threshold.`;

      // Notify franchise owner
      await this.roleBasedNotificationService.notifyFranchiseOwner(
        franchiseId,
        title,
        body,
        'LOW_STOCK' as any,
        {
          lowStockCount: itemCount,
          criticalCount: criticalItems,
          items: lowStockItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            available: item.available,
            suggestedOrderQty: item.suggestedOrderQty,
          })),
        },
      );

      // Also notify staff for awareness
      await this.roleBasedNotificationService.notifyFranchiseStaff(
        franchiseId,
        title,
        body,
        'LOW_STOCK' as any,
        {
          lowStockCount: itemCount,
          criticalCount: criticalItems,
        },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send low stock alerts: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Builds a precise ledger of variant stock for a franchise by tallying all INs (bundles, inbound deliveries)
   * and OUTs (orders) for the given product IDs.
   */
  private async getVariantStockMap(franchiseId: string, productIds: string[]): Promise<Map<string, number>> {
    const variantStockMap = new Map<string, number>();

    // 0. Direct stock from FranchiseStock records
    const fsRows = await this.prisma.franchiseStock.findMany({
      where: {
        franchiseId,
        productId: { in: productIds },
        variantId: { not: '' },
      },
      select: {
        variantId: true,
        quantity: true,
        reserved: true,
      },
    });

    for (const fs of fsRows) {
      if (fs.variantId) {
        const netQty = Math.max(0, fs.quantity - (fs.reserved ?? 0));
        variantStockMap.set(fs.variantId, netQty);
      }
    }

    // 1. INs from Bundles
    const bundleItems = await this.prisma.starterBundleItem.findMany({
      where: {
        productId: { in: productIds },
        variantId: { not: null },
        bundle: {
          assignments: {
            some: {
              franchiseId,
              status: { in: ['PROVISIONED', 'PROCESSING'] },
            },
          },
        },
      },
      select: {
        variantId: true,
        quantity: true,
        bundle: {
          select: {
            assignments: {
              where: { franchiseId, status: { in: ['PROVISIONED', 'PROCESSING'] } },
              select: { id: true },
            },
          },
        },
      },
    });

    for (const item of bundleItems) {
      if (item.variantId && !variantStockMap.has(item.variantId)) {
        const assignmentCount = item.bundle?.assignments?.length || 0;
        const totalQty = (item.quantity || 0) * assignmentCount;
        const current = variantStockMap.get(item.variantId) || 0;
        variantStockMap.set(item.variantId, current + totalQty);
      }
    }
    // 2. INs from InboundDelivery for specific variant StockRequests
    const inboundDeliveries = await this.prisma.inboundDelivery.findMany({
      where: {
        franchiseId,
        stockApplied: true,
        stockRequest: {
          productId: { in: productIds },
          variantId: { not: null },
        }
      },
      select: {
        quantityReceived: true,
        stockRequest: {
          select: { variantId: true, quantity: true, approvedQuantity: true },
        },
      }
    });

    for (const delivery of inboundDeliveries) {
      const vId = delivery.stockRequest?.variantId;
      if (vId && !variantStockMap.has(vId)) {
        const qty = delivery.quantityReceived ?? delivery.stockRequest?.approvedQuantity ?? delivery.stockRequest?.quantity ?? 0;
        const current = variantStockMap.get(vId) || 0;
        variantStockMap.set(vId, current + qty);
      }
    }

    // 3. OUTs from OrderItem (only if not directly sourced from FranchiseStock)
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        productId: { in: productIds },
        variantId: { not: null },
        order: {
          franchiseId,
          status: {
            notIn: ['CANCELLED', 'RETURNED', 'REFUNDED']
          }
        }
      },
      select: {
        variantId: true,
        quantity: true,
      }
    });

    for (const item of orderItems) {
      if (item.variantId && !fsRows.some(f => f.variantId === item.variantId)) {
        const qty = Number(item.quantity) || 0;
        const current = variantStockMap.get(item.variantId) || 0;
        variantStockMap.set(item.variantId, Math.max(0, current - qty));
      }
    }

    return variantStockMap;
  }

  /**
   * Helper: Get category tree IDs (including all descendant/child category IDs)
   * matching categoryId, slug, categorySlug, or category (title/name).
   */
  private async getCategoryTreeIdsForFilter(filter: {
    categoryId?: string;
    categorySlug?: string;
    slug?: string;
    category?: string;
  }): Promise<string[] | null> {
    const categoryId = filter.categoryId?.trim();
    const slug = (filter.slug || filter.categorySlug)?.trim();
    const category = filter.category?.trim();

    if (!categoryId && !slug && !category) {
      return null;
    }

    const flat = await this.prisma.category.findMany({
      select: { id: true, parentId: true, slug: true, name: true },
    });

    const matchedIds = new Set<string>();

    for (const c of flat) {
      if (categoryId && c.id === categoryId) {
        matchedIds.add(c.id);
      }
      if (slug && c.slug.toLowerCase() === slug.toLowerCase()) {
        matchedIds.add(c.id);
      }
      if (category) {
        const catLower = category.toLowerCase();
        if (
          c.name.toLowerCase() === catLower ||
          c.slug.toLowerCase() === catLower ||
          c.name.toLowerCase().includes(catLower)
        ) {
          matchedIds.add(c.id);
        }
      }
    }

    if (matchedIds.size === 0) {
      return [];
    }

    const byParent = new Map<string, string[]>();
    for (const c of flat) {
      if (c.parentId) {
        if (!byParent.has(c.parentId)) {
          byParent.set(c.parentId, []);
        }
        byParent.get(c.parentId)!.push(c.id);
      }
    }

    const resultSet = new Set<string>();
    const stack = Array.from(matchedIds);
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      resultSet.add(currentId);
      const children = byParent.get(currentId);
      if (children && children.length > 0) {
        for (const childId of children) {
          if (!resultSet.has(childId)) {
            stack.push(childId);
          }
        }
      }
    }

    return Array.from(resultSet);
  }

  async inventories(query: FranchiseInventoryQueryDto): Promise<{
    data: {
      rows: unknown[];
      inboundPendingCount: number;
      inboundDeliveredCount: number;
    };
    meta: IMeta;
  }> {
    const { franchiseId } = query;
    if (!franchiseId) {
      throw new NotFoundException('No franchise linked');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim();

    const clauses: Prisma.FranchiseStockWhereInput[] = [{ franchiseId }];

    const explicitCatIds = await this.getCategoryTreeIdsForFilter({
      categoryId: query.categoryId,
      slug: query.slug,
      categorySlug: query.categorySlug,
      category: query.category,
    });

    if (explicitCatIds !== null) {
      if (explicitCatIds.length > 0) {
        clauses.push({
          product: {
            categoryId: { in: explicitCatIds },
          },
        });
      } else {
        clauses.push({
          productId: { in: [] },
        });
      }
    }

    if (search) {
      const searchCatIds = await this.getCategoryTreeIdsForFilter({
        category: search,
      });

      const searchOR: Prisma.FranchiseStockWhereInput[] = [
        {
          product: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          product: {
            slug: { contains: search, mode: 'insensitive' },
          },
        },
        {
          product: {
            category: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];

      if (searchCatIds && searchCatIds.length > 0) {
        searchOR.push({
          product: {
            categoryId: { in: searchCatIds },
          },
        });
      }

      clauses.push({ OR: searchOR });
    }

    if (query.minQty !== undefined) {
      clauses.push({ quantity: { gte: query.minQty } });
    }

    if (query.maxQty !== undefined) {
      clauses.push({ quantity: { lte: query.maxQty } });
    }

    if (query.minLowStockThreshold !== undefined) {
      clauses.push({ lowStockThreshold: { gte: query.minLowStockThreshold } });
    }

    if (query.maxLowStockThreshold !== undefined) {
      clauses.push({ lowStockThreshold: { lte: query.maxLowStockThreshold } });
    }

    const where: Prisma.FranchiseStockWhereInput =
      clauses.length > 0 ? { AND: clauses } : { franchiseId };

    const inboundPendingCount = await this.prisma.inboundDelivery.count({
      where: {
        franchiseId,
        status: { in: [DeliveryStatus.SCHEDULED, DeliveryStatus.IN_TRANSIT] },
      },
    });

    const inboundDeliveredCount = await this.prisma.inboundDelivery.count({
      where: {
        franchiseId,
        status: DeliveryStatus.DELIVERED,
      },
    });

    const sortOrder = (query.order?.toLowerCase() === 'desc' ? 'desc' : 'asc') as Prisma.SortOrder;

    let rawRows: Array<any> = [];
    try {
      rawRows = await this.prisma.franchiseStock.findMany({
        where,
        orderBy: { product: { name: sortOrder } },
        include: { product: this.franchiseStockProductSelect },
      });
    } catch (err) {
      if (!this.isMissingReservedColumn(err)) throw err;
      const fallback = await this.prisma.franchiseStock.findMany({
        where,
        orderBy: { product: { name: sortOrder } },
        select: {
          quantity: true,
          lowStockThreshold: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              imageUrl: true,
              imageUrls: true,
              basePrice: true,
              wholesalePrice: true,
              price: true,
              mrpPrice: true,
              category: { select: { name: true } },
              variants: true,
            },
          },
        },
      });
      rawRows = fallback.map((r) => ({ ...r, reserved: 0 }));
    }

    // ── Group by productId to deduplicate products (since FranchiseStock has 1 row per variant) ──
    interface GroupedInventoryItem {
      quantity: number;
      reserved: number;
      lowStockThreshold: number;
      product: any;
      variantStockMap: Map<string, number>;
    }
    const groupedMap = new Map<string, GroupedInventoryItem>();

    for (const r of rawRows) {
      const pId = r.product?.id || (r as any).productId;
      if (!pId || !r.product) continue;
      if (!groupedMap.has(pId)) {
        groupedMap.set(pId, {
          quantity: 0,
          reserved: 0,
          lowStockThreshold: r.lowStockThreshold,
          product: r.product,
          variantStockMap: new Map<string, number>(),
        });
      }
      const item = groupedMap.get(pId)!;
      item.quantity += r.quantity;
      item.reserved += (r.reserved ?? 0);
      if ((r as any).variantId) {
        const netQty = Math.max(0, r.quantity - (r.reserved ?? 0));
        item.variantStockMap.set((r as any).variantId, netQty);
      }
    }

    const isOverAllItems =
      query.overAllItems === BooleanEnum.TRUE ||
      String(query.overAllItems).toLowerCase() === 'true' ||
      (query.overAllItems as any) === true;

    let groupedList = Array.from(groupedMap.values());

    if (!isOverAllItems) {
      const candidateProductIds = groupedList
        .map((item) => item.product?.id)
        .filter(Boolean) as string[];

      const candidateVariantStockMap =
        candidateProductIds.length > 0
          ? await this.getVariantStockMap(franchiseId, candidateProductIds)
          : new Map<string, number>();

      groupedList = groupedList.filter((item) => {
        const available = Math.max(0, item.quantity - item.reserved);
        if (item.quantity <= 0 || available <= 0) {
          return false;
        }

        if (
          item.product?.variants &&
          Array.isArray(item.product.variants) &&
          item.product.variants.length > 0
        ) {
          const hasVariantStock = item.product.variants.some((v: any) => {
            const varStock =
              item.variantStockMap.get(v.id) ??
              candidateVariantStockMap.get(v.id) ??
              0;
            return varStock > 0;
          });
          if (!hasVariantStock) {
            return false;
          }
        }

        return true;
      });
    }

    const total = groupedList.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const skip = (page - 1) * limit;
    const pagedItems = groupedList.slice(skip, skip + limit);

    // ── Variant filtering: only show variants actually stocked for this franchise ──
    const productIds = pagedItems
      .map((item) => item.product?.id)
      .filter(Boolean) as string[];

    const stockedVariantMap = new Map<string, Set<string>>();

    if (productIds.length > 0) {
      // 1. Variants from bundle items assigned to this franchise
      const bundleItems = await this.prisma.starterBundleItem.findMany({
        where: {
          productId: { in: productIds },
          variantId: { not: null },
          bundle: {
            assignments: {
              some: {
                franchiseId,
                status: { in: ['PROVISIONED', 'PROCESSING'] },
              },
            },
          },
        },
        select: { productId: true, variantId: true },
      });

      for (const bi of bundleItems) {
        if (!bi.variantId) continue;
        if (!stockedVariantMap.has(bi.productId)) {
          stockedVariantMap.set(bi.productId, new Set());
        }
        stockedVariantMap.get(bi.productId)!.add(bi.variantId);
      }

      // 2. Variants from stock requests (approved, pending, or with delivered deliveries)
      const stockReqs = await this.prisma.stockRequest.findMany({
        where: {
          franchiseId,
          productId: { in: productIds },
          variantId: { not: null },
          OR: [
            { status: { in: ['APPROVED', 'PENDING'] } },
            {
              deliveries: {
                some: {
                  status: DeliveryStatus.DELIVERED,
                  stockApplied: true,
                },
              },
            },
          ],
        },
        select: { productId: true, variantId: true },
      });

      for (const sr of stockReqs) {
        if (!sr.variantId) continue;
        if (!stockedVariantMap.has(sr.productId)) {
          stockedVariantMap.set(sr.productId, new Set());
        }
        stockedVariantMap.get(sr.productId)!.add(sr.variantId);
      }

      // 3. Variants from delivered bundle inbound deliveries (asnPayload)
      const deliveredBundleDeliveries =
        await this.prisma.inboundDelivery.findMany({
          where: {
            franchiseId,
            status: DeliveryStatus.DELIVERED,
            stockApplied: true,
            stockRequest: {
              productId: { in: productIds },
              variantId: { not: null },
            },
          },
          select: {
            stockRequest: {
              select: { productId: true, variantId: true },
            },
          },
        });

      for (const d of deliveredBundleDeliveries) {
        const sr = d.stockRequest;
        if (!sr?.variantId) continue;
        if (!stockedVariantMap.has(sr.productId)) {
          stockedVariantMap.set(sr.productId, new Set());
        }
        stockedVariantMap.get(sr.productId)!.add(sr.variantId);
      }
    }

    const variantStockMap = productIds.length > 0 ? await this.getVariantStockMap(franchiseId, productIds) : new Map<string, number>();

    const resultRows = pagedItems.map((item) => {
      const product = item.product;
      let filteredProduct = product;

      if (product?.variants && Array.isArray(product.variants)) {
        let variants = product.variants;

        const stockedSet = new Set<string>();
        if (product.id && stockedVariantMap.has(product.id)) {
          stockedVariantMap.get(product.id)!.forEach((vId) => stockedSet.add(vId));
        }
        item.variantStockMap.forEach((_, vId) => stockedSet.add(vId));
        variants.forEach((v: any) => {
          if (variantStockMap.has(v.id)) {
            stockedSet.add(v.id);
          }
        });

        if (stockedSet.size > 0) {
          variants = variants.filter((v: any) => stockedSet.has(v.id));
        }

        variants = variants.map((v: any) => {
          const varStock = item.variantStockMap.get(v.id) ?? variantStockMap.get(v.id) ?? 0;
          return {
            ...v,
            stock: Math.max(0, varStock),
          };
        });

        filteredProduct = {
          ...product,
          variants,
        };
      }

      return {
        quantity: item.quantity,
        lowStockThreshold: item.lowStockThreshold,
        reserved: item.reserved,
        product: filteredProduct,
        available: Math.max(0, item.quantity - item.reserved),
      };
    });

    return {
      data: {
        rows: resultRows,
        inboundPendingCount,
        inboundDeliveredCount,
      },
      meta: {
        count: total,
        totalPages,
        page,
        limit,
      },
    };
  }

  async inventoryProducts(query: FranchiseInventoryQueryDto): Promise<{
    data: any[];
    meta: IMeta;
  }> {
    const { franchiseId } = query;
    if (!franchiseId) {
      throw new NotFoundException('No franchise linked');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim();

    const clauses: Prisma.FranchiseStockWhereInput[] = [{ franchiseId }];

    const explicitCatIds = await this.getCategoryTreeIdsForFilter({
      categoryId: query.categoryId,
      slug: query.slug,
      categorySlug: query.categorySlug,
      category: query.category,
    });

    if (explicitCatIds !== null) {
      if (explicitCatIds.length > 0) {
        clauses.push({
          product: {
            categoryId: { in: explicitCatIds },
          },
        });
      } else {
        clauses.push({
          productId: { in: [] },
        });
      }
    }

    if (search) {
      const searchCatIds = await this.getCategoryTreeIdsForFilter({
        category: search,
      });

      const searchOR: Prisma.FranchiseStockWhereInput[] = [
        {
          product: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          product: {
            slug: { contains: search, mode: 'insensitive' },
          },
        },
        {
          product: {
            category: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];

      if (searchCatIds && searchCatIds.length > 0) {
        searchOR.push({
          product: {
            categoryId: { in: searchCatIds },
          },
        });
      }

      clauses.push({ OR: searchOR });
    }

    if (query.minQty !== undefined) {
      clauses.push({ quantity: { gte: query.minQty } });
    }

    if (query.maxQty !== undefined) {
      clauses.push({ quantity: { lte: query.maxQty } });
    }

    if (query.minLowStockThreshold !== undefined) {
      clauses.push({ lowStockThreshold: { gte: query.minLowStockThreshold } });
    }

const where: Prisma.FranchiseStockWhereInput =
      clauses.length > 0 ? { AND: clauses } : { franchiseId };

    let rawRows: Array<any> = [];
    try {
      rawRows = await this.prisma.franchiseStock.findMany({
        where,
        orderBy: { product: { name: 'asc' } },
        include: { product: this.franchiseProductWebListSelect },
      });
    } catch (err) {
      if (!this.isMissingReservedColumn(err)) throw err;
      const fallback = await this.prisma.franchiseStock.findMany({
        where,
        orderBy: { product: { name: 'asc' } },
        select: {
          quantity: true,
          lowStockThreshold: true,
          product: this.franchiseProductWebListSelect,
        },
      });
      rawRows = fallback.map((r) => ({ ...r, reserved: 0 }));
    }

    // ── Group by productId to deduplicate products ──
    interface GroupedProductItem {
      quantity: number;
      reserved: number;
      lowStockThreshold: number;
      product: any;
      variantStockMap: Map<string, number>;
    }
    const groupedMap = new Map<string, GroupedProductItem>();

    for (const r of rawRows) {
      const pId = r.product?.id || (r as any).productId;
      if (!pId || !r.product) continue;
      if (!groupedMap.has(pId)) {
        groupedMap.set(pId, {
          quantity: 0,
          reserved: 0,
          lowStockThreshold: r.lowStockThreshold,
          product: r.product,
          variantStockMap: new Map<string, number>(),
        });
      }
      const item = groupedMap.get(pId)!;
      item.quantity += r.quantity;
      item.reserved += (r.reserved ?? 0);
      if ((r as any).variantId) {
        const netQty = Math.max(0, r.quantity - (r.reserved ?? 0));
        item.variantStockMap.set((r as any).variantId, (item.variantStockMap.get((r as any).variantId) ?? 0) + netQty);
      }
    }

    const isOverAllItems =
      query.overAllItems === BooleanEnum.TRUE ||
      String(query.overAllItems).toLowerCase() === 'true' ||
      (query.overAllItems as any) === true;

    let groupedList = Array.from(groupedMap.values());

    if (!isOverAllItems) {
      const candidateProductIds = groupedList
        .map((item) => item.product?.id)
        .filter(Boolean) as string[];

      const candidateVariantStockMap =
        candidateProductIds.length > 0
          ? await this.getVariantStockMap(franchiseId, candidateProductIds)
          : new Map<string, number>();

      groupedList = groupedList.filter((item) => {
        const available = Math.max(0, item.quantity - item.reserved);
        if (item.quantity <= 0 || available <= 0) {
          return false;
        }

        if (
          item.product?.variants &&
          Array.isArray(item.product.variants) &&
          item.product.variants.length > 0
        ) {
          const hasVariantStock = item.product.variants.some((v: any) => {
            const varStock =
              item.variantStockMap.get(v.id) ??
              candidateVariantStockMap.get(v.id) ??
              0;
            return varStock > 0;
          });
          if (!hasVariantStock) {
            return false;
          }
        }

        return true;
      });
    }


    const total = groupedList.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const skip = (page - 1) * limit;
    const pagedItems = groupedList.slice(skip, skip + limit);

    // ── Variant filtering and stock assignment ──
    const productIds = pagedItems
      .map((item) => item.product?.id)
      .filter(Boolean) as string[];

    const variantStockMap = await this.getVariantStockMap(franchiseId, productIds);

    const mappedProducts = pagedItems.map((item) => {
      const p = item.product;
      const franchiseStockQuantity = Math.max(0, item.quantity - item.reserved);

      const reservedByVariant = new Map<string, number>();
      if (Array.isArray(p.reservations)) {
        for (const r of p.reservations) {
          if (r.note && r.note.includes('__variantId:')) {
            const match = r.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
            if (match && match[1]) {
              const vId = match[1];
              reservedByVariant.set(vId, (reservedByVariant.get(vId) ?? 0) + r.quantity);
            }
          }
        }
      }

      let filteredVariants = p.variants ? p.variants : [];
      if (p?.variants && Array.isArray(p.variants)) {
        const stockedSet = new Set<string>();
        item.variantStockMap.forEach((_, vId) => stockedSet.add(vId));
        p.variants.forEach((v: any) => {
          if (variantStockMap.has(v.id)) {
            stockedSet.add(v.id);
          }
        });

        if (stockedSet.size > 0) {
          filteredVariants = p.variants.filter((v: any) => stockedSet.has(v.id));
        }
      }

      const mappedVariants = filteredVariants.map((v: any) => {
        const reservedQty = reservedByVariant.get(v.id) ?? 0;
        const ledgerStock = item.variantStockMap.get(v.id) ?? variantStockMap.get(v.id) ?? 0;
        const effectiveLedgerStock = Math.max(0, ledgerStock);
        const displayStock = Math.max(0, effectiveLedgerStock - reservedQty);
        
        return {
          ...v,
          stock: displayStock,
          ratingAvg: v.ratingAvg ? Number(v.ratingAvg) : 0,
          ratingCount: v.reviewCount ?? 0,
          reviews: v.reviews || [],
          attributes: Array.isArray(v.attributes)
            ? v.attributes.map((attr: any) => ({
                ...attr,
                attributeName: attr.attributeValue?.attributeName?.title || attr.attributeName || null,
                attributeValue: attr.attributeValue?.title || (typeof attr.attributeValue === 'string' ? attr.attributeValue : null),
              }))
            : [],
        };
      });

      let finalPrice = p.price ? Number(p.price) : 0;
      let finalMrpPrice = p.mrpPrice ? Number(p.mrpPrice) : null;

      if (mappedVariants.length > 0) {
        const activeVariants = mappedVariants.filter((v: any) => v.isActive !== false);
        if (activeVariants.length > 0) {
          const sumPrice = activeVariants.reduce((sum: number, v: any) => sum + (v.price ? Number(v.price) : 0), 0);
          finalPrice = sumPrice / activeVariants.length;

          const mrpVariants = activeVariants.filter((v: any) => v.mrpPrice !== null && v.mrpPrice !== undefined);
          if (mrpVariants.length > 0) {
            const sumMrp = mrpVariants.reduce((sum: number, v: any) => sum + Number(v.mrpPrice), 0);
            finalMrpPrice = sumMrp / mrpVariants.length;
          } else {
            finalMrpPrice = null;
          }
        }
      }

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: finalPrice,
        mrpPrice: finalMrpPrice,
        stock: franchiseStockQuantity,
        isFeatured: p.isFeatured,
        fastDelivery: p.fastDelivery,
        ratingAvg: p.ratingAvg ? Number(p.ratingAvg) : 0,
        ratingCount: p.reviewCount ?? 0,
        viewCount: p.viewCount ?? 0,
        imageUrl: p.imageUrl,
        imageUrls: p.imageUrls,
        category: p.category,
        brandRef: p.brandRef,
        variants: mappedVariants,
        reviews: p.reviews || [],
        seo: p.seo,
        createdAt: p.createdAt,
      };
    });

    return {
      data: mappedProducts,
      meta: {
        count: total,
        totalPages,
        page,
        limit,
      },
    };
  }

  async inventoryProduct(franchiseId: string, productId: string): Promise<any> {
    const fsRows = await this.prisma.franchiseStock.findMany({
      where: { franchiseId, productId },
      include: { product: this.franchiseProductWebListSelect },
    });

    if (!fsRows || fsRows.length === 0) {
      throw new NotFoundException('Product not found in franchise inventory');
    }

    const firstRow = fsRows[0];
    const p = firstRow.product;
    const totalQuantity = fsRows.reduce((sum, r) => sum + r.quantity, 0);
    const totalReserved = fsRows.reduce((sum, r) => sum + (r.reserved ?? 0), 0);
    const franchiseStockQuantity = Math.max(0, totalQuantity - totalReserved);

    const variantStockMap = await this.getVariantStockMap(franchiseId, [productId]);

    const reservedByVariant = new Map<string, number>();
    if (Array.isArray(p.reservations)) {
      for (const r of p.reservations) {
        if (r.note && r.note.includes('__variantId:')) {
          const match = r.note.match(/__variantId:([a-zA-Z0-9_-]+)__/);
          if (match && match[1]) {
            const vId = match[1];
            reservedByVariant.set(vId, (reservedByVariant.get(vId) ?? 0) + r.quantity);
          }
        }
      }
    }

    let filteredVariants = p.variants ? p.variants : [];
    if (p?.variants && Array.isArray(p.variants)) {
      const stockedSet = new Set<string>();
      p.variants.forEach((v: any) => {
        if (
          variantStockMap.has(v.id) ||
          fsRows.some((r) => r.variantId && r.variantId === v.id)
        ) {
          stockedSet.add(v.id);
        }
      });

      if (stockedSet.size > 0) {
        filteredVariants = p.variants.filter((v: any) => stockedSet.has(v.id));
      }
    }

    const mappedVariants = filteredVariants.map((v: any) => {
      const reservedQty = reservedByVariant.get(v.id) ?? 0;
      let ledgerStock = variantStockMap.get(v.id) || 0;
      const matchedFs = fsRows.find((r) => r.variantId === v.id);
      if (matchedFs) {
        ledgerStock = Math.max(0, matchedFs.quantity - (matchedFs.reserved ?? 0));
      }
      const effectiveLedgerStock = Math.max(0, ledgerStock);
      const displayStock = Math.max(0, effectiveLedgerStock - reservedQty);

      return {
        ...v,
        stock: displayStock,
        ratingAvg: v.ratingAvg ? Number(v.ratingAvg) : 0,
        ratingCount: v.reviewCount ?? 0,
        reviews: v.reviews || [],
        attributes: Array.isArray(v.attributes)
          ? v.attributes.map((attr: any) => ({
              ...attr,
              attributeName: attr.attributeValue?.attributeName?.title || attr.attributeName || null,
              attributeValue: attr.attributeValue?.title || (typeof attr.attributeValue === 'string' ? attr.attributeValue : null),
            }))
          : [],
      };
    });

    let finalPrice = p.price ? Number(p.price) : 0;
    let finalMrpPrice = p.mrpPrice ? Number(p.mrpPrice) : null;

    if (mappedVariants.length > 0) {
      const activeVariants = mappedVariants.filter((v: any) => v.isActive !== false);
      if (activeVariants.length > 0) {
        const sumPrice = activeVariants.reduce((sum: number, v: any) => sum + (v.price ? Number(v.price) : 0), 0);
        finalPrice = sumPrice / activeVariants.length;

        const mrpVariants = activeVariants.filter((v: any) => v.mrpPrice !== null && v.mrpPrice !== undefined);
        if (mrpVariants.length > 0) {
          const sumMrp = mrpVariants.reduce((sum: number, v: any) => sum + Number(v.mrpPrice), 0);
          finalMrpPrice = sumMrp / mrpVariants.length;
        } else {
          finalMrpPrice = null;
        }
      }
    }

    return {
      data: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: finalPrice,
        mrpPrice: finalMrpPrice,
        stock: franchiseStockQuantity,
        isFeatured: p.isFeatured,
        fastDelivery: p.fastDelivery,
        ratingAvg: p.ratingAvg ? Number(p.ratingAvg) : 0,
        ratingCount: (p as any).reviewCount ?? 0,
        viewCount: (p as any).viewCount ?? 0,
        imageUrl: p.imageUrl,
        imageUrls: p.imageUrls,
        category: p.category,
        brandRef: (p as any).brandRef,
        variants: mappedVariants,
        reviews: (p as any).reviews || [],
        seo: (p as any).seo,
        createdAt: (p as any).createdAt,
      },
    };
  }
}
