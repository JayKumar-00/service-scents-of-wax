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
export class SearchApiProvider implements ISearchProvider {
  private readonly axiosInstance: AxiosInstance;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SEARCHAPI_API_KEY', 'key');

    this.axiosInstance = axios.create({
      baseURL: this.config.get<string>(
        'SEARCHAPI_BASE_URL',
        'https://www.searchapi.io/api/v1',
      ),
      timeout: 10000,
    });
  }

  async fetchSuggestions(keyword: string): Promise<string[]> {
    try {
      const { data } = await this.axiosInstance.get('/search', {
        params: {
          q: keyword,
          engine: 'google_autocomplete',
          gl: 'in',
          hl: 'en',
          api_key: this.apiKey,
        },
      });
      return (
        data?.suggestions?.map((item: any) => item.value ?? item.suggestion) ??
        []
      );
    } catch {
      return [];
    }
  }

  async searchImages(
    keyword: string,
    num?: number,
    safe?: string,
  ): Promise<NormalizedImageResult[]> {
    try {
      const { data } = await this.axiosInstance.get('/search', {
        params: {
          q: keyword,
          engine: 'google',
          tbm: 'isch',
          num,
          api_key: this.apiKey,
        },
      });
      return (
        data?.images_results?.map((item: any) => ({
          title: item.title,
          link: item.original,
          thumbnail: item.thumbnail,
        })) ?? []
      );
    } catch {
      return [];
    }
  }

  async searchOrganic(
    keyword: string,
    num?: number,
  ): Promise<NormalizedOrganicResult[]> {
    try {
      const { data } = await this.axiosInstance.get('/search', {
        params: {
          q: keyword,
          engine: 'google',
          num,
          api_key: this.apiKey,
        },
      });
      return (
        data?.organic_results?.map((item: any) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
        })) ?? []
      );
    } catch {
      return [];
    }
  }

  async searchNews(
    keyword: string,
    num?: number,
  ): Promise<NormalizedNewsResult[]> {
    try {
      const { data } = await this.axiosInstance.get('/search', {
        params: {
          q: keyword,
          engine: 'google',
          tbm: 'nws',
          num,
          api_key: this.apiKey,
        },
      });
      return (
        data?.news_results?.map((item: any) => ({
          title: item.title,
          link: item.link,
          source: item.source,
          date: item.date,
        })) ?? []
      );
    } catch {
      return [];
    }
  }

  async searchVideos(
    keyword: string,
    num?: number,
  ): Promise<NormalizedVideoResult[]> {
    try {
      const { data } = await this.axiosInstance.get('/search', {
        params: {
          q: keyword,
          engine: 'google',
          tbm: 'vid',
          num,
          api_key: this.apiKey,
        },
      });
      return (
        data?.video_results?.map((item: any) => ({
          title: item.title,
          link: item.link,
          thumbnail: item.thumbnail,
          duration: item.duration,
        })) ?? []
      );
    } catch {
      return [];
    }
  }

  async searchShopping(
    keyword: string,
    num?: number,
  ): Promise<NormalizedShoppingResult[]> {
    try {
      const { data } = await this.axiosInstance.get('/search', {
        params: {
          q: keyword,
          engine: 'google',
          tbm: 'shop',
          num,
          api_key: this.apiKey,
        },
      });
      return (
        data?.shopping_results?.map((item: any) => ({
          title: item.title,
          link: item.link,
          price: item.price,
          thumbnail: item.thumbnail,
        })) ?? []
      );
    } catch {
      return [];
    }
  }
}
