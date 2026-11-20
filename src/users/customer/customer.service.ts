import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CustomerStatus, Role } from '@prisma/client';
import { OtpService } from 'src/otp/otp.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CustomerAuthUser } from './types/customer.type';
import { RegistrationCustomerDto } from './dto/registration-customer.dto';
import {
  ChangePasswordDto,
  LoginDto,
  RecoveryDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from 'src/auth/dto/user.dto';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuthService } from 'src/auth/auth.service';
import { SendOtpDto } from 'src/otp/dto/send-otp.dto';
import { OtpModeEnum } from 'src/otp/enums/otp-mode.enum';
import { BrevoService } from 'src/notification/services/brevo.service';
import { OtpTemplate } from 'src/notification/templates/otp.template';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';
import { CreateCustomerAddressDto } from '../dto/address.dto';
import { buildAddressString } from 'src/geo/utils/build-address';
import { LocationService } from 'src/geo/location.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as admin from 'firebase-admin';
import { FirebaseAuthDto, FirebaseRefreshDto } from './dto/firebase-auth.dto';
import axios from 'axios';

@Injectable({ scope: Scope.REQUEST })
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otpService: OtpService,
    private readonly authService: AuthService,
    private readonly brevoService: BrevoService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly locationService: LocationService,
    @InjectQueue('retention') private readonly retentionQueue: Queue,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  async triggerGuestMerge(
    targetCustomerId: string,
    deviceId?: string,
    ip?: string,
  ) {
    const devId =
      deviceId ||
      (this.request?.headers?.['x-device-id'] as string | undefined);
    const clientIp = ip || this.request?.ip;

    if (!devId && !clientIp) return;
    try {
      const conditions: any[] = [];
      if (devId) {
        conditions.push({ deviceId: devId });
      }
      if (clientIp) {
        conditions.push({ ip: clientIp });
      }

      const guest = await this.prisma.guestCustomer.findFirst({
        where: {
          OR: conditions,
          isActive: true,
        },
        select: { id: true },
      });

      if (guest) {
        this.logger.log(
          `Queueing guest merge from GuestCustomer ${guest.id} to Customer ${targetCustomerId} for deviceId: ${devId}, ip: ${clientIp}`,
        );
        await this.retentionQueue.add('guest.merge', {
          guestCustomerId: guest.id,
          targetCustomerId,
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to trigger guest merge: ${(err as any).message}`,
      );
    }
  }

  private async resolveCustomerIdForAuth(user: {
    email: string;
    customerId: string | null;
  }) {
    if (user.customerId) return user.customerId;

    const row = await this.prisma.user.findFirst({
      where: { email: user.email.trim().toLowerCase() },
      select: { customer: { select: { id: true } } },
    });

    return row?.customer?.id ?? null;
  }

  private ensureCustomerCanLogin(user: {
    customerId: string | null;
    status: CustomerStatus | null;
  }) {
    console.log('Checking customer login eligibility:', user);
    if (!user.customerId || !user.status) {
      throw new NotFoundException(
        'Customer profile not found or status missing',
      );
    }

    if (user.status === CustomerStatus.BLOCKED) {
      throw new ForbiddenException(
        'Blocked users cannot log in. Please contact support for more information.',
      );
    }

    if (user.status !== CustomerStatus.ACTIVE) {
      throw new ForbiddenException('User is not active');
    }
  }

  private async issueTokens(
    user: {
      id: string;
      email: string;
      role: Role;
      customerId: string | null;
    },
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
    const customerId = await this.resolveCustomerIdForAuth(user);

    if (customerId) {
      const devId =
        extra?.deviceId ||
        (this.request?.headers?.['x-device-id'] as string | undefined);
      const clientIp = extra?.ip || this.request?.ip;
      if (devId || clientIp) {
        void this.triggerGuestMerge(customerId, devId, clientIp);
      }
    }

    let name = extra?.name;
    let avatar = extra?.avatar;
    let firebaseUid = extra?.firebaseUid;

    if (customerId && (!name || !avatar || !firebaseUid)) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { name: true, avatar: true, firebaseUid: true },
      });
      if (customer) {
        name = name ?? customer.name;
        avatar = avatar ?? customer.avatar;
        firebaseUid = firebaseUid ?? customer.firebaseUid;
      }
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      customerId,
    };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, { expiresIn: '30d' });

    const clientIp = extra?.ip || this.request?.ip;
    const userAgent = this.request?.headers?.['user-agent'] as
      | string
      | undefined;

    fireAndForget(
      this.auditService.log({
        userId: user.id,
        action: 'USER_LOGIN_AUTH',
        resource: 'USER',
        resourceId: user.id,
        metadata: {
          email: user.email,
          role: user.role,
          customerId,
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
        customerId,
      },
      accessToken,
      refreshToken,
      firebaseUid: firebaseUid ?? null,
      firebaseIdToken: extra?.firebaseIdToken ?? null,
      firebaseRefreshToken: extra?.firebaseRefreshToken ?? null,
      name: name ?? null,
      avatar: avatar ?? null,
    };
  }

  private async findAuthUserByEmail(email: string) {
    const row = (await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        customer: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })) as {
      id: string;
      email: string;
      role: Role;
      passwordHash: string;
      customer?: { id: string; status: CustomerStatus } | null;
    } | null;

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      customerId: row.customer?.id ?? null,
      passwordHash: row.passwordHash,
      status: row.customer?.status,
    } as CustomerAuthUser;
  }

  private async findAuthUserByPhone(phone: string) {
    const normalizedPhone = phone.trim();
    const customer = await this.prisma.customer.findFirst({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        status: true,
        userId: true,
        phone: true,
        isPhoneVerified: true,
      },
    });

    if (!customer) {
      return null;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: customer.userId,
        role: Role.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        role: true,
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
      customerId: customer.id,
      status: customer.status,
      passwordHash: user.passwordHash,
    } as CustomerAuthUser;
  }

  async firebaseAuth(dto: FirebaseAuthDto) {
    const { idToken, email, name, avtar, provider } = dto;

    if (!idToken || !email) {
      throw new BadRequestException('ID token and email are required');
    }

    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error: any) {
      throw new UnauthorizedException('Invalid Firebase ID token', error);
    }

    const firebaseUid = decodedToken.uid;

    const existingUser = await this.findAuthUserByEmail(email);

    if (existingUser) {
      this.ensureCustomerCanLogin({
        customerId: existingUser.customerId,
        status: existingUser.status,
      });

      if (existingUser.role !== Role.CUSTOMER) {
        throw new UnauthorizedException('Invalid credentials');
      }

      let nameFromDb: string | null | undefined = name;
      let avatarFromDb: string | null | undefined = avtar;
      if (existingUser.customerId) {
        const cust = await this.prisma.customer.findUnique({
          where: { id: existingUser.customerId },
          select: { name: true, avatar: true },
        });
        if (cust) {
          nameFromDb = name ?? cust.name;
          avatarFromDb = avtar ?? cust.avatar;
        }
      }

      return this.issueTokens(existingUser, {
        firebaseUid,
        firebaseIdToken: idToken,
        firebaseRefreshToken: dto.refreshToken,
        name: nameFromDb,
        avatar: avatarFromDb,
      });
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email: email.trim().toLowerCase(),
            passwordHash: '',
            role: Role.CUSTOMER,
          },
          select: {
            id: true,
            email: true,
            role: true,
          },
        });

        const customer = await tx.customer.create({
          data: {
            userId: user.id,
            name: name ?? email.split('@')[0],
            altEmail: email,
            avatar: avtar ?? null,
            firebaseUid: firebaseUid,
            isPhoneVerified: false,
            isEmailVerified: true,
          },
        });

        return { user, customer };
      },
      { timeout: 10000 },
    );

    return this.issueTokens(
      {
        ...result.user,
        customerId: result.customer.id,
      },
      {
        firebaseUid,
        firebaseIdToken: idToken,
        firebaseRefreshToken: dto.refreshToken,
        name: result.customer.name,
        avatar: result.customer.avatar,
      },
    );
  }

  async firebaseRefresh(dto: FirebaseRefreshDto) {
    const apiKey = this.configService.get<string>('FIREBASE_WEB_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Firebase Web API Key is not configured');
    }

    let googleResponse;
    try {
      const response = await axios.post(
        `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: dto.refreshToken,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      googleResponse = response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      throw new UnauthorizedException(
        `Failed to refresh Firebase token: ${errorMsg}`,
      );
    }

    const newIdToken = googleResponse.id_token;
    const newRefreshToken = googleResponse.refresh_token;

    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(newIdToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid refreshed Firebase ID token');
    }

    const email = decodedToken.email;
    if (!email) {
      throw new BadRequestException('Email not found in refreshed token');
    }

    const user = await this.findAuthUserByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.ensureCustomerCanLogin({
      customerId: user.customerId,
      status: user.status,
    });

    if (user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let name = decodedToken.name || null;
    let avatar = decodedToken.picture || null;
    if (user.customerId) {
      const cust = await this.prisma.customer.findUnique({
        where: { id: user.customerId },
        select: { name: true, avatar: true },
      });
      if (cust) {
        name = name ?? cust.name;
        avatar = avatar ?? cust.avatar;
      }
    }

    return this.issueTokens(user, {
      firebaseUid: decodedToken.uid,
      firebaseIdToken: newIdToken,
      firebaseRefreshToken: newRefreshToken,
      name,
      avatar,
    });
  }

  async sendOtpSms(_phone: string) {
    const user = await this.prisma.customer.findFirst({
      where: { phone: _phone.trim().toLowerCase() },
    });

    if (user) {
      throw new ConflictException('Phone already registered');
    }

    const { otp, valid } = await this.otpService.generateOtp({ phone: _phone });
    console.log(
      `Generated OTP for ${_phone}: ${otp} (valid for ${valid} seconds)`,
    );

    await this.brevoService.sendSms({
      to: _phone,
      content: `Your OTP code is: ${otp}. This code is valid for 10 minutes.`,
    });

    return { message: 'OTP Sent successfully (Valid only for 10 minutes).' };
  }

  async sendOtpEmail(_email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: _email.trim().toLowerCase() },
    });

    if (user) {
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

  private async resolveAddress(
    dto: CreateCustomerAddressDto,
    customerLat?: number | null,
    customerLng?: number | null,
  ) {
    if (!dto.latitude || !dto.longitude) {
      const hasAddress = dto.city && dto.state && dto.country;

      if (hasAddress) {
        const address = buildAddressString({
          city: dto.city,
          state: dto.state,
          country: dto.country,
        });

        if (!address) {
          throw new BadRequestException('Invalid address provided');
        }

        const geo = await this.locationService.geocode(address);

        if (!geo?.lat || !geo?.lng) {
          if (customerLat && customerLng) {
            return {
              ...dto,
              latitude: customerLat,
              longitude: customerLng,
            };
          }
          throw new BadRequestException('Unable to geocode address');
        }

        return {
          ...dto,
          latitude: geo.lat,
          longitude: geo.lng,
        };
      } else if (customerLat && customerLng) {
        return {
          ...dto,
          latitude: customerLat,
          longitude: customerLng,
        };
      } else {
        throw new BadRequestException(
          'Latitude/Longitude or valid address required',
        );
      }
    }
    return dto;
  }

  async registrationByEmail(dto: RegistrationCustomerDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.findAuthUserByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    if (dto.phone) {
      const phone = dto.phone.trim();
      const existingPhone = await this.prisma.customer.findFirst({
        where: { phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone already registered');
      }
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

    const resolvedAddresses: any[] = [];
    if (dto.addresses?.length) {
      const hasDefault = dto.addresses.some((a) => a.isDefault === true);
      for (let i = 0; i < dto.addresses.length; i++) {
        const a = dto.addresses[i];
        const resolved = await this.resolveAddress(a);
        resolvedAddresses.push({
          fullName: resolved.fullName,
          phone: resolved.phone,
          addressLine1: resolved.addressLine1,
          addressLine2: resolved.addressLine2,
          city: resolved.city,
          state: resolved.state,
          postalCode: resolved.postalCode,
          country: resolved.country,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          isDefault: hasDefault ? (a.isDefault ?? false) : i === 0,
          createdAt: new Date(),
        });
      }
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: Role.CUSTOMER,
          },
          select: {
            id: true,
            email: true,
            role: true,
          },
        });

        const customer = await tx.customer.create({
          data: {
            userId: user.id,
            name: dto.name ?? email.split('@')[0],
            altEmail: email ? email : undefined,
            phone: dto.phone ? dto.phone.trim() : null,
            gender: null,
            dob: null,
            gstin: null,
            isPhoneVerified: false,
            isEmailVerified: true,
            ...(resolvedAddresses.length
              ? {
                  addresses: {
                    create: resolvedAddresses,
                  },
                }
              : {}),
          },
          include: true,
        });

        if (dto.referralCode) {
          try {
            const referrer = await tx.customer.findFirst({
              where: {
                OR: [
                  { id: dto.referralCode },
                  { phone: dto.referralCode },
                  { user: { email: dto.referralCode } },
                  { retentionSnapshot: { referralCode: dto.referralCode } },
                ],
              },
            });
            if (referrer) {
              await tx.referral.create({
                data: {
                  referrerId: referrer.id,
                  refereeId: customer.id,
                  status: 'PENDING',
                },
              });
            }
          } catch (refError: any) {
            this.logger.warn(
              `Failed to process referral code during registration: ${refError.message}`,
            );
          }
        }

        return { user, customer };
      },
      { timeout: 10000 },
    );

    // Dispatch customer registration event to retention queue
    void this.retentionQueue.add('customer.registered', {
      customerId: result.customer.id,
    });

    const clientIp = this.request?.ip;
    const userAgent = this.request?.headers?.['user-agent'] as
      | string
      | undefined;

    fireAndForget(
      this.auditService.log({
        userId: result.user.id,
        action: 'USER_REGISTER',
        resource: 'USER',
        resourceId: result.user.id,
        metadata: { email: result.user.email },
        ip: clientIp,
        userAgent,
      }),
      'USER_REGISTER',
    );

    return this.issueTokens({
      ...result.user,
      customerId: result.customer.id,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.findAuthUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.ensureCustomerCanLogin({
      customerId: user.customerId,
      status: user.status,
    });

    if (user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user);
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

      if (user.status === CustomerStatus.BLOCKED) {
        throw new ForbiddenException(
          'Account is blocked. Please contact support for more information.',
        );
      }
    } else {
      const user = await this.findAuthUserByPhone(phone ?? '');

      if (!user) {
        throw new NotFoundException('User with this phone does not exist');
      }

      if (user.status === CustomerStatus.BLOCKED) {
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

  async loginWithOtpByEmail(dto: VerifyEmailOtpDto) {
    const user = await this.findAuthUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Invalid credentials');
    }

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

    if (user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
    if (user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Only customers can verify email OTP');
    }

    const email = dto.email.trim().toLowerCase();
    const otpValid = await this.otpService.verifyOtpByEmail(email, dto.otp);
    if (!otpValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.sub },
        select: { id: true, email: true, customerId: true, role: true },
      });
      if (!currentUser) {
        throw new NotFoundException('Customer user not found');
      }

      const nextUser = await tx.user.update({
        where: { id: user.sub },
        data: { email },
        select: {
          id: true,
          email: true,
          role: true,
          customerId: true,
        },
      });

      if (currentUser.customerId) {
        await tx.franchise.update({
          where: { id: currentUser.customerId },
          data: { isEmailVerified: true, altEmail: email },
        });
      }

      return nextUser;
    });

    return {
      verified: true,
      data: updated,
    };
  }

  async verifyOtpByPhone(user: JwtUser, dto: VerifyPhoneOtpDto) {
    if (user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Only customers can verify phone OTP');
    }

    const phone = dto.phone.trim();
    const otpValid = await this.otpService.verifyOtpByPhone(phone, dto.otp);
    if (!otpValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.sub },
        select: { id: true, customerId: true, role: true },
      });

      if (!currentUser) {
        throw new NotFoundException('Account not found');
      }

      if (!currentUser.customerId) {
        throw new BadRequestException(
          'This account is not linked to a customer profile',
        );
      }

      const customer = await tx.customer.update({
        where: { id: currentUser.customerId },
        data: { ownerPhone: phone, isPhoneVerified: true },
      });

      return customer;
    });

    return {
      verified: true,
      data: updated,
    };
  }

  async refreshToken(user: JwtUser, dto: RefreshTokenDto) {
    const { sub: userId } = user;
    const { refreshToken } = dto;

    let payload: {
      sub: string;
      email: string;
      role: Role;
      customerId: string | null;
    };
    try {
      payload = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.sub !== userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const userInfo = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, customer: true },
    });

    if (!userInfo) {
      throw new UnauthorizedException('Invalid refresh token AA');
    }

    if (userInfo.role !== Role.CUSTOMER || user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Invalid refresh tokenBB');
    }

    if (user.customerId === null) {
      throw new UnauthorizedException('Invalid refresh token CC');
    }

    console.log('Refresh token payload:', user);
    return this.issueTokens({
      id: userInfo.id,
      email: userInfo.email,
      role: userInfo.role,
      customerId: user.customerId || userInfo.customer?.id || null,
    });
  }

  async changePassword(user: JwtUser, dto: ChangePasswordDto, ip?: string) {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
      ip,
    );
  }

  async forgotPasswordViaEmailViaToken(email: string) {
    const user = await this.findAuthUserByEmail(email);
    if (!user) {
      return { ok: true as const };
    }

    if (user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Only customers can use this endpoint');
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

    console.log('Token:', raw);
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

    if (user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Only customers can use this endpoint');
    }

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
        `customer:profile:${user.id}`,
      ]),
      'customer resetPasswordViaEmailViaToken session clear',
    );
    return { ok: true as const };
  }

  async forgotPasswordViaEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        role: Role.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        customer: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!user || !user.customer) {
      throw new NotFoundException(
        'User with this email does not exist or blocked',
      );
    }

    if (user.customer.status !== CustomerStatus.ACTIVE) {
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

    if (user.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Customer access required');
    }

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
      this.redisService.del([
        `user:session:${user.id}`,
        `customer:profile:${user.id}`,
      ]),
      'customer updatePassword session clear',
    );
    return { ok: true as const };
  }

  async logOut(_userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId: _userId, expiresAt: { gt: new Date() } },
      data: { revoked: true },
    });
    fireAndForget(
      this.redisService.del([
        `user:session:${_userId}`,
        `customer:profile:${_userId}`,
      ]),
      'customer logOut session clear',
    );
    return { ok: true as const };
  }

  async findOne(userId: string) {
    const cacheKey = `customer:profile:${userId}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: Role.CUSTOMER },
      select: {
        email: true,
        customer: {
          select: {
            id: true,
            name: true,
            userId: true,
            altEmail: true,
            phone: true,
            dob: true,
            gender: true,
            avatar: true,
            status: true,
            gstin: true,
            isPhoneVerified: true,
            isEmailVerified: true,
            latitude: true,
            longitude: true,
            addresses: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    fireAndForget(
      this.redisService.set(cacheKey, user, 300),
      'cache customer profile',
    );

    return user;
  }

  async update(userId: string, dto: UpdateCustomerDto) {
    const user = await this.findAuthUserByEmail(dto.email ?? '');
    if (dto.email && user && user.id !== userId) {
      throw new ConflictException('Email already in use');
    }

    try {
      const currentCustomer = await this.prisma.customer.findUnique({
        where: { userId },
        select: {
          latitude: true,
          longitude: true,
          addresses: { select: { id: true, isDefault: true } },
        },
      });

      const customerLat = currentCustomer?.latitude;
      const customerLng = currentCustomer?.longitude;

      const resolvedAddresses: any[] = [];
      for (const a of dto.addresses ?? []) {
        const resolved = await this.resolveAddress(a, customerLat, customerLng);
        resolvedAddresses.push({
          fullName: resolved.fullName,
          phone: resolved.phone,
          addressLine1: resolved.addressLine1,
          addressLine2: resolved.addressLine2,
          city: resolved.city,
          state: resolved.state,
          postalCode: resolved.postalCode,
          country: resolved.country,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          isDefault: a.isDefault ?? false,
          createdAt: new Date(),
        });
      }

      const hasDefault = resolvedAddresses.some((a) => a.isDefault);
      if (!hasDefault && resolvedAddresses.length > 0) {
        resolvedAddresses[0].isDefault = true;
      }

      const existingDefaultIds =
        currentCustomer?.addresses
          ?.filter((a) => a.isDefault)
          .map((a) => a.id) ?? [];

      const userUpdate = this.prisma.user.update({
        where: { id: userId, role: Role.CUSTOMER },
        data: {
          ...(dto.email && {
            email: dto.email.trim().toLowerCase(),
          }),
        },
      });

      const customerUpdate = this.prisma.customer.update({
        where: { userId },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.altEmail && {
            altEmail: dto.altEmail.trim().toLowerCase(),
          }),
          ...(dto.phone && { phone: dto.phone.trim() }),
          ...(dto.avatar && { avatar: dto.avatar.trim() }),
          ...(dto.gstin && { gstin: dto.gstin.trim() }),
          ...(dto.gender && { gender: dto.gender }),
          ...(dto.dob && { dob: new Date(dto.dob) }),
          ...(existingDefaultIds.length > 0 && {
            addresses: {
              updateMany: existingDefaultIds.map((id) => ({
                where: { id },
                data: { isDefault: false },
              })),
            },
          }),
          ...(dto.addresses !== undefined && {
            addresses: {
              create: resolvedAddresses,
            },
          }),
        },
        include: { addresses: true },
      });

      const [updatedUser, customer] = await this.prisma.$transaction([
        userUpdate,
        customerUpdate,
      ]);

      fireAndForget(
        this.redisService.del([
          `user:session:${userId}`,
          `user:getme:${userId}`,
          `customer:profile:${userId}`,
        ]),
        'customer updateProfile session clear',
      );

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        customer,
      };
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new NotFoundException('Account or customer not found');
      }

      if (e.code === 'P2002') {
        throw new BadRequestException('Email already in use');
      }

      throw e;
    }
  }

  async accountRecovery(dto: RecoveryDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        role: true,
        customer: { select: { status: true } },
      },
    });

    if (!user || user.role !== Role.CUSTOMER || !user.customer) {
      throw new NotFoundException('Customer account not found');
    }

    if (user.customer.status === CustomerStatus.ACTIVE) {
      throw new BadRequestException(
        'Account with this email is already active. Please login instead.',
      );
    }

    if (user.customer.status === CustomerStatus.BLOCKED) {
      throw new BadRequestException(
        'Account with this email is blocked. Please contact support.',
      );
    }

    const otpValid = await this.otpService.verifyOtpByEmail(dto.email, dto.otp);

    if (!otpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    const updated = await this.prisma.customer.update({
      where: { userId: user.id },
      data: {
        status: CustomerStatus.ACTIVE,
      },
    });

    fireAndForget(
      this.redisService.del([
        `user:session:${user.id}`,
        `customer:profile:${user.id}`,
      ]),
      'customer verifyOtpAndRecovery session clear',
    );

    return { ok: true as const, customer: updated };
  }

  async softDelete(user: JwtUser, ip: string) {
    if (user.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Customer access required');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { customer: { select: { id: true } } },
    });

    const customerId = user.customerId ?? existing?.customer?.id ?? null;

    if (!existing || !customerId) {
      throw new BadRequestException(
        'Customer user record not found for this account',
      );
    }

    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { status: CustomerStatus.ARCHIVED },
    });

    fireAndForget(
      this.auditService.log({
        userId: user.sub,
        action: 'customer_account_deleted',
        resource: 'customer',
        resourceId: customerId,
        metadata: {
          customerId,
        },
        ip,
      }),
      'customer_account_deleted',
    );

    fireAndForget(
      this.redisService.del([
        `user:session:${user.sub}`,
        `customer:profile:${user.sub}`,
      ]),
      'customer softDelete session clear',
    );
    fireAndForget(this.redisService.clearCacheByPrefix('admin:customer:'));
    fireAndForget(this.redisService.del([`admin:customer:${customer.id}`]));

    return { ok: true as const, customer };
  }

  /*

    async reorderSuggestionsForCustomer(
      customerId: string | null,
    ): Promise<{ data: unknown[]; meta: IMeta }> {
      if (!customerId) {
        throw new NotFoundException('Account not found');
      }
      let rows: Array<{
        productId: string;
        quantity: number;
        lowStockThreshold: number;
        reserved?: number;
        product: { name: string; category: { name: string } };
      }> = [];
      try {
        rows = await this.prisma.franchiseStock.findMany({
          where: { customerId },
          orderBy: { product: { name: 'asc' } },
          include: { product: { include: { category: true } } },
        });
      } catch (err) {
        if (!this.isMissingReservedColumn(err)) throw err;
        const fallback = await this.prisma.franchiseStock.findMany({
          where: { franchiseId },
          orderBy: { product: { name: 'asc' } },
          select: {
            productId: true,
            quantity: true,
            lowStockThreshold: true,
            product: {
              select: { name: true, category: { select: { name: true } } },
            },
          },
        });
        rows = fallback.map((r) => ({ ...r, reserved: 0 }));
      }

      const result = rows
        .map((r) => {
          const available = Math.max(0, r.quantity - (r.reserved ?? 0));
          return { ...r, available };
        })
        .filter((r) => r.available <= r.lowStockThreshold)
        .map((r) => ({
          productId: r.productId,
          name: r.product.name,
          category: r.product.category.name,
          quantity: r.quantity,
          reserved: r.reserved ?? 0,
          available: r.available,
          lowStockThreshold: r.lowStockThreshold,
          suggestedOrderQty: Math.max(
            r.lowStockThreshold * 2 - r.available,
            r.lowStockThreshold,
          ),
        }));

      return {
        data: result,
        meta: {
          count: result.length,
        },
      };
    }*/
}
