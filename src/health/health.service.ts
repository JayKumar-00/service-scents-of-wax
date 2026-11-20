import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  liveness() {
    return {
      status: 'ok',
      service: 'giftfactory-api',
      check: 'liveness',
      env: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
    };
  }

  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        check: 'readiness',
        database: 'disconnected',
      });
    }

    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error('unexpected redis ping response');
      }
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        check: 'readiness',
        cache: 'disconnected',
      });
    }

    return {
      status: 'ok',
      service: 'giftfactory-api',
      check: 'readiness',
      database: 'connected',
      cache: process.env.CACHE_ENGINE ?? 'valkey',
      env: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
    };
  }
}
