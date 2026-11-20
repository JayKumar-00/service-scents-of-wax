import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  ISearchProvider,
  SearchProviderType,
} from './search-provider.interface';
import { SearchApiProvider } from './providers/searchapi.provider';
import { SerpSearchApiProvider } from './providers/serpsearch.provider';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if necessary

@Injectable()
export class SuggestionService {
  constructor(
    private readonly searchApiProvider: SearchApiProvider,
    private readonly serpSearchProvider: SerpSearchApiProvider,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getProvider(provider?: SearchProviderType): {
    instance: ISearchProvider;
    name: string;
  } {
    if (provider === SearchProviderType.SEARCHAPI)
      return {
        instance: this.searchApiProvider,
        name: SearchProviderType.SEARCHAPI,
      };
    if (provider === SearchProviderType.SERPSEARCH)
      return {
        instance: this.serpSearchProvider,
        name: SearchProviderType.SERPSEARCH,
      };

    const defaultProvider = this.config.get<string>(
      'SEARCH_PROVIDER',
      SearchProviderType.SEARCHAPI,
    );
    return defaultProvider === SearchProviderType.SERPSEARCH
      ? {
          instance: this.serpSearchProvider,
          name: SearchProviderType.SERPSEARCH,
        }
      : {
          instance: this.searchApiProvider,
          name: SearchProviderType.SEARCHAPI,
        };
  }

  private async executeWithFallback<T>(
    providerType: SearchProviderType | undefined,
    action: (provider: ISearchProvider) => Promise<T[]>,
    errorMessage: string,
  ): Promise<{ results: T[]; source: string }> {
    const primary = this.getProvider(providerType);
    try {
      const results = await action(primary.instance);
      // Return results if they are non-empty or if a specific provider was explicitly requested.
      if ((results && results.length > 0) || providerType) {
        return { results: results ?? [], source: primary.name };
      }
      // If empty and using default fallback behavior, throw to trigger fallback logic
      throw new Error('Empty results, attempting fallback');
    } catch (error: any) {
      if (providerType) {
        // User explicitly wanted this provider, do not fallback
        throw new HttpException(
          error.message || errorMessage,
          error.status || error.response?.status || 500,
        );
      }

      // Execute automatic fallback to the alternative provider
      const fallbackName =
        primary.name === SearchProviderType.SERPSEARCH
          ? SearchProviderType.SEARCHAPI
          : SearchProviderType.SERPSEARCH;
      const fallbackInstance =
        fallbackName === SearchProviderType.SERPSEARCH
          ? this.serpSearchProvider
          : this.searchApiProvider;

      try {
        const fallbackResults = await action(fallbackInstance);
        return { results: fallbackResults ?? [], source: fallbackName };
      } catch (fallbackError: any) {
        // Final absolute fallback: return empty to "cover if not able" without crashing app
        return { results: [], source: 'none' };
      }
    }
  }

  async getKeywords(
    keyword: string,
    provider?: SearchProviderType,
  ): Promise<{ results: string[]; source: string }> {
    const normalizedQuery = keyword.toLowerCase().trim();

    if (!normalizedQuery) {
      return { results: [], source: 'none' };
    }

    // 1. Check local database cache first
    const cachedRecord = await this.prisma.keywordSearchSuggestion.findUnique({
      where: { query: normalizedQuery },
    });

    if (cachedRecord) {
      return {
        results: cachedRecord.suggestions,
        source: cachedRecord.provider || 'DB_CACHE',
      };
    }

    // 2. Fetch from providers using the existing fallback mechanism
    const response = await this.executeWithFallback(
      provider,
      (p) => p.fetchSuggestions(normalizedQuery),
      'Failed to fetch keyword suggestions',
    );

    // 3. Save to DB if we got a valid response so next time it's served locally
    if (response.results && response.results.length > 0) {
      await this.prisma.keywordSearchSuggestion.upsert({
        where: { query: normalizedQuery },
        update: { suggestions: response.results, provider: response.source },
        create: {
          query: normalizedQuery,
          suggestions: response.results,
          provider: response.source,
        },
      });
    }

    return response;
  }

  async deleteKeyword(query: string) {
    const normalizedQuery = query.toLowerCase().trim();
    try {
      await this.prisma.keywordSearchSuggestion.delete({
        where: { query: normalizedQuery },
      });
      return {
        success: true,
        message: `Deleted cached keywords for query: ${normalizedQuery}`,
      };
    } catch (error) {
      // Prisma throws an error if the record to delete doesn't exist
      return {
        success: false,
        message: `No cached keywords found for query: ${normalizedQuery}`,
      };
    }
  }

  async clearAllKeywords() {
    try {
      const result = await this.prisma.keywordSearchSuggestion.deleteMany();
      return {
        success: true,
        message: `Cleared all cached keywords`,
        count: result.count,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to clear cached keywords',
        count: 0,
      };
    }
  }

  async upsertKeyword(query: string, suggestions: string[], provider?: string) {
    const normalizedQuery = query?.toLowerCase().trim();

    if (!normalizedQuery) {
      throw new HttpException('Query is required', 400);
    }

    const result = await this.prisma.keywordSearchSuggestion.upsert({
      where: { query: normalizedQuery },
      update: { suggestions, provider: provider || 'MANUAL_UPSERT' },
      create: {
        query: normalizedQuery,
        suggestions,
        provider: provider || 'MANUAL_UPSERT',
      },
    });

    return {
      success: true,
      message: `Successfully upserted keywords for query: ${normalizedQuery}`,
      data: result,
    };
  }

  async searchImages(
    keyword: string,
    num?: number,
    safe?: string,
    provider?: SearchProviderType,
  ) {
    return this.executeWithFallback(
      provider,
      (p) => p.searchImages(keyword, num, safe),
      'Failed to fetch images',
    );
  }

  async searchOrganic(
    keyword: string,
    num?: number,
    provider?: SearchProviderType,
  ) {
    return this.executeWithFallback(
      provider,
      (p) => p.searchOrganic(keyword, num),
      'Failed to fetch organic search results',
    );
  }

  async searchNews(
    keyword: string,
    num?: number,
    provider?: SearchProviderType,
  ) {
    return this.executeWithFallback(
      provider,
      (p) => p.searchNews(keyword, num),
      'Failed to fetch news results',
    );
  }

  async searchVideos(
    keyword: string,
    num?: number,
    provider?: SearchProviderType,
  ) {
    return this.executeWithFallback(
      provider,
      (p) => p.searchVideos(keyword, num),
      'Failed to fetch video results',
    );
  }

  async searchShopping(
    keyword: string,
    num?: number,
    provider?: SearchProviderType,
  ) {
    return this.executeWithFallback(
      provider,
      (p) => p.searchShopping(keyword, num),
      'Failed to fetch shopping results',
    );
  }

  async getGoogleSuggestions(
    keyword: string,
  ): Promise<{ results: string[]; source: string }> {
    try {
      const { data } = await axios.get(
        'https://suggestqueries.google.com/complete/search',
        { params: { client: 'chrome', q: keyword } },
      );
      // Google's chrome suggest API returns format: ["keyword", ["suggestion1", "suggestion2", ...]]
      return { results: data[1] || [], source: 'google-native' };
    } catch (error: any) {
      return { results: [], source: 'google-native' };
    }
  }
}
