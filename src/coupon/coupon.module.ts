import { Module } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CouponController } from './coupon.controller';
import { WebController } from './web.controller';

@Module({
  providers: [CouponService],
  controllers: [CouponController, WebController],
})
export class CouponModule {}
