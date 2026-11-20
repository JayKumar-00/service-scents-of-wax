import { SetMetadata } from '@nestjs/common';
import { PERMISSION_MODULE_KEY } from '../constants';
import {
  AppRoleModuleEnum,
  FranchiseOwnerModuleEnum,
  ModuleName,
  SuperAdminModuleEnum,
} from '../../staff-management/enums/module-name.enum';

export type PermissionModuleName =
  | ModuleName
  | SuperAdminModuleEnum
  | FranchiseOwnerModuleEnum
  | AppRoleModuleEnum;

export const PermissionModule = (moduleName: PermissionModuleName) =>
  SetMetadata(PERMISSION_MODULE_KEY, String(moduleName).trim().toLowerCase());
