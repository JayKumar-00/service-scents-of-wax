import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { buildPrismaProductTextSearchFilter } from 'src/common/utils/search.util';
import { PrismaService } from 'src/prisma/prisma.service';

export type SearchSuggestionItem = {
  type: 'product' | 'brand' | 'category';
  id: string;
  name: string;
  slug?: string | null;
  label?: string;
};

@Injectable()
export class SearchSuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(q: string): Promise<SearchSuggestionItem[]> {
    const term = q.trim();

    if (term.length < 2) {
      return [];
    }

    const filter = buildPrismaProductTextSearchFilter(term);

    const [products, brands, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          AND: [
            { status: ProductStatus.ACTIVE, visibility: true },
            filter,
          ] as Prisma.ProductWhereInput[],
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: [
          { viewCount: 'desc' },
          { reviewCount: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 5,
      }),
      this.prisma.brand.findMany({
        where: {
          name: { contains: term, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.prisma.category.findMany({
        where: {
          name: { contains: term, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { name: 'asc' },
        take: 3,
      }),
    ]);

    return this.uniqueSuggestions([
      ...products.map((product) => ({
        type: 'product' as const,
        id: product.id,
        name: product.name,
        slug: product.slug,
        label: product.name,
      })),
      ...brands.map((brand) => ({
        type: 'brand' as const,
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        label: brand.name,
      })),
      ...categories.map((category) => ({
        type: 'category' as const,
        id: category.id,
        name: category.name,
        slug: category.slug,
        label: category.name,
      })),
    ]);
  }

  private uniqueSuggestions(items: SearchSuggestionItem[]) {
    const seen = new Set<string>();

    return items.filter((item) => {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }
}
