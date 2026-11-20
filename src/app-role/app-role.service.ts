import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  RequestMethod,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';
import { RedisService } from 'src/redis/redis.service';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { DiscoveryService } from '@nestjs/core';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import { AssignRolePermissionsDto } from './dto/assign-role-permissions.dto';
import { CreateAppRoleDto } from './dto/create-app-role.dto';
import {
  BooleanEnum,
  SetAppRoleActiveDto,
  UpdateAppRoleDto,
} from './dto/update-app-role.dto';
import { AppRoleQueryDto } from './dto/app-role.query.dto';
import { paginatePrisma } from 'src/common/utils/pagination.util';
import { buildPrismaTextSearchFilter } from 'src/common/utils/search.util';
import { normalizePermissionModuleName } from 'src/common/utils/permission.util';
import { OrderType } from 'src/common/dto/query.dto';
import {
  PermissionAction,
  AppRoleModuleEnum,
  resolveAppRoleModuleValues,
} from 'src/staff-management/enums/module-name.enum';
import { PERMISSION_MODULE_KEY } from 'src/common/constants';

const roleSelect = {
  id: true,
  roleName: true,
  description: true,
  isActive: true,
  isSystem: true,
  franchiseId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, email: true } },
  permissions: {
    select: {
      moduleName: true,
      actions: true,
      scope: true,
    },
  },
  users: {
    select: {
      role: true,
      id: true,
      email: true,
      franchise: { select: { name: true, ownerPhone: true, status: true } },
    },
  },
  _count: { select: { users: true, permissions: true } },
} satisfies Prisma.AppRoleSelect;

