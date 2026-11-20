import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { WishlistQueryDto } from './dto/wishlist-query.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('Wishlist <- Customer')
@ApiBearerAuth('access-token')
@Roles(Role.CUSTOMER, Role.SUPERADMIN)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async findAll(
    @CurrentUser() user: JwtUser,
    @Query() query: WishlistQueryDto,
  ) {
    return this.wishlistService.findAll({
      ...query,
      ...(user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF
        ? {}
        : { customerId: user.customerId }),
    });
  }

  @Get('ids')
  async getWishlistIds(
    @Req() req: any,
    @Query('customerId') queryCustomerId?: string,
  ) {
    const targetCustomerId =
      req.user?.role === Role.SUPERADMIN && queryCustomerId
        ? queryCustomerId
        : req.user?.customerId;

    if (!targetCustomerId) {
      throw new UnauthorizedException('Customer ID is required');
    }
    return this.wishlistService.getWishlistIds(targetCustomerId);
  }

  // Make sure to protect this route with your authentication guard
  @Post('toggle')
  async toggleWishlist(@Req() req: any, @Body() dto: ToggleWishlistDto) {
    const customerId = req.user?.customerId;
    if (!customerId) {
      throw new UnauthorizedException('Customer is not authenticated');
    }
    return this.wishlistService.toggle(customerId, dto);
  }
}
