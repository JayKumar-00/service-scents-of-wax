import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CartsService } from './carts.service';
import { CreateAndAddCartDto, BulkAddCartDto } from './dto/create-cart.dto';
import { RemoveCartItemDto, UpdateCartItemDto } from './dto/update-cart.dto';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import {
  IMeta,
  ISuccessResponse,
} from 'src/common/interceptors/envelope.interface';
import { Cart } from '@prisma/client';
import { Public } from 'src/common/decorators/public.decorator';

const CART_SESSION_COOKIE = 'cart_session_id';

@ApiTags('Cart <- Customer, Guest')
@Controller('cart')
export class CartController {
  constructor(private readonly cartsService: CartsService) {}

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private readCookie(req: Request, key: string): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;

    const cookieParts = cookieHeader.split(';');
    for (const part of cookieParts) {
      const [rawKey, ...rest] = part.trim().split('=');
      if (rawKey === key) {
        return decodeURIComponent(rest.join('='));
      }
    }

    return undefined;
  }

  private resolveSessionId(
    req: Request,
    res: Response,
    headerSessionId?: string,
  ): string {
    const fromCookie = this.readCookie(req, CART_SESSION_COOKIE);
    const sessionId = headerSessionId || fromCookie || randomUUID();

    if (!fromCookie || fromCookie !== sessionId) {
      res.cookie(CART_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    return sessionId;
  }

  // ============================================================
  // CUSTOMER ENDPOINTS (Role: CUSTOMER only)
  // ============================================================

  @Post('/item')
  @Roles(Role.CUSTOMER)
  @ApiBearerAuth('access-token')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add item to cart (Customer only)' })
  async createAndAdd(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAndAddCartDto,
  ): Promise<ISuccessResponse<unknown, unknown>> {
    const data = await this.cartsService.createAndAdd(user, dto);

    return {
      data: {
        ...data,
        cartItems: data.items.reduce((sum, item) => sum + item.quantity, 0),
      },
      meta: {
        totalItemTypes: data.itemsCount,
        totalQuantity: data.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    };
  }

  @Post('/items')
  @Roles(Role.CUSTOMER)
  @ApiBearerAuth('access-token')
  @HttpCode(201)
  @ApiOperation({ summary: 'Bulk add items to cart (Customer only)' })
  @ApiBody({ type: BulkAddCartDto })
  async bulkAdd(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkAddCartDto,
  ): Promise<ISuccessResponse<unknown, unknown>> {
    const data = await this.cartsService.bulkCreateAndAdd(user, dto);

    return {
      data: {
        ...data,
        cartItems: data.items.length,
      },
      meta: {
        totalItemTypes: data.itemsCount,
        totalQuantity: data.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    };
  }

  @Post('/merge')
  @Roles(Role.CUSTOMER, Role.FRANCHISE_OWNER)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Merge guest cart into authenticated user cart on login',
  })
  async mergeGuestCart(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-session-id') headerSessionId?: string,
  ): Promise<
    ISuccessResponse<{ mergedCartIds: string[]; skippedItems: any[] }>
  > {
    const sessionId = this.resolveSessionId(req, res, headerSessionId);
    const data = await this.cartsService.mergeGuestCartOnLogin(user, sessionId);

    return {
      data,
      message: 'Guest cart merge completed',
    };
  }

  @Get()
  @Roles(Role.CUSTOMER, Role.FRANCHISE_OWNER)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all carts for authenticated user' })
  async findAll(
    @CurrentUser() user: JwtUser,
  ): Promise<ISuccessResponse<Cart[], IMeta>> {
    const data = await this.cartsService.findAll(user);

    return { data: data as any };
  }

  @Get(':cartId')
  @Roles(Role.CUSTOMER, Role.FRANCHISE_OWNER)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get cart by id' })
  async findOne(
    @CurrentUser() user: JwtUser,
    @Param('cartId') cartId: string,
  ): Promise<ISuccessResponse<Cart>> {
    const data = await this.cartsService.findOne(user, cartId);

    return { data: data as any };
  }

  @Patch(':cartId/item')
  @Roles(Role.CUSTOMER)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update cart item quantity (Customer only)' })
  @ApiBody({ type: UpdateCartItemDto })
  async updateItem(
    @CurrentUser() user: JwtUser,
    @Param('cartId') cartId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<ISuccessResponse<unknown, unknown>> {
    const data = await this.cartsService.updateItem(user, cartId, dto);

    return {
      data: data as any,
      meta: {
        totalItemTypes: data.itemsCount,
        totalQuantity: data.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    };
  }

  @Delete(':cartId/item')
  @Roles(Role.CUSTOMER)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove cart item (Customer only)' })
  @ApiBody({ type: RemoveCartItemDto })
  async deleteOneByOne(
    @CurrentUser() user: JwtUser,
    @Param('cartId') cartId: string,
    @Body() dto: RemoveCartItemDto,
  ): Promise<ISuccessResponse<Cart, unknown>> {
    const data = await this.cartsService.deleteOneByOne(user, cartId, dto);

    return {
      data: data as any,
      meta: {
        totalItemTypes: data.itemsCount,
        totalQuantity: data.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    };
  }

  @Delete(':cartId')
  @Roles(Role.CUSTOMER)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete entire cart (Customer only)' })
  async deleteComplete(
    @CurrentUser() user: JwtUser,
    @Param('cartId') cartId: string,
  ): Promise<ISuccessResponse<Cart>> {
    const data = await this.cartsService.deleteComplete(user, cartId);

    return {
      data: data as any,
      message: 'Cart deleted successfully',
    };
  }

  // ============================================================
  // GUEST / SESSION-BASED ENDPOINTS (No Authentication)
  // ============================================================

  @Post('/guest/item')
  @Public()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Add item to guest cart (session-based)',
  })
  @ApiBody({ type: CreateAndAddCartDto })
  async createAndAddGuest(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: CreateAndAddCartDto,
    @Headers('x-session-id') headerSessionId?: string,
  ): Promise<ISuccessResponse<Cart>> {
    const sessionId = this.resolveSessionId(req, res, headerSessionId);
    const data = await this.cartsService.createAndAddGuest(sessionId, dto);

    return {
      data: data as any,
      message: 'Guest cart updated successfully',
    };
  }

  @Post('/guest/items')
  @Public()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Bulk add items in guest cart (session-based)',
  })
  @ApiBody({ type: BulkAddCartDto })
  async bulkAddGuest(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: BulkAddCartDto,
    @Headers('x-session-id') headerSessionId?: string,
  ): Promise<ISuccessResponse<unknown>> {
    const sessionId = this.resolveSessionId(req, res, headerSessionId);
    const data = await this.cartsService.bulkAddGuest(sessionId, dto);

    return {
      data: data as any,
      message: 'Guest cart updated successfully',
    };
  }

  @Get('/guest/list')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get all active guest carts for current session',
  })
  async findGuestCarts(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-session-id') headerSessionId?: string,
  ): Promise<ISuccessResponse<Cart[]>> {
    const sessionId = this.resolveSessionId(req, res, headerSessionId);
    const data = await this.cartsService.findGuestCarts(sessionId);

    return { data: data as any };
  }

  @Get('/guest/:cartId')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get guest cart by id' })
  async findOneGuest(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('cartId') cartId: string,
    @Headers('x-session-id') headerSessionId?: string,
  ): Promise<ISuccessResponse<Cart>> {
    const sessionId = this.resolveSessionId(req, res, headerSessionId);
    const data = await this.cartsService.findOneGuest(sessionId, cartId);

    return { data: data as any };
  }

  @Patch('/guest/:cartId/item')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Update guest cart item quantity' })
  @ApiBody({ type: UpdateCartItemDto })
  async updateItemGuest(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('cartId') cartId: string,
    @Body() dto: UpdateCartItemDto,
    @Headers('x-session-id') headerSessionId?: string,
  ): Promise<ISuccessResponse<Cart>> {
    const sessionId = this.resolveSessionId(req, res, headerSessionId);
    const data = await this.cartsService.updateItemGuest(
      sessionId,
      cartId,
      dto,
    );

    return {
      data: data as any,
      message: 'Guest cart item updated successfully',
    };
  }

  @Delete('/guest/:cartId/item')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove one item from guest cart' })
  @ApiBody({ type: RemoveCartItemDto })
  async deleteOneByOneGuest(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('cartId') cartId: string,
    @Body() dto: RemoveCartItemDto,
    @Headers('x-session-id') headerSessionId?: string,
  ): Promise<ISuccessResponse<Cart>> {
    const sessionId = this.resolveSessionId(req, res, headerSessionId);
    const data = await this.cartsService.deleteOneByOneGuest(
      sessionId,
      cartId,
      dto,
    );

    return {
      data: data as any,
      message: 'Guest cart item removed successfully',
    };
  }

  @Delete('/guest/:cartId')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete guest cart completely' })
  async deleteCompleteGuest(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('cartId') cartId: string,
    @Headers('x-session-id') headerSessionId?: string,
  ): Promise<ISuccessResponse<Cart>> {
    const sessionId = this.resolveSessionId(req, res, headerSessionId);
    const data = await this.cartsService.deleteCompleteGuest(sessionId, cartId);

    return {
      data: data as any,
      message: 'Guest cart deleted successfully',
    };
  }
}
