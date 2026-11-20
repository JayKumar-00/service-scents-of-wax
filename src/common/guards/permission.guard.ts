import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PERMISSION_MODULE_KEY } from '../constants';
import { AppRoleSnapshot } from '../types/rbac.types';
import {
  isExportQueryEnabled,
  mergePermissionGrants,
  normalizePermissionModuleName,
  resolvePermissionAction,
} from '../utils/permission.util';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const moduleName = this.reflector.getAllAndOverride<string>(
      PERMISSION_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!moduleName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { role?: Role; appRole?: AppRoleSnapshot | null }
      | undefined;

    if (!user) {
      throw new ForbiddenException('Permission denied');
    }

    if (
      user.role === Role.SUPERADMIN ||
      user.role === Role.CUSTOMER ||
      user.role === Role.FRANCHISE_OWNER
    ) {
      return true;
    }

    const appRole = user.appRole;
    if (!appRole || !appRole.isActive) {
      throw new ForbiddenException('Permission denied');
    }

    const action = resolvePermissionAction(
      request.method,
      request.query?.export,
    );

    if (!action) {
      return true;
    }

    const permissionMap = mergePermissionGrants(appRole.permissions);
    const normalizedModuleName = normalizePermissionModuleName(moduleName);
    const modulePermission = permissionMap.get(normalizedModuleName);

    if (!modulePermission || !modulePermission[action]) {
      throw new ForbiddenException(
        isExportQueryEnabled(request.query?.export)
          ? `Missing export permission for ${moduleName}`
          : `Missing permission for ${moduleName}`,
      );
    }

    return true;
  }
}
