import { Prisma } from '@prisma/client';

export const buildPrismaPriceRangeFilter = (range: {
  minPrice?: number;
  maxPrice?: number;
}): Prisma.DecimalFilter => {
  const { minPrice, maxPrice } = range;

  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    throw new Error('minPrice cannot be greater than maxPrice');
  }

  if (
    (minPrice != null && minPrice < 0) ||
    (maxPrice != null && maxPrice < 0)
  ) {
    throw new Error('Price cannot be negative');
  }

  const price: Prisma.DecimalFilter = {};

  if (minPrice != null) {
    price.gte = new Prisma.Decimal(minPrice);
  }

  if (maxPrice != null) {
    price.lte = new Prisma.Decimal(maxPrice);
  }

  return price;
};

export const buildPrismaRatingRangeFilter = (range: {
  minRatingOrComment?: number;
  maxRatingOrComment?: number;
}): Prisma.IntFilter | undefined => {
  const { minRatingOrComment, maxRatingOrComment } = range;

  // No filters
  if (minRatingOrComment == null && maxRatingOrComment == null) {
    return undefined;
  }

  // Invalid range
  if (
    minRatingOrComment != null &&
    maxRatingOrComment != null &&
    minRatingOrComment > maxRatingOrComment
  ) {
    return undefined;
  }

  // Negative not allowed (optional rule)
  if (
    (minRatingOrComment != null && minRatingOrComment < 0) ||
    (maxRatingOrComment != null && maxRatingOrComment < 0)
  ) {
    return undefined;
  }

  const rating: Prisma.IntFilter = {};

  if (minRatingOrComment != null) {
    rating.gte = Math.floor(minRatingOrComment);
  }

  if (maxRatingOrComment != null) {
    rating.lte = Math.floor(maxRatingOrComment);
  }

  return Object.keys(rating).length ? rating : undefined;
};

export const buildPrismaDateRangeFilter = (range: {
  fromDate?: string;
  toDate?: string;
}): Prisma.DateTimeFilter | undefined => {
  const { fromDate, toDate } = range;

  if (!fromDate && !toDate) {
    return undefined;
  }

  // Build UTC boundaries safely
  const start = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : undefined;

  const end = toDate ? new Date(`${toDate}T23:59:59.999Z`) : undefined;

  // Validate
  if ((start && isNaN(start.getTime())) || (end && isNaN(end.getTime()))) {
    return undefined;
  }

  if (start && end && start > end) {
    return undefined;
  }

  const date: Prisma.DateTimeFilter = {};

  if (start) {
    date.gte = start;
  }

  if (end) {
    date.lte = end;
  }

  return Object.keys(date).length ? date : undefined;
};
