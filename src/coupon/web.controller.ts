import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { CouponService } from './coupon.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@ApiTags('Coupons <- Web (Public)')
@Controller('web/coupons')
@Public()
export class WebController {
  constructor(
    private readonly couponService: CouponService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  private getCustomerIdFromHeader(): string | undefined {
    const authHeader = this.request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader?.split(' ')[1];
      if (token) {
        try {
          const payloadStr = Buffer.from(token.split('.')[1], 'base64').toString(
            'ascii',
          );
          const payload = JSON.parse(payloadStr);
          return payload?.customerId;
        } catch (err) {}
      }
    }
    return undefined;
  }

  @Get()
  @ApiOperation({ summary: 'List coupons' })
  async list(@Query() query: CouponQueryDto) {
    const customerId = this.getCustomerIdFromHeader();
    return this.couponService.list(query, {
      excludeExpired: true,
      customerId,
      isWeb: true,
    });
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get coupon by code' })
  async getById(@Param('code') code: string) {
    const customerId = this.getCustomerIdFromHeader();
    return this.couponService.getById(code, { customerId, isWeb: true });
  }
}
