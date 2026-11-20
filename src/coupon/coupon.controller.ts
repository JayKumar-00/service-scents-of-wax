import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponService } from './coupon.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('Coupons (Discount Code) <- SuperAdmin')
@ApiBearerAuth('access-token')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
@Controller('coupon')
export class CouponController {
  constructor(private readonly coupons: CouponService) {}

  @Get()
  @ApiOperation({ summary: 'List coupons' })
  list(@Query() query: CouponQueryDto) {
    return this.coupons.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a coupon' })
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCouponDto,
    @Ip() ip: string,
  ) {
    return this.coupons.create(user, dto, ip);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a coupon' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @Ip() ip: string,
  ) {
    return this.coupons.update(user, id, dto, ip);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a coupon' })
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.coupons.remove(user, id, ip);
  }
}
