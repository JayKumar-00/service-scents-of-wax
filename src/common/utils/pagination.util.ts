import { FranchiseStatus } from '@prisma/client';
import { OrderType } from 'src/common/dto/query.dto';
import { buildPrismaTextSearchFilter } from './search.util';

export interface PaginationMeta {
  count: number;
  totalPages: number;
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginatePrismaOptions<T> {
  model: {
    // Accept flexible Prisma delegate signatures (optional args, broader types)
    count: (args?: any) => Promise<number>;
    findMany: (args?: any) => Promise<T[]>;
  };
  where?: Record<string, unknown>;
  orderBy?: Record<string, OrderType> | Array<Record<string, OrderType>>;
  page?: number | string;
  limit?: number | string;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
}

export interface PaginateModelOptions<T> {
  model: {
    countDocuments: (filterQuery: Record<string, unknown>) => Promise<number>;
    find: (filterQuery: Record<string, unknown>) => {
      sort: (sortOption: unknown) => {
        skip: (skip: number) => {
          limit: (limit: number) => {
            lean: () => Promise<T[]>;
          };
        };
      };
    };
  };
  filterQuery?: Record<string, unknown>;
  sortOption?: unknown;
  page?: number | string;
  limit?: number | string;
}

export const normalizePositiveInteger = (
  value: number | string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
};

const normalizeDate = (value: string, endOfDay = false): Date => {
  const date = new Date(value);

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
};

export const buildSearchFilter = (
  search: string | undefined,
  fields: string[],
): Record<string, unknown> => {
  return buildPrismaTextSearchFilter(search, fields);
};

export const buildDateFilter = (
  field: string,
  fromDate?: string,
  lastDate?: string,
): Record<string, unknown> => {
  if (!fromDate && !lastDate) {
    return {};
  }

  const range: Record<string, Date> = {};

  if (fromDate) {
    range.gte = normalizeDate(fromDate);
  }

  if (lastDate) {
    range.lte = normalizeDate(lastDate, true);
  }

  return {
    [field]: range,
  };
};

export const buildSortOrder = (
  sortBy: string | undefined,
  order: OrderType | undefined,
  allowedFields: string[],
  defaultField = 'createdAt',
): Record<string, OrderType> => {
  const field = allowedFields.includes(sortBy ?? '')
    ? (sortBy as string)
    : defaultField;

  return {
    [field]: order ?? OrderType.DESC,
  };
};

export const buildPrismaSortOrder = (
  sortBy: string | undefined,
  order: OrderType | undefined,
): any => {
  const direction = order ?? OrderType.DESC;

  switch (sortBy) {
    case 'createdAt':
      return { createdAt: direction };

    case 'totalCredit':
      return { totalCredit: direction };

    case 'usedCredit':
      return { usedCredit: direction };

    case 'availableCredit':
      return { availableCredit: direction };

    case 'status':
      return { status: direction };

    case 'franchise.businessName':
      return {
        franchise: {
          businessName: direction,
        },
      };

    case 'franchise.ownerFullName':
      return {
        franchise: {
          ownerFullName: direction,
        },
      };

    default:
      return { createdAt: direction };
  }
};

export const buildFranchiseFilter = (query: {
  search?: string;
  status?: FranchiseStatus;
  state?: string;
  fromDate?: string;
  lastDate?: string;
}): Record<string, unknown> => {
  const clauses: Record<string, unknown>[] = [];

  const searchFilter = buildSearchFilter(query.search, [
    'name',
    'code',
    'ownerFullName',
    'ownerPhone',
    'ownerEmail',
    'businessName',
    'gstNumber',
    'panNumber',
    'territory',
    'state',
    'city',
  ]);

  if (Object.keys(searchFilter).length > 0) {
    clauses.push(searchFilter);
  }

  if (query.status) {
    clauses.push({
      status: query.status,
    });
  }

  const state = query.state?.trim();
  if (state) {
    clauses.push({
      state,
    });
  }

  const dateFilter = buildDateFilter(
    'createdAt',
    query.fromDate,
    query.lastDate,
  );
  if (Object.keys(dateFilter).length > 0) {
    clauses.push(dateFilter);
  }

  return clauses.length > 0 ? { AND: clauses } : {};
};

export const paginatePrisma = async <T>({
  model,
  where = {},
  orderBy = { createdAt: OrderType.DESC },
  page = 1,
  limit = 10,
  select,
  include,
}: PaginatePrismaOptions<T>): Promise<PaginationResult<T>> => {
  const currentPage = normalizePositiveInteger(page, 1);
  const pageLimit = normalizePositiveInteger(limit, 10);
  const skip = (currentPage - 1) * pageLimit;

  const total = await model.count({ where });
  const totalPages = total > 0 ? Math.ceil(total / pageLimit) : 0;
  const data =
    total > 0
      ? await model.findMany({
          where,
          orderBy,
          skip,
          take: pageLimit,
          ...(select ? { select } : {}),
          ...(include ? { include } : {}),
        })
      : [];

  return {
    data,
    meta: {
      count: total,
      totalPages,
      page: currentPage,
      limit: pageLimit,
    },
  };
};

export const paginateModel = async <T>({
  model,
  filterQuery = {},
  sortOption = {},
  page = 1,
  limit = 10,
}: PaginateModelOptions<T>): Promise<PaginationResult<T>> => {
  const currentPage = normalizePositiveInteger(page, 1);
  const pageLimit = normalizePositiveInteger(limit, 10);
  const skip = (currentPage - 1) * pageLimit;

  const total = await model.countDocuments(filterQuery);
  const totalPages = total > 0 ? Math.ceil(total / pageLimit) : 0;
  const data =
    total > 0
      ? await model
          .find(filterQuery)
          .sort(sortOption)
          .skip(skip)
          .limit(pageLimit)
          .lean()
      : [];

  return {
    data,
    meta: {
      count: total,
      totalPages,
      page: currentPage,
      limit: pageLimit,
    },
  };
};
