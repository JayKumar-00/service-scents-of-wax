import { FaqAudience, FaqStatus } from '@prisma/client';
import { IMeta } from 'src/common/interceptors/envelope.interface';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  audience: FaqAudience;
  status: FaqStatus;
  isVisible: boolean;
  isDeleted: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FaqPaginationMeta extends IMeta {
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FaqListResult<T = FaqItem> {
  data: T[];
  meta: FaqPaginationMeta;
}

export interface FaqMutationResult<T = FaqItem> {
  data: T;
  message: string;
}

export interface FaqMutationContext {
  faqId: string;
  actorId: string;
  isSuperAdmin: boolean;
}
