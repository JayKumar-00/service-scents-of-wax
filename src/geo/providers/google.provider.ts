import axios, { AxiosInstance } from 'axios';
import { GeoProvider, GeoResult } from './types';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class GoogleProvider implements GeoProvider {
  private googleApi: AxiosInstance;
  private readonly apiKey: string;
  private readonly logger = new Logger(GoogleProvider.name);

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY') ?? '';

    this.googleApi = axios.create({
      baseURL:
        this.config.get<string>('GOOGLE_MAPS_API_URL') ??
        'https://maps.googleapis.com/maps/api/geocode/json',
      timeout: 3000,
    });
  }

  async geocode(address: string): Promise<GeoResult | null> {
    if (!this.apiKey) {
      this.logger.warn(`Skipping Google call (no API key) for: ${address}`);
      return null;
    }

    try {
      const response = await this.googleApi.get('', {
        params: {
          address,
          key: this.apiKey,
        },
      });

      const data = response?.data;

      if (!data || typeof data !== 'object') {
        this.logger.warn(`Invalid response from Google for: ${address}`);
        return null;
      }

      const { status, results } = data;

      if (status !== 'OK') {
        this.logger.warn(`Google status: ${status} for ${address}`);
        return null;
      }

      const result = results?.[0];
      const location = result?.geometry?.location;

      if (!location) {
        this.logger.warn(`Invalid geometry for: ${address}`);
        return null;
      }

      const lat = Number(parseFloat(location.lat).toFixed(6));
      const lng = Number(parseFloat(location.lng).toFixed(6));

      if (isNaN(lat) || isNaN(lng)) {
        this.logger.warn(`Invalid coordinates from Google for: ${address}`);
        return null;
      }

      return { lat, lng, source: 'google', address: result.formatted_address };
    } catch (error: any) {
      this.logger.error(
        `Google failed for ${address}: ${
          error?.response?.data?.error_message || error.message
        }`,
      );
      return null;
    }
  }
}