@Injectable()
export class AppRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discoveryService: DiscoveryService,
    private readonly audit: AuditService,
    private readonly redisService: RedisService,
  ) {}

  private normalizeLookupValue(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/controller$/, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private resolveAllowedModules(actorRole: Role): Set<string> {
    return new Set(resolveAppRoleModuleValues(actorRole));
  }

  private resolvePermissionAction(
    method: RequestMethod,
  ): PermissionAction | null {
    switch (method) {
      case RequestMethod.GET:
        return PermissionAction.READ;
      case RequestMethod.POST:
        return PermissionAction.CREATE;
      case RequestMethod.PATCH:
      case RequestMethod.PUT:
        return PermissionAction.UPDATE;
      case RequestMethod.DELETE:
        return PermissionAction.DELETE;
      default:
        return null;
    }
  }

  getControllerActions(moduleName: AppRoleModuleEnum) {
    const lookupName = this.normalizeLookupValue(moduleName);
    const controller = this.discoveryService
      .getControllers()
      .find((wrapper) => {
        const metatype = wrapper.metatype;
        const instance = wrapper.instance;

        if (!metatype || !instance) {
          return false;
        }

        const controllerModuleName = this.normalizeLookupValue(
          String(Reflect.getMetadata(PERMISSION_MODULE_KEY, metatype) ?? ''),
        );

        return controllerModuleName === lookupName;
      });

    if (!controller?.metatype || !controller.instance) {
      throw new NotFoundException(
        `Controller for module ${moduleName} not found`,
      );
    }

    const prototype = Object.getPrototypeOf(controller.instance);
    const actions = new Set<PermissionAction>();

    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      if (methodName === 'constructor') {
        continue;
      }

      const methodRef = prototype[methodName];
      if (typeof methodRef !== 'function') {
        continue;
      }

      const requestMethod = Reflect.getMetadata(METHOD_METADATA, methodRef) as
        | RequestMethod
        | undefined;
      if (requestMethod === undefined) {
        continue;
      }

      const action = this.resolvePermissionAction(requestMethod);
      if (action) {
        actions.add(action);
      }
    }

    return {
      controllerName: controller.metatype.name,
      moduleName:
        Reflect.getMetadata(PERMISSION_MODULE_KEY, controller.metatype) ?? null,
      actions: Array.from(actions),
    };
  }

  private assertScope(actor: JwtUser, roleFranchiseId: string | null): void {
    if (actor.role === Role.SUPERADMIN || actor.role === Role.ADMIN_STAFF) {
      return;
    }

    const actorFranchiseId =
      actor.role === Role.FRANCHISE_STAFF
        ? (actor.franchiseOwnerId ?? actor.franchiseId)
        : (actor.franchiseId ?? actor.franchiseOwnerId);

    if (!actorFranchiseId) {
      throw new ForbiddenException(
        'Franchise owner or staff must have franchiseId',
      );
    }

    if (roleFranchiseId !== actorFranchiseId) {
      throw new ForbiddenException(
        'Cannot access roles outside your franchise',
      );
    }
  }

  async create(dto: CreateAppRoleDto, actor: JwtUser, ip?: string) {
    if (
      actor.role !== Role.SUPERADMIN &&
      actor.role !== Role.FRANCHISE_OWNER &&
      actor.role !== Role.FRANCHISE_STAFF
    ) {
      throw new ForbiddenException(
        'Only superadmin, franchise owner or franchise staff can create roles',
      );
    }

    const isFranchiseRole =
      actor.role === Role.FRANCHISE_OWNER ||
      actor.role === Role.FRANCHISE_STAFF;

    const franchiseId = isFranchiseRole
      ? ((actor.role === Role.FRANCHISE_STAFF
          ? actor.franchiseOwnerId
          : actor.franchiseId) ?? null)
      : null;

    if (isFranchiseRole && !franchiseId) {
      throw new ForbiddenException(
        'Franchise owner or staff must have franchiseId',
      );
    }

    const allowedModules = this.resolveAllowedModules(actor.role);
    const seenModules = new Set<string>();
    for (const permission of dto.permissions) {
      const moduleName = normalizePermissionModuleName(permission.moduleName);

      if (!allowedModules.has(moduleName)) {
        throw new BadRequestException(
          `Module ${moduleName} is not allowed for ${actor.role.toLowerCase()} app roles`,
        );
      }

      if (seenModules.has(moduleName)) {
        throw new BadRequestException(
          `Duplicate permission module in payload: ${moduleName}`,
        );
      }
      seenModules.add(moduleName);
    }

    const role = await this.prisma.appRole.create({
      data: {
        roleName: dto.roleName.trim(),
        description: dto.description?.trim() ?? null,
        franchiseId,
        isSystem: false,
        createdById: actor.sub,
        permissions:
          dto.permissions.length > 0
            ? {
                create: dto.permissions.map((permission) => ({
                  moduleName: normalizePermissionModuleName(
                    permission.moduleName,
                  ),
                  actions: [...new Set(permission.actions)],
                  scope: permission.scope,
                })),
              }
            : undefined,
      },
      select: roleSelect,
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'CREATE',
        resource: 'APP_ROLE',
        resourceId: role.id,
        metadata: { roleName: role.roleName, franchiseId: role.franchiseId },
        ip,
      }),
      'APP_ROLE_CREATE',
    );

    return role;
  }

  async list(query: AppRoleQueryDto, actor: JwtUser) {
    const baseClauses: Prisma.AppRoleWhereInput[] = [];

    if (actor.role !== Role.SUPERADMIN && actor.role !== Role.ADMIN_STAFF) {
      const actorFranchiseId =
        actor.role === Role.FRANCHISE_STAFF
          ? (actor.franchiseOwnerId ?? null)
          : (actor.franchiseId ?? null);

      this.assertScope(actor, actorFranchiseId);
      baseClauses.push({ franchiseId: actorFranchiseId });
    } else if (actor.role === Role.ADMIN_STAFF) {
      baseClauses.push({ franchiseId: null });
    } else if (query.franchiseId !== undefined) {
      baseClauses.push({ franchiseId: query.franchiseId || null });
    }

    const baseWhere = baseClauses.length > 0 ? { AND: baseClauses } : {};
    const clauses = [...baseClauses];

    if (query.role) {
      if (query.role === Role.ADMIN_STAFF) {
        clauses.push({ franchiseId: null });
      } else if (query.role === Role.FRANCHISE_STAFF) {
        clauses.push({ franchiseId: { not: null } });
      }
    }

    const search = buildPrismaTextSearchFilter(query.search, [
      'roleName',
      'description',
    ]);
    if (Object.keys(search).length > 0) {
      clauses.push(search as Prisma.AppRoleWhereInput);
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const [paginatedResult, assignedRole, active, inactive] = await Promise.all(
      [
        paginatePrisma({
          model: this.prisma.appRole as any,
          where,
          page: query.page,
          limit: query.limit,
          select: roleSelect,
          orderBy: { createdAt: OrderType.DESC },
        }),
        this.prisma.appRole.count({ where: baseWhere }),
        this.prisma.appRole.count({ where: { ...baseWhere, isActive: true } }),
        this.prisma.appRole.count({ where: { ...baseWhere, isActive: false } }),
      ],
    );

    return {
      ...paginatedResult,
      meta: {
        ...(paginatedResult as any).meta,
        time: new Date().toISOString(),
        assignedRole,
        active,
        inactive,
      },
    };
  }

  async getById(id: string, actor: JwtUser) {
    const role = await this.prisma.appRole.findUnique({
      where: { id },
      select: roleSelect,
    });

    if (!role) {
      throw new NotFoundException('AppRole not found');
    }

    this.assertScope(actor, role.franchiseId);
    return role;
  }

  async update(id: string, dto: UpdateAppRoleDto, actor: JwtUser, ip?: string) {
    const role = await this.prisma.appRole.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('AppRole not found');
    }

    this.assertScope(actor, role.franchiseId);

    if (role.isSystem && actor.role !== Role.SUPERADMIN) {
      throw new ForbiddenException(
        'System roles can only be modified by superadmin',
      );
    }

    const allowedModules = this.resolveAllowedModules(
      role.franchiseId ? Role.FRANCHISE_OWNER : Role.SUPERADMIN,
    );
    const seenModules = new Set<string>();
    const permissionRows = (dto.permissions ?? []).map((permission) => {
      const moduleName = normalizePermissionModuleName(permission.moduleName);

      if (!allowedModules.has(moduleName)) {
        throw new BadRequestException(
          `Module ${moduleName} is not allowed for this app role`,
        );
      }

      if (seenModules.has(moduleName)) {
        throw new BadRequestException(
          `Duplicate permission module in payload: ${moduleName}`,
        );
      }
      seenModules.add(moduleName);

      return {
        moduleName,
        actions: [...new Set(permission.actions)],
        scope: permission.scope,
        oldModuleName: permission.oldModuleName
          ? normalizePermissionModuleName(permission.oldModuleName)
          : undefined,
      };
    });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.appRole.update({
        where: { id },
        data: {
          roleName: dto.roleName?.trim(),
          description: dto.description?.trim() ?? undefined,
          isActive: dto.isActive,
        },
      });

      for (const permission of permissionRows) {
        if (
          permission.oldModuleName &&
          permission.oldModuleName !== permission.moduleName
        ) {
          const oldModuleExists = await tx.permissionMatrix.findUnique({
            where: {
              roleId_moduleName: {
                roleId: id,
                moduleName: permission.oldModuleName,
              },
            },
          });
          if (oldModuleExists) {
            await tx.permissionMatrix.delete({
              where: {
                roleId_moduleName: {
                  roleId: id,
                  moduleName: permission.oldModuleName,
                },
              },
            });
          }
        }

        await tx.permissionMatrix.upsert({
          where: {
            roleId_moduleName: {
              roleId: id,
              moduleName: permission.moduleName,
            },
          },
          create: {
            roleId: id,
            moduleName: permission.moduleName,
            actions: permission.actions,
            scope: permission.scope ?? undefined,
          },
          update: {
            actions: permission.actions,
            scope: permission.scope ?? undefined,
          },
        });
      }

      const updatedRole = await tx.appRole.findUnique({
        where: { id },
        select: roleSelect,
      });

      if (!updatedRole) {
        throw new NotFoundException('AppRole not found');
      }

      return updatedRole;
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'UPDATE',
        resource: 'APP_ROLE',
        resourceId: id,
        metadata: {
          fromRole: JSON.stringify(role),
          toRole: JSON.stringify({ ...dto, id }),
        },
        ip,
      }),
      'APP_ROLE_UPDATE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('user:session:'),
      'role update session clear',
    );

    return result;
  }

  async setActive(
    id: string,
    dto: SetAppRoleActiveDto,
    actor: JwtUser,
    ip?: string,
  ) {
    const role = await this.prisma.appRole.findUnique({
      where: { id },
      select: { id: true, franchiseId: true, isSystem: true },
    });

    if (!role) {
      throw new NotFoundException('AppRole not found');
    }

    this.assertScope(actor, role.franchiseId);

    if (role.isSystem && actor.role !== Role.SUPERADMIN) {
      throw new ForbiddenException(
        'System roles can only be modified by superadmin',
      );
    }

    const isActive = dto.isActive === BooleanEnum.TRUE;

    const updated = await this.prisma.appRole.update({
      where: { id },
      data: { isActive },
      select: roleSelect,
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'SET_ACTIVE_UPDATE',
        resource: 'APP_ROLE',
        resourceId: id,
        metadata: {
          fromRole: JSON.stringify(role),
          toRole: JSON.stringify(updated),
        },
        ip,
      }),
      'APP_ROLE_SET_ACTIVE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('user:session:'),
      'role setActive session clear',
    );

    return updated;
  }

  async remove(id: string, actor: JwtUser, ip?: string) {
    const role = await this.prisma.appRole.findUnique({
      where: { id },
      select: {
        id: true,
        isSystem: true,
        franchiseId: true,
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      throw new NotFoundException('AppRole not found');
    }

    this.assertScope(actor, role.franchiseId);

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    if (role._count.users > 0) {
      throw new BadRequestException(
        'Role is assigned to users and cannot be deleted',
      );
    }

    await this.prisma.appRole.delete({ where: { id } });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'APP_ROLE_DELETE',
        resource: 'APP_ROLE',
        resourceId: id,
        metadata: { deletedRole: role },
        ip,
      }),
      'APP_ROLE_DELETE',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('user:session:'),
      'role remove session clear',
    );

    return { success: true, id };
  }

  private async resolveRoleOrThrow(roleId: string, actor: JwtUser) {
    const role = await this.prisma.appRole.findUnique({
      where: { id: roleId },
      select: { id: true, roleName: true, isSystem: true, franchiseId: true },
    });

    if (!role) {
      throw new NotFoundException('AppRole not found');
    }

    // Reuse assertScope to validate actor permissions and franchise scoping
    this.assertScope(actor, role.franchiseId);

    return role;
  }

  async listPermissions(roleId: string, actor: JwtUser) {
    const role = await this.resolveRoleOrThrow(roleId, actor);

    const rows = await this.prisma.permissionMatrix.findMany({
      where: { roleId: role.id },
      orderBy: { createdAt: 'asc' },
      select: {
        roleId: true,
        moduleName: true,
        actions: true,
        createdAt: true,
        scope: true,
      },
    });

    return rows.map((r) => ({
      id: `${r.roleId}:${r.moduleName}`,
      canCreate: r.actions.includes('CREATE'),
      canRead: r.actions.includes('READ'),
      canUpdate: r.actions.includes('UPDATE'),
      canDelete: r.actions.includes('DELETE'),
      canExport: r.actions.includes('EXPORT'),
      permission: {
        id: `${r.roleId}:${r.moduleName}`,
        moduleName: r.moduleName,
      },
      createdAt: r.createdAt,
      scope: r.scope,
    }));
  }

  async removePermission(
    roleId: string,
    moduleName: string,
    actor: JwtUser,
    ip?: string,
  ) {
    const role = await this.resolveRoleOrThrow(roleId, actor);
    const normalizedModuleName = normalizePermissionModuleName(moduleName);

    const allowedModules = this.resolveAllowedModules(
      role.franchiseId ? Role.FRANCHISE_OWNER : Role.SUPERADMIN,
    );

    if (!allowedModules.has(normalizedModuleName)) {
      throw new BadRequestException(
        `Module ${moduleName} is not valid for this role type`,
      );
    }

    const exists = await this.prisma.permissionMatrix.findUnique({
      where: {
        roleId_moduleName: {
          roleId: role.id,
          moduleName: normalizedModuleName,
        },
      },
    });

    if (!exists) {
      const assignedPermissions = await this.prisma.permissionMatrix.findMany({
        where: { roleId: role.id },
        select: { moduleName: true },
      });
      const assignedModules = assignedPermissions.map((p) => p.moduleName);

      if (assignedModules.length === 0) {
        throw new NotFoundException(
          `Permission for module '${moduleName}' not found. This role currently has no module permissions assigned.`,
        );
      }

      throw new NotFoundException(
        `Permission for module '${moduleName}' not found. Assigned modules: ${assignedModules.join(', ')}`,
      );
    }

    await this.prisma.permissionMatrix.delete({
      where: {
        roleId_moduleName: {
          roleId: role.id,
          moduleName: normalizedModuleName,
        },
      },
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'PERMISSION_DELETE_FROM_APP_ROLE',
        resource: 'PERMISSION',
        resourceId: role.id,
        metadata: { deletedPermission: exists },
        ip,
      }),
      'APP_ROLE_REMOVE_PERMISSION',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('user:session:'),
      'role removePermission session clear',
    );

    return { success: true, roleId: role.id, moduleName: normalizedModuleName };
  }

  async assignPermissions(
    roleId: string,
    dto: AssignRolePermissionsDto,
    actor: JwtUser,
    ip?: string,
  ) {
    const role = await this.resolveRoleOrThrow(roleId, actor);
    const permissions = dto.permissions ?? [];
    const allowedModules = this.resolveAllowedModules(
      role.franchiseId ? Role.FRANCHISE_OWNER : Role.SUPERADMIN,
    );

    const rows = permissions.map((permission) => {
      const moduleName = normalizePermissionModuleName(permission.moduleName);

      if (!allowedModules.has(moduleName)) {
        throw new BadRequestException(
          `Module ${moduleName} is not allowed for this app role`,
        );
      }

      const actions: Array<'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT'> =
        [];
      if (permission.canCreate) actions.push('CREATE');
      if (permission.canRead) actions.push('READ');
      if (permission.canUpdate) actions.push('UPDATE');
      if (permission.canDelete) actions.push('DELETE');
      if (permission.canExport) actions.push('EXPORT');

      return {
        roleId: role.id,
        moduleName,
        actions,
        scope: permission.scope ?? undefined,
      };
    });

    await this.prisma.$transaction(
      async (tx) => {
        await tx.permissionMatrix.deleteMany({ where: { roleId: role.id } });

        if (rows.length > 0) {
          await tx.permissionMatrix.createMany({
            data: rows,
          });
        }
      },
      {
        maxWait: 10000,
        timeout: 10000,
      },
    );

    const finalRole = await this.prisma.appRole.findUnique({
      where: { id: role.id },
      select: {
        id: true,
        roleName: true,
        franchiseId: true,
        permissions: {
          select: {
            moduleName: true,
            actions: true,
            scope: true,
          },
        },
      },
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'APP_ROLE_ASSIGN_PERMISSIONS_UPDATE',
        resource: 'APP_ROLE',
        resourceId: role.id,
        metadata: { permissionCount: rows.length },
        ip,
      }),
      'APP_ROLE_ASSIGN_PERMISSIONS',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('user:session:'),
      'role assignPermissions session clear',
    );

    return finalRole;
  }
}
