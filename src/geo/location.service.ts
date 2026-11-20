import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeoProvider, GeoResult } from './providers/types';
import { GoogleProvider } from './providers/google.provider';
import { OSMProvider } from './providers/osm.provider';
import { RedisService } from 'src/redis/redis.service';
import { buildAddressString } from './utils/build-address';

export type ResolveCoordinatesInput = {
  latitude?: number | null;
  longitude?: number | null;
  village?: string | null;
  area?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);
  private readonly providers: GeoProvider[];

  constructor(
    private readonly config: ConfigService,
    // private readonly redisService: RedisService,
  ) {
    this.providers = [
      new GoogleProvider(this.config), // Primary
      new OSMProvider(this.config), // Fallback
    ];
  }

  private normalize(address: string): string {
    return address.trim().toLowerCase();
  }

  private hasProvidedCoordinates(input: ResolveCoordinatesInput) {
    return (
      typeof input.latitude === 'number' &&
      Number.isFinite(input.latitude) &&
      typeof input.longitude === 'number' &&
      Number.isFinite(input.longitude)
    );
  }

  private buildFallbackAddress(input: ResolveCoordinatesInput) {
    return buildAddressString({
      village: input.village?.trim(),
      area:
        input.area?.trim() ??
        input.addressLine1?.trim() ??
        input.addressLine2?.trim(),
      city: input.city?.trim(),
      state: input.state?.trim(),
      country: input.country?.trim(),
    });
  }

  private async tryWithRetry(
    provider: GeoProvider,
    address: string,
    retries = 1,
  ): Promise<GeoResult | null> {
    for (let i = 0; i <= retries; i++) {
      const result = await provider.geocode(address);
      if (result) return result;
    }
    return null;
  }

  async geocode(address: string): Promise<GeoResult> {
    if (!address || address.trim() === '') {
      throw new Error('Address cannot be empty');
    }

    const key = `geo:${this.normalize(address)}`;

    // 1. Check cache
    // const cached = await this.redisService.get<string>(key);
    // if (cached) {
    //   this.logger.log(`Cache hit for: ${address}`);
    //   return JSON.parse(cached) as GeoResult;
    // }

    // 2. Try providers
    for (const provider of this.providers) {
      try {
        const result = await this.tryWithRetry(provider, address, 1);

        if (result) {
          this.logger.log(
            `Geocode success via ${result.source} for: ${address}`,
          );

          // 3. Save to cache (TTL 24h)
          // await this.redisService.set(
          //   key,
          //   JSON.stringify(result),
          //   60 * 60 * 24,
          // );

          return result;
        }

        this.logger.warn(`Provider ${provider.constructor.name} returned null`);
      } catch (error: any) {
        this.logger.error(
          `Provider ${provider.constructor.name} failed: ${error.message}`,
        );
      }
    }

    // 4. Throw AFTER loop
    throw new Error(`All providers failed for address: ${address}`);
  }

  async resolveCoordinates(input: ResolveCoordinatesInput): Promise<GeoResult> {
    if (this.hasProvidedCoordinates(input)) {
      return {
        lat: input.latitude as number,
        lng: input.longitude as number,
        source: 'provided',
        address: this.buildFallbackAddress(input) || undefined,
      };
    }

    const address = this.buildFallbackAddress(input);
    if (!address) {
      throw new Error('Latitude/Longitude or valid address required');
    }

    return this.geocode(address);
  }
}
