import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { GeoProvider, GeoResult } from './types';

export class OSMProvider implements GeoProvider {
  private osmApi: AxiosInstance;
  private readonly logger = new Logger(OSMProvider.name);

  constructor(private readonly config: ConfigService) {
    this.osmApi = axios.create({
      baseURL:
        this.config.get<string>('OSM_API_URL') ??
        'https://nominatim.openstreetmap.org/search',
      headers: {
        'User-Agent':
          this.config.get<string>('OSM_USER_AGENT') ??
          'GiftFactory/1.0 (contact@giftfactory.com)',
      },
      timeout: 5000,
    });
  }

  async geocode(address: string): Promise<GeoResult | null> {
    try {
      const cleanedAddress = address.replace(/^business\s*park/i, '').trim();

      const response = await this.osmApi.get('', {
        params: {
          q: cleanedAddress,
          format: 'json',
          limit: 1,
          countrycodes: 'in',
        },
      });

      const result = response.data?.[0];

      if (!result) {
        this.logger.warn(`OSM: No result for ${address}`);
        return null;
      }

      const lat = Number(parseFloat(result.lat).toFixed(6));
      const lng = Number(parseFloat(result.lon).toFixed(6));

      if (isNaN(lat) || isNaN(lng)) {
        this.logger.warn(`OSM: Invalid coordinates for ${address}`);
        return null;
      }

      return {
        lat,
        lng,
        source: 'osm',
        address: result.display_name,
      };
    } catch (error: any) {
      this.logger.error(
        `OSM failed for ${address}: ${error?.response?.data || error.message}`,
      );
      return null;
    }
  }
}
