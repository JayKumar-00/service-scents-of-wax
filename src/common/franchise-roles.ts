import { Role } from '@prisma/client';

export function franchiseHasReadAccess(role: Role): boolean {
  return (
    role === Role.FRANCHISE_OWNER ||
    role === Role.FRANCHISE_STAFF ||
    role === Role.FRANCHISE_AUDITOR
  );
}

export function franchiseCanMutate(role: Role): boolean {
  return role === Role.FRANCHISE_OWNER || role === Role.FRANCHISE_STAFF;
}
