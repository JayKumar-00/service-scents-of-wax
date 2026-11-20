import { Role } from '@prisma/client';
import { CustomerStatus } from '@prisma/client';

export type CustomerAuthUser = {
  id: string;
  email: string;
  role: Role;
  customerId: string | null;
  status: CustomerStatus | null;
  passwordHash: string;
};
