import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly CACHE_TTL: number;
  constructor(
    private configService: ConfigService,
    @Inject('REDIS_CLIENT')
    public readonly redisClient: Redis,
  ) {
    this.CACHE_TTL = Number(this.configService.get<string>('CACHE_TTL', '300'));
  }

  async incrWithExpire(
    key: string,
    ttl: number = this.CACHE_TTL,
  ): Promise<number> {
    const value = await this.redisClient.incr(key);

    if (value === 1) {
      await this.redisClient.expire(key, ttl);
    }

    return value;
  }
  /**
   * Set value with data type metadata for accurate deserialization
   */
  async set(
    key: string,
    value: any,
    ttl: number = this.CACHE_TTL,
  ): Promise<void> {
    const valueType = typeof value;

    // Convert non-string values to JSON
    const serializedValue =
      valueType === 'string' ? value : JSON.stringify(value);

    // Store the value with TTL (in seconds)
    await this.redisClient.set(key, serializedValue, 'EX', ttl);

    // Store metadata for data type
    await this.redisClient.set(`${key}:type`, valueType, 'EX', ttl);
  }

  /**
   * Get value and deserialize based on its stored data type
   */
  async get<T>(key: string): Promise<T | null> {
    // Get the data type metadata
    const typeData = await this.redisClient.get(`${key}:type`);
    if (!typeData) return null; // If type metadata is missing, return null

    const valueType = typeData;
    const serializedValue = await this.redisClient.get(key);

    if (!serializedValue) return null;

    // Deserialize based on type
    if (valueType === 'string') {
      return serializedValue as T;
    } else {
      try {
        return JSON.parse(serializedValue) as T;
      } catch (error) {
        console.error('Failed to parse cached data:', error);
        return null;
      }
    }
  }

  /**
   * Delete a single key or multiple keys
   */
  async del(keys: string[]): Promise<void> {
    // Delete value and its type metadata
    const keysToDelete = [...keys, ...keys.map((key) => `${key}:type`)];
    await this.redisClient.del(...keysToDelete);
  }

  /**
   * Clear cache by prefix using SCAN to avoid blocking Redis
   */
  async clearCacheByPrefix(prefix: string): Promise<void> {
    const stream = this.redisClient.scanStream({
      match: `${prefix}*`,
      count: 100, // Process in batches of 100
    });

    return new Promise((resolve, reject) => {
      const pipeline = this.redisClient.pipeline();

      stream.on('data', (keys: string[]) => {
        if (keys.length) {
          pipeline.del(...keys);
        }
      });

      stream.on('end', async () => {
        try {
          await pipeline.exec();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      stream.on('error', (error: any) => {
        reject(error);
      });
    });
  }

  onModuleDestroy() {
    this.redisClient.disconnect(); // Gracefully disconnect in ioredis
  }
}
