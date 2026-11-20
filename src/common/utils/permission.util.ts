import {
  PermissionAction,
  PermissionFlags,
  PermissionMatrixGrant,
} from '../types/rbac.types';

type RequestMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const METHOD_ACTION_MAP: Partial<Record<RequestMethod, PermissionAction>> = {
  GET: 'canRead',
  POST: 'canCreate',
  PATCH: 'canUpdate',
  PUT: 'canUpdate',
  DELETE: 'canDelete',
};

export function normalizePermissionModuleName(moduleName: string): string {
  return moduleName.trim().toLowerCase();
}

export function isExportQueryEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

export function resolvePermissionAction(
  method: string | undefined,
  exportQuery: unknown,
): PermissionAction | null {
  if (method === 'GET' && isExportQueryEnabled(exportQuery)) {
    return 'canExport';
  }

  if (!method) {
    return null;
  }

  return METHOD_ACTION_MAP[method as RequestMethod] ?? null;
}

export function mergePermissionGrants(
  grants: PermissionMatrixGrant[] | undefined,
): Map<string, PermissionFlags> {
  const permissionMap = new Map<string, PermissionFlags>();

  for (const grant of grants ?? []) {
    const moduleName = normalizePermissionModuleName(grant.moduleName);
    const current = permissionMap.get(moduleName) ?? {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
      canExport: false,
    };

    permissionMap.set(moduleName, {
      canCreate: current.canCreate || grant.canCreate,
      canRead: current.canRead || grant.canRead,
      canUpdate: current.canUpdate || grant.canUpdate,
      canDelete: current.canDelete || grant.canDelete,
      canExport: current.canExport || grant.canExport,
    });
  }

  return permissionMap;
}
