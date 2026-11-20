import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  ISearchProvider,
  NormalizedImageResult,
  NormalizedOrganicResult,
  NormalizedNewsResult,
  NormalizedVideoResult,
  NormalizedShoppingResult,
} from '../search-provider.interface';

@Injectable()
export class SerpSearchApiProvider implements ISearchProvider {
  private readonly axiosInstance: AxiosInstance;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SERP_SEARCHAPI_API_KEY', 'key');

    this.axiosInstance = axios.create({
      baseURL: this.config.get<string>(
        'SERP_SEARCHAPI_BASE_URL',
        'https://api.serpsearch.com/api/v1',
      ),
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  private handleError(error: any): never {
    if (error.response?.data?.error) {
      const err = error.response.data.error;
      const customError: any = new Error(`${err.code}: ${err.message}`);
      customError.status = error.response.status;
      throw customError;
    }
    throw error;
  }

  async fetchSuggestions(keyword: string): Promise<string[]> {
    try {
      const { data } = await this.axiosInstance.get('/autocomplete', {
        params: {
          query: keyword,
        },
      });
      return data?.map((item: any) => item.title) ?? [];
    } catch (error: any) {
      this.handleError(error);
    }
  }

  async searchImages(
    keyword: string,
    num?: number,
    safe?: string,
  ): Promise<NormalizedImageResult[]> {
    try {
      const { data } = await this.axiosInstance.get('/images', {
        params: {
          query: keyword,
          page: num,
          safe,
        },
      });
      return (
        data?.map((item: any) => ({
          title: item.title,
          link: item.url,
          thumbnail: item.preview?.url,
        })) ?? []
      );
    } catch (error: any) {
      this.handleError(error);
    }
  }

  async searchOrganic(
    keyword: string,
    num?: number,
  ): Promise<NormalizedOrganicResult[]> {
    try {
      const { data } = await this.axiosInstance.get('/search', {
        params: {
          query: keyword,
          page: num,
        },
      });
      return (
        data?.organic_results?.map((item: any) => ({
          title: item.title,
          link: item.url,
          snippet: item.description,
        })) ?? []
      );
    } catch (error: any) {
      this.handleError(error);
    }
  }

  async searchNews(
    keyword: string,
    num?: number,
  ): Promise<NormalizedNewsResult[]> {
    try {
      const { data } = await this.axiosInstance.get('/news', {
        params: { query: keyword, page: num },
      });
      const articles: NormalizedNewsResult[] = [];
      if (Array.isArray(data)) {
        for (const group of data) {
          if (group.articles) {
            for (const article of group.articles) {
              articles.push({
                title: article.title,
                link: article.url,
                date: article.created_at,
              });
            }
          }
        }
      }
      return articles;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  async searchVideos(
    keyword: string,
    num?: number,
  ): Promise<NormalizedVideoResult[]> {
    try {
      const { data } = await this.axiosInstance.get('/videos', {
        params: { query: keyword, page: num },
      });
      return (
        data?.map((item: any) => ({
          title: item.title,
          link: item.url,
          thumbnail: item.thumbnail,
          duration: item.duration,
        })) ?? []
      );
    } catch (error: any) {
      this.handleError(error);
    }
  }

  async searchShopping(
    keyword: string,
    num?: number,
  ): Promise<NormalizedShoppingResult[]> {
    // SerpSearch does not natively support a shopping endpoint. Cover with empty result.
    return [];
  }
}
