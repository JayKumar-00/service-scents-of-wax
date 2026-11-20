import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from 'src/redis/redis.service';

/**
 * Service responsible for generating and verifying OTPs (One-Time Passwords).
 *
 * OTPs are numeric codes stored in Redis with a TTL and hashed for security.
 */
@Injectable()
export class OtpService {
  /** OTP validity time in seconds */
  private readonly OTP_TTL_SECONDS = 180;

  /** Number of digits in the OTP */
  private readonly OTP_LENGTH = 6;

  /** Redis key prefix for OTP storage */
  private readonly OTP_PREFIX = 'otp';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Build a Redis key for storing OTPs
   * @param subject - user identifier (email, phone, or userId)
   * @param purpose - optional purpose of OTP (e.g., "login", "reset")
   * @returns Redis key string
   */
  private buildKey(subject: string, purpose: string): string {
    return `${this.OTP_PREFIX}:${purpose}:${subject}`;
  }

  /**
   * Hash an OTP using SHA256 for secure storage in Redis
   * @param otp - generated OTP
   * @param subject - user identifier
   * @param purpose - OTP purpose
   * @returns SHA256 hash of the OTP
   */
  private hashOtp(otp: string, subject: string, purpose: string): string {
    return createHash('sha256')
      .update(`${otp}:${subject}:${purpose}`)
      .digest('hex');
  }

  /**
   * Generate a numeric OTP with the configured length
   * @returns OTP string
   */
  private generateNumericOtp(): string {
    const min = Math.pow(10, this.OTP_LENGTH - 1);
    const max = Math.pow(10, this.OTP_LENGTH) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Generate and store an OTP in Redis
   * @param input - Object containing userId, email, phone, and optional purpose
   * @returns OTP and validity duration in minutes
   * @throws BadRequestException if no identifier is provided
   */
  async generateOtp(input: {
    userId?: string;
    email?: string;
    phone?: string;
    purpose?: string;
  }): Promise<{ otp: string; valid: number }> {
    const { userId, email, phone, purpose = 'default' } = input;
    const subject = email?.toLowerCase() || userId || phone;

    if (!subject) {
      throw new BadRequestException('Email or userId is required');
    }

    const otp = this.generateNumericOtp();
    const otpHash = this.hashOtp(otp, subject, purpose);
    const key = this.buildKey(subject, purpose);

    await this.redisService.set(key, { otpHash }, this.OTP_TTL_SECONDS);

    console.log(
      `OTP: ${otp} (Valid only for ${this.OTP_TTL_SECONDS / 60} minutes)`,
    );
    return { otp, valid: this.OTP_TTL_SECONDS / 60 };
  }

  /**
   * Verify an OTP sent via email
   * @param email - User email
   * @param otp - OTP to verify
   * @param purpose - OTP purpose (default is "default")
   * @returns True if OTP is valid, false otherwise
   * @throws BadRequestException if email is missing
   */
  async verifyOtpByEmail(
    email: string,
    otp: string,
    purpose: string = 'default',
  ): Promise<boolean> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // Fixed OTP for development / testing (contact with OTP)
    // if (otp === '123456') {
    //   return true;
    // }

    const subject = email.toLowerCase();
    const key = this.buildKey(subject, purpose);
    const cached = await this.redisService.get<{ otpHash: string }>(key);

    if (!cached) return false;

    const otpHash = this.hashOtp(otp, subject, purpose);

    if (otpHash !== cached.otpHash) return false;
    await this.redisService.del([key]);

    return true;
  }

  /**
   * Verify an OTP sent via phone
   * @param phone - User phone number
   * @param otp - OTP to verify
   * @param purpose - OTP purpose (default is "default")
   * @returns True if OTP is valid, false otherwise
   * @throws BadRequestException if phone is missing
   */
  async verifyOtpByPhone(
    phone: string,
    otp: string,
    purpose: string = 'default',
  ): Promise<boolean> {
    if (!phone) {
      throw new BadRequestException('Phone is required');
    }

    const subject = phone;
    const key = this.buildKey(subject, purpose);
    const cached = await this.redisService.get<{ otpHash: string }>(key);

    if (!cached) return false;

    const otpHash = this.hashOtp(otp, subject, purpose);

    if (otpHash !== cached.otpHash) return false;
    await this.redisService.del([key]);

    return true;
  }
}
