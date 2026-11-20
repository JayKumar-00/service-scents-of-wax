import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from './types/jwt-user.type';
import { AppRoleSnapshot } from 'src/common/types/rbac.types';
import { RedisService } from 'src/redis/redis.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';

type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  franchiseId?: string | null;
  adminOwnerId?: string | null;
  franchiseOwnerId?: string | null;
  customerId?: string | null;
  appRole?: AppRoleSnapshot | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const cacheKey = `user:session:${payload.sub}`;
    try {
      const cached = await this.redis.get<JwtUser>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // In case Redis is down, fall back to DB query
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseId: true,
        adminId: true,
        franchiseOwnerId: true,
        customer: { select: { id: true } },
        appRole: {
          select: {
            id: true,
            roleName: true,
            description: true,
            isActive: true,
            isSystem: true,
            permissions: {
              select: {
                moduleName: true,
                actions: true,
                scope: true,
              },
            },
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    const result: Partial<JwtUser> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Prefer franchiseId/customerId from token payload (issued at login),
    // fall back to DB values if absent.
    if (payload.franchiseId) {
      result.franchiseId = payload.franchiseId;
    } else if (user.franchiseId) {
      result.franchiseId = user.franchiseId;
    }

    if (payload.adminOwnerId) {
      result.adminOwnerId = payload.adminOwnerId;
    } else if (user.adminId) {
      result.adminOwnerId = user.adminId;
    }

    if (payload.franchiseOwnerId) {
      result.franchiseOwnerId = payload.franchiseOwnerId;
    } else if (user.franchiseOwnerId) {
      result.franchiseOwnerId = user.franchiseOwnerId;
    }

    if ((payload as any).customerId) {
      result.customerId = (payload as any).customerId;
    } else if (user.customer?.id) {
      result.customerId = user.customer.id;
    }

    if (user.appRole) {
      // Convert PermissionMatrix rows (moduleName + actions[]) into PermissionMatrixGrant shape
      const convertedPermissions = user.appRole.permissions.map((p) => ({
        canCreate: p.actions.includes('CREATE'),
        canRead: p.actions.includes('READ'),
        canUpdate: p.actions.includes('UPDATE'),
        canDelete: p.actions.includes('DELETE'),
        canExport: p.actions.includes('EXPORT'),
        moduleName: p.moduleName,
      }));

      result.appRole = {
        id: user.appRole.id,
        roleName: user.appRole.roleName,
        description: user.appRole.description,
        isActive: user.appRole.isActive,
        isSystem: user.appRole.isSystem,
        permissions: convertedPermissions,
      } as AppRoleSnapshot;
    }

    const finalUser = result as JwtUser;
    fireAndForget(
      this.redis.set(cacheKey, finalUser, 600),
      'cache user session',
    );

    return finalUser;
  }
}
