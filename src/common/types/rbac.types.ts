export type PermissionAction =
  | 'canCreate'
  | 'canRead'
  | 'canUpdate'
  | 'canDelete'
  | 'canExport';

export type PermissionFlags = Record<PermissionAction, boolean>;

export type PermissionMatrixGrant = PermissionFlags & {
  moduleName: string;
};

export type AppRoleSnapshot = {
  id: string;
  roleName: string;
  description: string | null;
  isActive: boolean;
  isSystem?: boolean;
  franchiseId: string | null;
  permissions: PermissionMatrixGrant[];
};

export type PermissionAssignmentInput = {
  moduleName: string;
  canCreate?: boolean;
  canRead?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  scope?: 'ALL' | 'OWN' | 'ORG';
};
