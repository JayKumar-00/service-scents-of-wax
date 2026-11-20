import axios, { AxiosInstance, isAxiosError } from 'axios';

import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import { ShipmentStatus } from '@prisma/client';

@Injectable()
export class ShiprocketProvider {
  public axiosInstance: AxiosInstance;
  private static readonly CACHE_KEY_PREFIX = 'shiprocket:token';
  private static readonly TOKEN_CACHE_TTL_SECONDS = 4 * 24 * 60 * 60;

  constructor(
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.axiosInstance = axios.create({
      baseURL: this.resolveBaseUrl(),
      timeout: 10000,
    });
  }

  private resolveBaseUrl(): string {
    const baseUrl = (
      this.config.get<string>('SHIPROCKET_BASE_URL') ?? 'BASE_URL'
    ).replace(/\/+$/, '');

    if (baseUrl.endsWith('/v1/external')) {
      return baseUrl;
    }

    return `${baseUrl}/v1/external`;
  }

  public async requestWithAuthRetry<T>(
    fn: (headers: Record<string, string>) => Promise<T>,
  ): Promise<T> {
    let headers = await this.getHeaders();

    try {
      return await fn(headers);
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 401) {
        // force refresh token
        await this.redisService.del([this.getTokenCacheKey()]);

        headers = await this.getHeaders();

        return await fn(headers);
      }

      throw error;
    }
  }

  /** Map Shiprocket status to internal ShipmentStatus */
  public mapStatus(status: string): ShipmentStatus | undefined {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return ShipmentStatus.PENDING;

      case 'IN TRANSIT':
        return ShipmentStatus.IN_TRANSIT;

      case 'FAILED':
        return ShipmentStatus.FAILED;

      case 'DELIVERED':
        return ShipmentStatus.DELIVERED;

      case 'OUT FOR DELIVERY':
        return ShipmentStatus.OUT_FOR_DELIVERY;

      default:
        return undefined;
    }
  }

  /** Handle Shiprocket API errors */
  public handleShipRocketError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (isAxiosError(error)) {
      const networkCode = error.code;

      if (
        networkCode === 'EAI_AGAIN' ||
        networkCode === 'ENOTFOUND' ||
        networkCode === 'ECONNREFUSED' ||
        networkCode === 'ETIMEDOUT'
      ) {
        return new HttpException(
          'Shiprocket is temporarily unreachable. Check DNS/network access to apiv2.shiprocket.in and try again.',
          503,
        );
      }

      const status = error.response?.status || 500;
      const data = error.response?.data as any;

      const message =
        data?.message ||
        data?.response?.data?.awb_assign_error ||
        data?.errors?.[0] ||
        error.message ||
        'Unexpected error from Shiprocket';

      return new HttpException(message, status);
    }

    const err = error as any;

    const status =
      err?.response?.status || err?.status_code || err?.status || 500;

    const message =
      err?.message ||
      err?.response?.data?.message ||
      'Unexpected error from Shiprocket';

    return new HttpException(message, status);
  }

  /** Format tracking response */
  public formatTrackingResponse(data: any) {
    const track = data?.tracking_data?.shipment_track?.[0];

    const activities = data?.tracking_data?.shipment_track_activities ?? [];

    return {
      awb: track?.awb_code,
      courierName: track?.courier_name,
      currentStatus: track?.current_status,
      deliveredDate: track?.delivered_date,
      etd: data?.tracking_data?.etd,
      trackUrl: data?.tracking_data?.track_url,

      activities: activities.map((a: any) => ({
        date: a.date,
        status: a['sr-status-label'],
        activity: a.activity,
        location: a.location,
      })),
    };
  }

  async getToken(): Promise<string> {
    const cacheKey = this.getTokenCacheKey();
    const cache = await this.redisService.get<string>(cacheKey);

    if (cache) {
      // Normalize TTL for existing cached tokens to 4 days.
      await this.redisService.set(
        cacheKey,
        cache,
        ShiprocketProvider.TOKEN_CACHE_TTL_SECONDS,
      );
      return cache;
    }

    const result = await this.axiosInstance.post<{
      token: string;
    }>('/auth/login', {
      email: this.config.get<string>('SHIPROCKET_EMAIL') ?? 'email',

      password: this.config.get<string>('SHIPROCKET_PASSWORD') ?? 'password',
    });

    const token = result.data.token;

    // cache for 4 days
    await this.redisService.set(
      cacheKey,
      token,
      ShiprocketProvider.TOKEN_CACHE_TTL_SECONDS,
    );

    return token;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private getTokenCacheKey(): string {
    const email = (this.config.get<string>('SHIPROCKET_EMAIL') || 'unknown')
      .trim()
      .toLowerCase();
    return `${ShiprocketProvider.CACHE_KEY_PREFIX}:${email}`;
  }
}
