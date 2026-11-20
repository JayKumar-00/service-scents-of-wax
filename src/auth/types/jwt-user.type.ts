import { Role } from '@prisma/client';
import { AppRoleSnapshot } from 'src/common/types/rbac.types';

export type JwtUser = {
  sub: string;
  email: string;
  role: Role;
  franchiseId?: string;
  customerId?: string;
  adminOwnerId?: string;
  franchiseOwnerId?: string;
  appRole?: AppRoleSnapshot | null;
};
