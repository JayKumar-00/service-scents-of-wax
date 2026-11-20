export enum SearchProviderType {
  SEARCHAPI = 'searchapi',
  SERPSEARCH = 'serpsearch',
}

export interface NormalizedImageResult {
  title: string;
  link: string;
  thumbnail: string;
}

export interface NormalizedOrganicResult {
  title: string;
  link: string;
  snippet: string;
}

export interface NormalizedNewsResult {
  title: string;
  link: string;
  source?: string;
  date?: string | number;
}

export interface NormalizedVideoResult {
  title: string;
  link: string;
  thumbnail?: string;
  duration?: string;
}

export interface NormalizedShoppingResult {
  title: string;
  link: string;
  price?: string;
  thumbnail?: string;
}

export interface ISearchProvider {
  fetchSuggestions(keyword: string): Promise<string[]>;
  searchImages(
    keyword: string,
    num?: number,
    safe?: string,
  ): Promise<NormalizedImageResult[]>;
  searchOrganic(
    keyword: string,
    num?: number,
  ): Promise<NormalizedOrganicResult[]>;
  searchNews(keyword: string, num?: number): Promise<NormalizedNewsResult[]>;
  searchVideos(keyword: string, num?: number): Promise<NormalizedVideoResult[]>;
  searchShopping(
    keyword: string,
    num?: number,
  ): Promise<NormalizedShoppingResult[]>;
}
