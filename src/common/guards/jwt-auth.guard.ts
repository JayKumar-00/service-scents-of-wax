import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from 'src/prisma/prisma.service';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../constants';
import { Role } from '@prisma/client';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    /**
     * Public routes
     */
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    /**
     * JWT validation
     */
    const activate = (await super.canActivate(context)) as boolean;

    const request = context.switchToHttp().getRequest();

    const user = request.user;

    /**
     * Payload validation
     */
    if (!user?.sub || !user?.email || !user?.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    /**
     * User validation
     */
    const dbUser = await this.prisma.user.findUnique({
      where: {
        id: user.sub,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        deletedAt: true,
        franchise: { select: { status: true } },
        customer: { select: { status: true } },
        appRole: {
          select: { isActive: true, isSystem: true, permissions: true },
        },
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    /**
     * Status check
     */
    // if (
    //   !dbUser.isActive ||
    //   dbUser.deletedAt ||
    //   (dbUser.customer && dbUser.customer?.status !== CustomerStatus.ACTIVE) ||
    //   (dbUser.franchise &&
    //     dbUser.franchise?.status !== FranchiseStatus.ACTIVE) ||
    //   (dbUser.appRole && !dbUser.appRole.isActive)
    // ) {
    //   throw new UnauthorizedException('Account inactive');
    // }

    /**
     * Session validation
     * Recommended:
     * store sessionId/jti in JWT payload
     */
    // const session = await this.prisma.refreshToken.findFirst({
    //   where: {
    //     userId: dbUser.id,
    //     isRevoked: false,
    //   },
    //   select: {
    //     id: true,
    //   },
    // });

    // if (!session) {
    //   throw new UnauthorizedException('Session expired. Please login again.');
    // }

    /**
     * Role authorization
     */
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles?.length && !requiredRoles.includes(dbUser.role)) {
      throw new ForbiddenException('Access denied');
    }

    /**
     * Attach fresh DB user
     */
    request.currentUser = dbUser;

    return activate;
  }

  override handleRequest(err: any, user: any, info: any) {
    if (err) {
      throw err;
    }

    /**
     * Passport/JWT errors
     */
    if (info) {
      switch (info.name) {
        case 'TokenExpiredError':
          throw new UnauthorizedException(
            'Your session has expired. Please login again.',
          );

        case 'JsonWebTokenError':
          throw new UnauthorizedException('Invalid authentication token.');

        case 'NotBeforeError':
          throw new UnauthorizedException('Token is not active yet.');

        default:
          this.logger.warn(`Authentication error: ${info.message}`);

          throw new UnauthorizedException(info.message || 'Unauthorized');
      }
    }

    /**
     * No user from strategy
     */
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }
}

// import { ExecutionContext, Injectable } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { AuthGuard } from '@nestjs/passport';
// import { IS_PUBLIC_KEY } from '../constants';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {
//   constructor(private readonly reflector: Reflector) {
//     super();
//   }

//   override canActivate(context: ExecutionContext) {
//     const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
//       context.getHandler(),
//       context.getClass(),
//     ]);
//     if (isPublic) {
//       return true;
//     }
//     return super.canActivate(context);
//   }
// }
