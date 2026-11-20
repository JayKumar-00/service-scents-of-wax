import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';
import * as fs from 'fs';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async () => {
        if (!process.env.REDIS_URI) {
          throw new Error('REDIS_URI missing');
        }

        const client = new Redis({
          host: process.env.REDIS_URI,
          port: Number(process.env.REDIS_PORT),
          username: process.env.REDIS_USER || undefined,
          // Only sent when non-empty. ElastiCache rejects AUTH with
          // "ERR Client sent AUTH, but no password is set" when the cluster has
          // no auth token, so an empty value must mean "do not authenticate".
          password: process.env.REDIS_PASSWORD || undefined,
          db: Number(process.env.REDIS_DB ?? 0),
          // TLS is driven by REDIS_TLS, which Terraform derives from the
          // ElastiCache cluster's transit_encryption_enabled. Hardcoding `tls: {}`
          // against a plaintext cluster makes the handshake hang forever rather
          // than fail — every cache-backed request then blocks indefinitely while
          // /health/live keeps returning 200, because it performs no I/O.
          ...(process.env.REDIS_TLS === 'true' ? {
            tls: {
              ca: (process.env.REDIS_CA_CERT_PATH && fs.existsSync(process.env.REDIS_CA_CERT_PATH))
                ? fs.readFileSync(process.env.REDIS_CA_CERT_PATH, 'utf8')
                : undefined,
              rejectUnauthorized: false
            }
          } : {}),

          // CRITICAL FOR BULLMQ - Required for proper queue handling
          // Using maxRetriesPerRequest: null allows infinite retries
          // This prevents BullMQ from hanging waiting for Redis responses
          maxRetriesPerRequest: null,

          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },

          // Enable offline queue to handle temporary disconnections
          enableOfflineQueue: true,

          // Fail the initial connect instead of hanging on an unreachable or
          // mis-negotiated endpoint.
          connectTimeout: 10000,

          // Keep alive every 30 seconds
          keepAlive: 30000,
        });

        client.on('connect', () => {
          console.log('✓ Redis connected');
          // Verify eviction policy is safe for BullMQ
          // volatile-lru with proper TTL is safe if:
          // 1. Queue keys have removeOnComplete/removeOnFail (see credit.queue.ts)
          // 2. Redis maxmemory is set appropriately
          // 3. Jobs have reasonable timeouts
        });

        client.on('error', (err) => {
          console.error('✗ Redis error:', err.message);
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule { }
