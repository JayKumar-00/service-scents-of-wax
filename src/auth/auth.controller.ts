import {
  Body,
  Controller,
  Get,
  Ip,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from './types/jwt-user.type';
import { ChangePasswordDto, LoginDto, RecoveryDto } from './dto/user.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpsertAdminProfileDto } from 'src/auth/dto/upsert-admin-profile.dto';

@ApiTags('Authentication <- Admin')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // @Public()
  // @UseGuards(ThrottlerGuard)
  // @Throttle({
  //   default: {
  //     limit: process.env.NODE_ENV === 'production' ? 5 : 60,
  //     ttl: 900000,
  //   },
  // })
  // @Post('register')
  // register(@Body() dto: any) {
  //   return this.auth.register(dto);
  // }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 5 : 60,
      ttl: 900000,
    },
  })
  @Post('login')
  @ApiOperation({ summary: 'Admin login with email and password' })
  async login(@Body() dto: LoginDto, @Ip() ip: string) {
    const result = await this.auth.login(dto, ip);

    return {
      accessToken: result.access_token,
      refreshToken: result.access_token, // TODO: Implement real refresh token logic
      data: {
        tokenType: result.token_type,
        expiresIn: result.expires_in,
        user: {
          sub: result.user.sub,
          email: result.user.email,
          role: result.user.role,
          ...(result.user.role === Role.SUPERADMIN
            ? {
                appRole: {
                  id: result.user.appRole?.id ?? 'superadmin',
                  roleName: 'Platfom Owner',
                  description: `Superadmin has full access to all resources and permissions.`,
                  isActive: result.user.appRole?.isActive ?? true,
                  isSystem: result.user.appRole?.isSystem ?? true,
                  franchiseId: result.user.appRole?.franchiseId ?? null,
                  permissions: result.user.appRole?.permissions ?? [],
                },
              }
            : {
                appRole: {
                  roleName: result.user.appRole?.roleName,
                  description: result.user.appRole?.description,
                  isActive: result.user.appRole?.isActive,
                  permissions: result.user.appRole?.permissions,
                },
              }),
        },
      },
    };
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  async me(@CurrentUser() user: JwtUser) {
    const fresh = await this.auth.getMe(user);
    if (!fresh) {
      throw new UnauthorizedException();
    }
    return fresh;
  }

  // Creates profile first time, updates it afterwards for the logged-in admin user.
  @Patch('admin/profile/upsert')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Create or update admin profile' })
  @ApiBody({ type: UpsertAdminProfileDto })
  upsertAdminProfile(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertAdminProfileDto,
    @Ip() ip: string,
  ) {
    return this.auth.upsertAdminProfile(user.sub, dto, ip);
  }

  // Starts token-based password reset; token is returned only in debug mode.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 5 : 60,
      ttl: 900000,
    },
  })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request admin password reset token' })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestAdminPasswordReset(dto.email);
  }

  // Completes token-based password reset.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 10 : 120,
      ttl: 900000,
    },
  })
  @Patch('reset-password')
  @ApiOperation({ summary: 'Reset admin password using reset token' })
  resetPassword(@Body() dto: ResetPasswordDto, @Ip() ip: string) {
    return this.auth.resetAdminPassword(dto.token, dto.newPassword, ip);
  }

  // Changes password for an authenticated admin account.
  @Patch('change-password')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Change admin password while logged in' })
  changePassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChangePasswordDto,
    @Ip() ip: string,
  ) {
    return this.auth.changeAdminPassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
      ip,
    );
  }

  // Sends OTP to email for account recovery verification.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 5 : 60,
      ttl: 900000,
    },
  })
  @Post('account-recovery/request-otp')
  @ApiOperation({ summary: 'Request account recovery OTP for admin account' })
  requestAccountRecoveryOtp(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestAccountRecoveryOtp(dto.email);
  }

  @Public()
  @Patch('account-recovery')
  @ApiOperation({ summary: 'Recover admin account with email OTP' })
  accountRecovery(@Body() dto: RecoveryDto, @Ip() ip: string) {
    return this.auth.accountRecovery(dto, ip);
  }

  // @Public()
  // @UseGuards(ThrottlerGuard)
  // @Throttle({
  //   default: {
  //     limit: process.env.NODE_ENV === 'production' ? 5 : 60,
  //     ttl: 900000,
  //   },
  // })
  // @Post('request-password-reset/:email')
  // requestPasswordReset(
  //   @Body() dto: ResetPasswordDto,
  //   @Param('email') email: string,
  // ) {
  //   return this.auth.requestPasswordReset(email);
  // }

  // @Public()
  // @UseGuards(ThrottlerGuard)
  // @Throttle({
  //   default: {
  //     limit: process.env.NODE_ENV === 'production' ? 10 : 60,
  //     ttl: 900000,
  //   },
  // })
  // @Post('reset-password')
  // resetPassword(@Body() dto: ResetPasswordDto) {
  //   return this.auth.resetPassword(dto.token, dto.newPassword);
  // }

  // @UseGuards(ThrottlerGuard)
  // @Throttle({
  //   default: {
  //     limit: process.env.NODE_ENV === 'production' ? 10 : 120,
  //     ttl: 900000,
  //   },
  // })
  // @Post('change-password')
  // @Roles(Role.CUSTOMER)
  // changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) {
  //   return this.auth.changePassword(
  //     user.sub,
  //     dto.currentPassword,
  //     dto.newPassword,
  //   );
  // }
}
