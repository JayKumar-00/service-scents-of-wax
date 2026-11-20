import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductStatus, Role } from '@prisma/client';
import axios from 'axios';
import { OrderType } from 'src/common/dto/query.dto';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { buildPrismaProductTextSearchFilter } from 'src/common/utils/search.util';
import { paginatePrisma } from 'src/common/utils/pagination.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchSuggestionsService } from './search-suggestions.service';
import { TranslateService } from './translate.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { WarehouseService } from 'src/warehouse/warehouse.service';

export type SearchProvider = 'ollama' | 'gemini';

export interface ElasticSearchQuery {
  q?: string;
  search?: string;
  query?: string;
  page?: number | string;
  limit?: number | string;
  categoryId?: string;
  categorySlug?: string;
  brandId?: string;
  order?: OrderType;
  provider?: SearchProvider;
  sourceLanguage?: string;
}

export interface ElasticSearchResult {
  data: any[];
  meta: IMeta;
  suggestions: any[];
  ai?: {
    provider: SearchProvider | 'fallback';
    originalQuery: string;
    translatedQuery: string;
    enhancedQuery: string;
  };
}

@Injectable()
export class SmartSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suggestionsService: SearchSuggestionsService,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService,
  ) {}

  async search(
    query: ElasticSearchQuery,
    user?: JwtUser,
  ): Promise<ElasticSearchResult> {
    const originalQuery = this.normalizeQuery(
      query.q ?? query.search ?? query.query,
    );
    const translatedQuery = originalQuery
      ? await this.translateService.translateToEnglish(
          originalQuery,
          query.sourceLanguage,
        )
      : '';

    const searchVariants = this.uniqueTerms([originalQuery, translatedQuery]);

    const whereClauses: Prisma.ProductWhereInput[] = [
      {
        status: ProductStatus.ACTIVE,
        visibility: true,
      },
    ];

    if (query.categoryId) {
      whereClauses.push({ categoryId: query.categoryId });
    }

    if (query.categorySlug) {
      const categoryIds = await this.resolveCategoryTreeIds(query.categorySlug);
      if (categoryIds.length > 0) {
        whereClauses.push({ categoryId: { in: categoryIds } });
      }
    }

    if (query.brandId) {
      whereClauses.push({ brandId: query.brandId });
    }

    if (searchVariants.length > 0) {
      whereClauses.push({
        OR: searchVariants.map((variant) => ({
          ...(buildPrismaProductTextSearchFilter(variant) as any),
        })),
      } as any);
    }

    const orderBy = [
      { viewCount: 'desc' },
      { reviewCount: 'desc' },
      { createdAt: query.order ?? OrderType.DESC },
    ] as any;

    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    let result: any;
    if (
      user?.role === Role.SUPERADMIN ||
      user?.role === Role.ADMIN_STAFF ||
      user?.role === Role.FRANCHISE_OWNER ||
      user?.role === Role.FRANCHISE_STAFF
    ) {
      const authWhereClauses = [...whereClauses];
      if (
        user.role === Role.FRANCHISE_OWNER ||
        user.role === Role.FRANCHISE_STAFF
      ) {
        authWhereClauses.push({
          OR: [
            {
              warehouseStocks: {
                quantity: { gte: 1 },
              },
            },
            {
              AND: [
                { warehouseStocks: null },
                {
                  OR: [
                    {
                      variants: {
                        some: {
                          isActive: true,
                          stock: { gte: 1 },
                        },
                      },
                    },
                    {
                      AND: [{ variants: { none: {} } }, { stock: { gte: 1 } }],
                    },
                  ],
                },
              ],
            },
          ],
        });
      }

      result = await paginatePrisma<any>({
        model: this.prisma.product as any,
        where:
          authWhereClauses.length > 1
            ? { AND: authWhereClauses }
            : authWhereClauses[0],
        orderBy,
        page,
        limit,
        include: {
          category: true,
          brandRef: true,
          seo: true,
          variants: {
            include: {
              attributes: {
                include: {
                  attributeValue: {
                    select: {
                      id: true,
                      title: true,
                      attributeNameId: true,
                    },
                  },
                },
              },
            },
          },
          franchiseStocks: true,
          hubInventories: true,
          replenPolicies: true,
          warehouseStocks: true,
        },
      });
    } else {
      const publicWhereClauses = [...whereClauses];
      publicWhereClauses.push({
        OR: [
          {
            warehouseStocks: {
              quantity: { gte: 1 },
            },
          },
          {
            franchiseStocks: {
              some: {
                quantity: { gte: 1 },
              },
            },
          },
          {
            AND: [
              { warehouseStocks: null },
              {
                OR: [
                  {
                    variants: {
                      some: {
                        isActive: true,
                        stock: { gte: 1 },
                      },
                    },
                  },
                  {
                    AND: [{ variants: { none: {} } }, { stock: { gte: 1 } }],
                  },
                ],
              },
            ],
          },
        ],
      });

      result = await paginatePrisma<any>({
        model: this.prisma.product as any,
        where:
          publicWhereClauses.length > 1
            ? { AND: publicWhereClauses }
            : publicWhereClauses[0],
        orderBy,
        page,
        limit,
        include: {
          category: true,
          brandRef: true,
          seo: true,
          variants: {
            include: {
              attributes: {
                include: {
                  attributeValue: {
                    select: {
                      id: true,
                      title: true,
                      attributeNameId: true,
                    },
                  },
                },
              },
            },
          },
          franchiseStocks: { select: { quantity: true, franchiseId: true } },
          hubInventories: true,
          replenPolicies: true,
          warehouseStocks: { select: { quantity: true } },
        },
      });
    }

    return {
      data: result.data.map((product: any) => this.mapProduct(product, user)),
      meta: result.meta,
      suggestions: await this.suggestionsService.suggest(originalQuery),
    };
  }

  async aiSearch(
    query: ElasticSearchQuery,
    user?: JwtUser,
  ): Promise<ElasticSearchResult> {
    const originalQuery = this.normalizeQuery(
      query.q ?? query.search ?? query.query,
    );

    if (!originalQuery) {
      return {
        data: [],
        meta: { count: 0, page: 1, limit: 0, totalPages: 0 },
        suggestions: [],
        ai: {
          provider: 'fallback',
          originalQuery: '',
          translatedQuery: '',
          enhancedQuery: '',
        },
      };
    }

    const translatedQuery = await this.translateService.translateToEnglish(
      originalQuery,
      query.sourceLanguage,
    );
    const provider = query.provider ?? 'ollama';
    const enhancedQuery = await this.enhanceQuery(
      provider,
      translatedQuery || originalQuery,
    );

    const result = await this.search(
      {
        ...query,
        q: enhancedQuery,
        search: enhancedQuery,
      },
      user,
    );

    return {
      ...result,
      ai: {
        provider: enhancedQuery === translatedQuery ? 'fallback' : provider,
        originalQuery,
        translatedQuery,
        enhancedQuery,
      },
    };
  }

  async testAiSearch(query: ElasticSearchQuery) {
    const originalQuery = this.normalizeQuery(
      query.q ?? query.search ?? query.query,
    );
    const translatedQuery = originalQuery
      ? await this.translateService.translateToEnglish(
          originalQuery,
          query.sourceLanguage,
        )
      : '';
    const provider = query.provider ?? 'ollama';
    const enhancedQuery = originalQuery
      ? await this.enhanceQuery(provider, translatedQuery || originalQuery)
      : '';

    return {
      originalQuery,
      translatedQuery,
      enhancedQuery,
      provider,
      suggestions: originalQuery
        ? await this.suggestionsService.suggest(originalQuery)
        : [],
    };
  }

  private normalizeQuery(value?: string): string {
    return value?.trim().replace(/\s+/g, ' ') ?? '';
  }

  private uniqueTerms(values: Array<string | undefined | null>): string[] {
    return [
      ...new Set(
        values.map((value) => this.normalizeQuery(value ?? '')).filter(Boolean),
      ),
    ];
  }

  private async resolveCategoryTreeIds(slug: string): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      select: { id: true, parentId: true, slug: true },
    });

    const map = new Map(
      categories.map((category) => [category.slug, category]),
    );
    const root = map.get(slug);

    if (!root) {
      return [];
    }

    const result: string[] = [];

    const visit = (categoryId: string) => {
      if (result.includes(categoryId)) {
        return;
      }

      result.push(categoryId);

      for (const category of categories) {
        if (category.parentId === categoryId) {
          visit(category.id);
        }
      }
    };

    visit(root.id);
    return result;
  }

  private async enhanceQuery(
    provider: SearchProvider,
    query: string,
  ): Promise<string> {
    if (!query) {
      return '';
    }

    try {
      if (provider === 'gemini') {
        return await this.enhanceWithGemini(query);
      }

      return await this.enhanceWithOllama(query);
    } catch {
      return query;
    }
  }

  private async enhanceWithOllama(query: string): Promise<string> {
    const baseUrl =
      this.configService.get<string>('ELASTIC_SEARCH_OLLAMA_URL') ||
      this.configService.get<string>('OLLAMA_HOST') ||
      'http://localhost:11434';
    const model =
      this.configService.get<string>('ELASTIC_SEARCH_OLLAMA_MODEL') ||
      this.configService.get<string>('OLLAMA_MODEL') ||
      'llama3.1';

    const response = await axios.post(
      `${baseUrl.replace(/\/$/, '')}/api/generate`,
      {
        model,
        prompt: this.buildAiPrompt(query),
        stream: false,
      },
      { timeout: 10000 },
    );

    return this.extractAiText(response.data) || query;
  }

  private async enhanceWithGemini(query: string): Promise<string> {
    const apiKey =
      this.configService.get<string>('ELASTIC_SEARCH_GEMINI_API_KEY') ||
      this.configService.get<string>('GEMINI_API_KEY') ||
      this.configService.get<string>('GOOGLE_GEMINI_API_KEY') ||
      '';
    const model =
      this.configService.get<string>('ELASTIC_SEARCH_GEMINI_MODEL') ||
      this.configService.get<string>('GEMINI_MODEL') ||
      'gemini-1.5-flash';

    if (!apiKey) {
      return query;
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: this.buildAiPrompt(query) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 128,
        },
      },
      { timeout: 10000 },
    );

    return this.extractAiText(response.data) || query;
  }

  private buildAiPrompt(query: string): string {
    return [
      'Rewrite the shopping query into a concise product search phrase.',
      'Keep brand, category, size, color, material, and purchase intent.',
      'Return plain text only.',
      `Query: ${query}`,
    ].join('\n');
  }

  private extractAiText(payload: any): string {
    return (
      payload?.response ||
      payload?.candidates?.[0]?.content?.parts?.[0]?.text ||
      payload?.message?.content ||
      ''
    )
      .toString()
      .trim();
  }

  private getDisplayStock(p: any, isPublic: boolean = false) {
    let baseStock = 0;
    if (Array.isArray(p?.variants) && p.variants.length > 0) {
      baseStock = p.variants
        .filter((variant: any) => variant?.isActive !== false)
        .reduce((sum: number, variant: any) => sum + (variant?.stock || 0), 0);
    } else {
      baseStock = p?.stock ?? 0;
    }

    const warehouseStockQty = p?.warehouseStocks?.quantity ?? baseStock;

    if (!isPublic) {
      return warehouseStockQty;
    }

    let franchiseStockQty = 0;
    if (Array.isArray(p?.franchiseStocks)) {
      franchiseStockQty = p.franchiseStocks.reduce(
        (sum: number, fs: any) => sum + (fs?.quantity ?? 0),
        0,
      );
    }

    return warehouseStockQty + franchiseStockQty;
  }

  private buildVariantTitle(variant: any) {
    const titles = Array.isArray(variant?.attributes)
      ? variant.attributes
          .map((attr: any) => attr?.attributeValue?.title?.trim())
          .filter((title: string | undefined): title is string =>
            Boolean(title),
          )
      : [];

    if (titles.length > 0) {
      return titles.join(' / ').toUpperCase();
    }

    if (
      typeof variant?.attributeSummary === 'string' &&
      variant.attributeSummary
    ) {
      return variant.attributeSummary.toUpperCase();
    }

    return null;
  }

  private mapProduct(product: any, user?: JwtUser) {
    const hasAllowedRole =
      user &&
      (user.role === 'FRANCHISE_OWNER' ||
        user.role === 'FRANCHISE_STAFF' ||
        user.role === 'SUPERADMIN' ||
        user.role === 'ADMIN_STAFF');

    const baseResponse = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price != null ? String(product.price) : product.price,
      mrpPrice:
        product.mrpPrice != null ? String(product.mrpPrice) : product.mrpPrice,
      viewCount: product.viewCount,
      reviewCount: product.reviewCount,
      ratingAvg:
        product.ratingAvg != null
          ? String(product.ratingAvg)
          : product.ratingAvg,
      imageUrl: product.imageUrl,
      imageUrls: product.imageUrls,
      category: product.category,
      brandRef: product.brandRef,
      variants: product.variants, // Keep it original
      seo: product.seo,
      stock: this.getDisplayStock(product, true),
      createdAt: product.createdAt,
    };

    if (hasAllowedRole) {
      return {
        ...baseResponse,
        features: product.features ?? [],
        basePrice: product.basePrice != null ? String(product.basePrice) : '0',
        wholesalePrice:
          product.wholesalePrice != null ? String(product.wholesalePrice) : '0',
        gstTax: product.gstTax ?? 18,
        status: product.status ?? 'ACTIVE',
        visibility: product.visibility ?? true,
        stock: this.getDisplayStock(product),
        fastDelivery: product.fastDelivery ?? false,
        isFeatured: product.isFeatured ?? false,
        brand: product.brandRef
          ? {
              id: product.brandRef.id,
              name: product.brandRef.name,
              description: product.brandRef.description || null,
            }
          : null,
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
              slug: product.category.slug,
            }
          : null,
        variants: Array.isArray(product.variants)
          ? product.variants.map((v: any) => ({
              id: v.id,
              productId: v.productId,
              isActive: v.isActive ?? true,
              sku: v.sku,
              basePrice:
                v.basePrice != null ? String(v.basePrice) : v.basePrice,
              wholesalePrice:
                v.wholesalePrice != null
                  ? String(v.wholesalePrice)
                  : v.wholesalePrice,
              price: v.price != null ? String(v.price) : v.price,
              mrpPrice: v.mrpPrice != null ? String(v.mrpPrice) : v.mrpPrice,
              stock: v.stock ?? 0,
              gstTax: v.gstTax ?? 18,
              imageUrl: v.imageUrl || null,
              imageUrls: v.imageUrls ?? [],
              attributeSummary: v.attributeSummary,
              searchText: v.searchText,
              createdAt: v.createdAt,
              updatedAt: v.updatedAt,
              attributes: v.attributes ?? [],
              title: this.buildVariantTitle(v),
            }))
          : product.variants,
        franchiseStocks: product.franchiseStocks ?? [],
        hubInventories: product.hubInventories ?? [],
        replenPolicies: product.replenPolicies ?? [],
        warehouseStocks: product.warehouseStocks ?? null,
      };
    }

    return baseResponse;
  }

  async autoCompleteSuggestions(query: any): Promise<any> {
    const startTime = Date.now();
    const rawQuery = query.autoComplete ?? '';

    if (!rawQuery.trim()) {
      return {
        data: [],
        meta: {
          page: query.page ? Number(query.page) : 1,
          limit: query.limit ? Number(query.limit) : 20,
          totalPages: 0,
          total_results: 0,
          usedAI: true,
          hasNext: false,
          query: rawQuery,
          execution_time_ms: 0,
          source: 'suggestions',
          suggestions: [],
        },
        source: 'db',
      };
    }

    // 1. Detect language & translate to English if needed
    const detectedLang = this.translateService.detectLanguage(rawQuery);
    let englishQuery = rawQuery;
    if (detectedLang !== 'en') {
      englishQuery = await this.translateService.callGoogleTranslateAPI(
        rawQuery,
        detectedLang,
        'en',
      );
    }

    // 2. Normalize and correct typos using utils
    const { correctTypos, FuzzyMatcher, calculateSimilarityScore, isTypoMatch } =
      await import('../utils/fuzzy-matcher');
    const { normalizeText } = await import('../utils/query-normalizer');

    let processedQuery = correctTypos(englishQuery);
    processedQuery = normalizeText(processedQuery);

    if (!processedQuery) {
      const endTime = Date.now();
      return {
        data: [],
        meta: {
          page: query.page ? Number(query.page) : 1,
          limit: query.limit ? Number(query.limit) : 20,
          totalPages: 0,
          total_results: 0,
          usedAI: true,
          hasNext: false,
          query: rawQuery,
          execution_time_ms: Math.round(endTime - startTime),
          source: 'suggestions',
          suggestions: [],
        },
        source: 'db',
      };
    }

    // 3. Database Search: fetch matching products, categories, brands
    const prismaFilter = buildPrismaProductTextSearchFilter(processedQuery);

    const [products, brands, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          AND: [
            { status: ProductStatus.ACTIVE, visibility: true },
            prismaFilter,
          ] as Prisma.ProductWhereInput[],
        },
        include: {
          brandRef: true,
          category: true,
          seo: true,
        },
        take: 50,
      }),
      this.prisma.brand.findMany({
        where: {
          name: { contains: processedQuery, mode: 'insensitive' },
        },
        take: 10,
      }),
      this.prisma.category.findMany({
        where: {
          name: { contains: processedQuery, mode: 'insensitive' },
        },
        take: 10,
      }),
    ]);

    // 4. Extract candidate suggestions matching the query
    const queryLower = processedQuery.toLowerCase();
    const candidates = new Map<
      string,
      { type: string; text: string; priority: number }
    >();

    const isMultiWordMatch = (queryTerms: string[], targetWords: string[]): boolean => {
      return queryTerms.every((qTerm) => {
        return targetWords.some((tWord) => {
          if (tWord.startsWith(qTerm)) {
            return true;
          }
          if (qTerm.length >= 3 && isTypoMatch(qTerm, tWord, 0.6)) {
            return true;
          }
          return false;
        });
      });
    };

    const addCandidate = (text: string, type: string, priority = 1) => {
      if (!text) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const lower = trimmed.toLowerCase();

      const updateCandidate = () => {
        if (!candidates.has(lower)) {
          candidates.set(lower, { type, text: trimmed, priority });
        } else {
          const existing = candidates.get(lower)!;
          if (priority > (existing.priority ?? 0)) {
            candidates.set(lower, { type, text: trimmed, priority });
          }
        }
      };

      // A. Direct substring match
      if (lower.includes(queryLower)) {
        updateCandidate();
        return;
      }

      // B. Fuzzy match on the full text
      if (isTypoMatch(queryLower, lower, 0.6)) {
        updateCandidate();
        return;
      }

      // C. Word-by-word fuzzy match (for multi-word product names)
      const words = lower.split(/[\s,.\-\/]+/);
      for (const word of words) {
        if (word.length >= 3) {
          if (isTypoMatch(queryLower, word, 0.6)) {
            updateCandidate();
            break;
          }
        }
      }

      // D. Multi-word match
      const queryTerms = queryLower.split(/\s+/).filter(Boolean);
      if (queryTerms.length > 1) {
        const targetWords = lower.split(/[\s,.\-\/]+/);
        if (isMultiWordMatch(queryTerms, targetWords)) {
          updateCandidate();
          return;
        }
      }
    };

    // Helper to extract phrases from description
    const extractDescriptionPhrases = (description: string, priority = 1) => {
      if (!description) return;
      const cleanDesc = description.replace(/<[^>]*>/g, ' '); // Strip HTML

      // Find which word in the description has high similarity to processedQuery
      const wordsInDesc = cleanDesc.split(/[\s,.\-\/]+/);
      const matchedWord = wordsInDesc.find((w) => {
        const cleanW = w.replace(/[^\w\u0900-\u097F]/g, '').toLowerCase();
        return (
          cleanW.length >= 3 &&
          isTypoMatch(queryLower, cleanW, 0.6)
        );
      });

      const searchWord = matchedWord ? matchedWord : processedQuery;

      const regex = new RegExp(
        `([^.\\n\\r]*?${searchWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.\\n\\r]*)`,
        'gi',
      );
      const matches = cleanDesc.match(regex);
      if (matches) {
        matches.forEach((m) => {
          const words = m.trim().split(/\s+/);
          if (words.length > 0 && words.length <= 6) {
            addCandidate(m.trim(), 'keyword', priority);
          } else if (words.length > 6) {
            const queryIdx = words.findIndex((w) =>
              w.toLowerCase().includes(searchWord.toLowerCase()),
            );
            if (queryIdx !== -1) {
              const start = Math.max(0, queryIdx - 2);
              const end = Math.min(words.length, queryIdx + 3);
              addCandidate(
                words.slice(start, end).join(' '),
                'keyword',
                priority,
              );
            }
          }
        });
      }
    };

    // Helper to extract words/phrases starting with query
    const extractQueryPhrases = (text: string) => {
      if (!text) return;
      const cleanText = text
        .replace(/<[^>]*>/g, ' ') // Strip HTML
        .replace(/[^\w\s\u0900-\u097F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const words = cleanText.split(/\s+/);
      const queryTerms = queryLower.split(/\s+/).filter(Boolean);

      if (queryTerms.length === 1) {
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const wordLower = word.toLowerCase();
          if (wordLower.startsWith(queryLower) || isTypoMatch(queryLower, wordLower, 0.6)) {
            // 1-word suggestion (e.g. "Laptop")
            addCandidate(word, 'keyword', 2);

            // 2-word suggestion if there's a next word (e.g. "Laptop Bag")
            if (i + 1 < words.length) {
              const nextWord = words[i + 1];
              addCandidate(`${word} ${nextWord}`, 'keyword', 2);
            }
          }
        }
      } else {
        // Multi-word extraction: try to find contiguous matching words in order
        for (let i = 0; i <= words.length - queryTerms.length; i++) {
          let matchesAll = true;
          const extracted: string[] = [];
          for (let j = 0; j < queryTerms.length; j++) {
            const word = words[i + j];
            const wordLower = word.toLowerCase();
            const term = queryTerms[j];
            const isMatch = wordLower.startsWith(term) || (term.length >= 3 && isTypoMatch(term, wordLower, 0.6));
            if (!isMatch) {
              matchesAll = false;
              break;
            }
            extracted.push(word);
          }
          if (matchesAll) {
            addCandidate(extracted.join(' '), 'keyword', 2);
          }
        }
      }
    };

    // If initial strict search has no product results, run FuzzyMatcher fallback on all products
    if (products.length === 0) {
      const allActiveProducts = await this.prisma.product.findMany({
        where: {
          status: ProductStatus.ACTIVE,
          visibility: true,
        },
        include: {
          brandRef: true,
          category: true,
          seo: true,
        },
        take: 200,
      });

      const fieldsToMatch = [
        'name',
        'description',
        'brandRef.name',
        'category.name',
        'seo.title',
        'seo.keywords',
        'seo.tags',
      ];
      const matcher = new FuzzyMatcher(allActiveProducts, fieldsToMatch, 0.6);
      const matches = matcher.search(processedQuery, fieldsToMatch);

      matches.forEach((m) => {
        const p = m.item;
        const field = m.matchedField;
        if (field === 'name') {
          addCandidate(p.name, 'keyword', 3);
          extractQueryPhrases(p.name);
        } else if (field === 'brandRef.name' && p.brandRef?.name) {
          addCandidate(p.brandRef.name, 'keyword', 1);
          extractQueryPhrases(p.brandRef.name);
        } else if (field === 'category.name' && p.category?.name) {
          addCandidate(p.category.name, 'keyword', 1);
          extractQueryPhrases(p.category.name);
        } else if (field === 'seo.title' && p.seo?.title) {
          addCandidate(p.seo.title, 'keyword', 2);
          extractQueryPhrases(p.seo.title);
        } else if (
          field.startsWith('seo.keywords') ||
          field.startsWith('seo.tags')
        ) {
          if (p.seo?.keywords) {
            p.seo.keywords.forEach((kw: any) => {
              addCandidate(kw, 'keyword', 2);
              extractQueryPhrases(kw);
            });
          }
          if (p.seo?.tags) {
            p.seo.tags.forEach((t: any) => {
              addCandidate(t, 'keyword', 2);
              extractQueryPhrases(t);
            });
          }
        } else if (field === 'description' && p.description) {
          extractDescriptionPhrases(p.description, 1);
          extractQueryPhrases(p.description);
        } else {
          addCandidate(p.name, 'keyword', 3);
          extractQueryPhrases(p.name);
        }
      });
    } else {
      products.forEach((p) => {
        addCandidate(p.name, 'keyword', 3);
        extractQueryPhrases(p.name);
        if (p.brandRef?.name) {
          addCandidate(p.brandRef.name, 'keyword', 1);
          extractQueryPhrases(p.brandRef.name);
        }
        if (p.category?.name) {
          addCandidate(p.category.name, 'keyword', 1);
          extractQueryPhrases(p.category.name);
        }
        if (p.seo?.title) {
          addCandidate(p.seo.title, 'keyword', 2);
          extractQueryPhrases(p.seo.title);
        }
        if (p.seo?.keywords) {
          p.seo.keywords.forEach((kw: any) => {
            addCandidate(kw, 'keyword', 2);
            extractQueryPhrases(kw);
          });
        }
        if (p.seo?.tags) {
          p.seo.tags.forEach((t: any) => {
            addCandidate(t, 'keyword', 2);
            extractQueryPhrases(t);
          });
        }
        if (p.description) {
          extractDescriptionPhrases(p.description, 1);
          extractQueryPhrases(p.description);
        }
      });
    }

    // Fuzzy matcher fallback for brands if empty
    if (brands.length === 0) {
      const allBrands = await this.prisma.brand.findMany({ take: 100 });
      const brandMatcher = new FuzzyMatcher(allBrands, ['name'], 0.6);
      const brandMatches = brandMatcher.search(processedQuery, ['name']);
      brandMatches.forEach((bm) => {
        addCandidate(bm.item.name, 'keyword', 1);
        extractQueryPhrases(bm.item.name);
      });
    } else {
      brands.forEach((b) => {
        addCandidate(b.name, 'keyword', 1);
        extractQueryPhrases(b.name);
      });
    }

    // Fuzzy matcher fallback for categories if empty
    if (categories.length === 0) {
      const allCategories = await this.prisma.category.findMany({ take: 100 });
      const catMatcher = new FuzzyMatcher(allCategories, ['name'], 0.6);
      const catMatches = catMatcher.search(processedQuery, ['name']);
      catMatches.forEach((cm) => {
        addCandidate(cm.item.name, 'keyword', 1);
        extractQueryPhrases(cm.item.name);
      });
    } else {
      categories.forEach((c) => {
        addCandidate(c.name, 'keyword', 1);
        extractQueryPhrases(c.name);
      });
    }

    // 5. Calculate confidence scores
    const getConfidence = (text: string, query: string): number => {
      const textLower = text.toLowerCase();
      const queryLower = query.toLowerCase();

      if (textLower === queryLower) {
        return 95;
      }

      if (textLower.startsWith(queryLower)) {
        if (text.length < 15) {
          return 92;
        }
        if (text.length < 35) {
          return 88;
        }
        return 85;
      }

      // Check if the suggestion is a close typo match to the query
      if (isTypoMatch(queryLower, textLower, 0.6)) {
        if (text.length < 15) {
          return 90;
        }
        if (text.length < 35) {
          return 86;
        }
        return 83;
      }

      // Check if it is a multi-word match
      const queryTerms = queryLower.split(/\s+/).filter(Boolean);
      if (queryTerms.length > 1) {
        const targetWords = textLower.split(/[\s,.\-\/]+/);
        if (isMultiWordMatch(queryTerms, targetWords)) {
          if (
            targetWords[0].startsWith(queryTerms[0]) ||
            isTypoMatch(queryTerms[0], targetWords[0], 0.6)
          ) {
            return 85;
          }
          return 80;
        }
      }

      // Check if any word in the text starts with the query
      const words = textLower.split(/[\s,.\-\/]+/);
      if (words.some((w) => w.startsWith(queryLower))) {
        return 85;
      }

      // Check if the text contains the query as a substring
      if (textLower.includes(queryLower)) {
        return 80;
      }

      const similarity = calculateSimilarityScore(text, query);
      return 50 + Math.round(similarity * 15);
    };

    // Sort and limit candidates
    const rawSuggestions = Array.from(candidates.values()).map((c: any) => {
      const confidence = getConfidence(c.text, processedQuery);
      return {
        text: c.text,
        type: 'keyword',
        confidence,
        priority: c.priority ?? 1,
      };
    });

    // 6. Translate suggestions back to detected input language if necessary
    let finalSuggestions = rawSuggestions;
    if (detectedLang !== 'en') {
      finalSuggestions = await Promise.all(
        rawSuggestions.map(async (s) => {
          const translatedText =
            await this.translateService.callGoogleTranslateAPI(
              s.text,
              'en',
              detectedLang,
            );
          return {
            ...s,
            text: translatedText,
          };
        }),
      );

      // De-duplicate in case translations mapped to the same text
      const seen = new Set<string>();
      finalSuggestions = finalSuggestions.filter((s) => {
        const key = s.text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Sort suggestions by confidence (descending), priority (descending) and text length (ascending)
    finalSuggestions.sort((a: any, b: any) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.text.length - b.text.length;
    });

    const limit = query.limit ? Number(query.limit) : 20;

    // Fallback: If no suggestions matched, return active products name and keywords
    if (finalSuggestions.length === 0) {
      const fallbackProducts = await this.prisma.product.findMany({
        where: {
          status: ProductStatus.ACTIVE,
          visibility: true,
        },
        include: {
          seo: true,
          brandRef: true,
          category: true,
        },
        take: 20,
      });

      const fallbackCandidates = new Map<
        string,
        { type: string; text: string; priority: number }
      >();

      const addFallback = (text: string, priority: number) => {
        if (!text) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        const lower = trimmed.toLowerCase();
        if (!fallbackCandidates.has(lower)) {
          fallbackCandidates.set(lower, {
            type: 'keyword',
            text: trimmed,
            priority,
          });
        } else {
          const existing = fallbackCandidates.get(lower)!;
          if (priority > existing.priority) {
            fallbackCandidates.set(lower, {
              type: 'keyword',
              text: trimmed,
              priority,
            });
          }
        }
      };

      fallbackProducts.forEach((p) => {
        if (p.name) addFallback(p.name, 3);
        if (p.seo?.keywords) {
          p.seo.keywords.forEach((kw: any) => addFallback(kw, 2));
        }
        if (p.seo?.tags) {
          p.seo.tags.forEach((t: any) => addFallback(t, 2));
        }
        if (p.brandRef?.name) addFallback(p.brandRef.name, 1);
        if (p.category?.name) addFallback(p.category.name, 1);
      });

      const rawFallback = Array.from(fallbackCandidates.values()).map((c) => ({
        text: c.text,
        type: c.type,
        confidence: 85,
        priority: c.priority,
      }));

      const getPrefixMatchInfo = (text: string, query: string) => {
        const textLower = text.toLowerCase();
        const queryLower = query.toLowerCase();
        const words = textLower.split(/[\s,.\-\/]+/);

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          let matchLen = 0;
          const minLen = Math.min(word.length, queryLower.length);
          for (let j = 0; j < minLen; j++) {
            if (word[j] === queryLower[j]) {
              matchLen++;
            } else {
              break;
            }
          }
          if (matchLen > 0) {
            return { wordIndex: i, matchLen };
          }
        }

        return { wordIndex: 99, matchLen: 0 };
      };

      rawFallback.sort((a, b) => {
        const aInfo = getPrefixMatchInfo(a.text, processedQuery);
        const bInfo = getPrefixMatchInfo(b.text, processedQuery);

        if (aInfo.wordIndex !== bInfo.wordIndex) {
          return aInfo.wordIndex - bInfo.wordIndex;
        }
        if (bInfo.matchLen !== aInfo.matchLen) {
          return bInfo.matchLen - aInfo.matchLen;
        }
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.text.length - b.text.length;
      });

      finalSuggestions = rawFallback;
    }

    // Limit suggestions to pagination limit (or default 20)
    const page = query.page ? Number(query.page) : 1;
    const paginatedSuggestions = finalSuggestions
      .slice((page - 1) * limit, page * limit)
      .map((s: any) => ({
        text: s.text,
        type: s.type,
        confidence: s.confidence,
      }));

    const endTime = Date.now();

    return {
      data: [],
      meta: {
        page,
        limit,
        totalPages: Math.ceil(finalSuggestions.length / limit),
        total_results: finalSuggestions.length,
        usedAI: true,
        hasNext: page * limit < finalSuggestions.length,
        query: rawQuery,
        execution_time_ms: Math.round(endTime - startTime),
        source: 'suggestions',
        suggestions: paginatedSuggestions,
      },
      source: 'db',
    };
  }
}
