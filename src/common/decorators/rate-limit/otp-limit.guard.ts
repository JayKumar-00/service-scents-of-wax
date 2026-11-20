import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class OtpRateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || 'unknown';

    const limit = this.configService.get<number>('OTP_LIMIT') ?? 1;
    const ttlMinutes = this.configService.get<number>('OTP_TTL') ?? 1; // in minutes
    const ttlSeconds = ttlMinutes * 60;

    const key = `otp:${ip}`;
    const countStr = await this.redis.get(key);

    let count = 0;
    if (countStr) {
      const parsed = Number(countStr);
      if (isNaN(parsed)) {
        // Corrupted data, reset counter
        await this.redis.del([key]);
        await this.redis.set(key, '1', ttlSeconds);
        return true;
      }
      count = parsed;
    }

    if (count === 0) {
      await this.redis.set(key, '1', ttlSeconds);
      return true;
    }

    if (count < limit) {
      // increment and ensure expiry is set
      await this.redis.incrWithExpire(key);
      return true;
    }

    throw new ForbiddenException(
      `Too many OTP requests. Try again after ${ttlMinutes} minutes.`,
    );
  }
}
