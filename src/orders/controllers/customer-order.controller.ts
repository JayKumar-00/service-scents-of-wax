import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CreateOrderFromCartDto } from './dto/allocate-cart-order.dto';
import { OrdersService } from '../orders.service';
import { FulfillmentPreviewService } from '../services/fulfillment-preview.service';
import {
  CheckoutPreviewQueryDto,
  CheckoutPreviewResponseDto,
  SingleFranchiseResponseDto,
  MultiFranchiseResponseDto,
  OutOfStockResponseDto,
  SingleOnlyUnavailableResponseDto,
  EmergencyPartialResponseDto,
} from './dto/checkout-preview.dto';

@ApiTags('Customer Orders <- Customers')
@ApiBearerAuth('access-token')
@Controller('customer/order')
export class CustomerOrderController {
  constructor(
    private readonly orderService: OrdersService,
    private readonly fulfillmentPreviewService: FulfillmentPreviewService,
  ) {}

  @Get('checkout-preview/:cartId')
  @ApiOperation({
    summary: 'Preview cart fulfillment possibilities before order creation',
  })
  @ApiResponse({
    status: 200,
    description: 'Fulfillment preview with SINGLE_FRANCHISE availability',
    type: SingleFranchiseResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Multi-franchise allocation required',
    type: MultiFranchiseResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Fulfillment impossible - out of stock items',
    type: OutOfStockResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Single franchise could not cover the full cart',
    type: SingleOnlyUnavailableResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Emergency partial allocation across franchises',
    type: EmergencyPartialResponseDto,
  })
  async checkoutPreview(
    @CurrentUser() user: JwtUser,
    @Param('cartId') cartId: string,
    @Query() query: CheckoutPreviewQueryDto,
  ): Promise<CheckoutPreviewResponseDto> {
    return this.fulfillmentPreviewService.previewCheckout(cartId, user, query);
  }

  @Post('from-cart/:cartId')
  @ApiOperation({
    summary: 'Create one or more orders from cart id (franchise-wise)',
  })
  @ApiResponse({
    status: 201,
    description: 'Orders successfully created from cart (one per franchise)',
  })
  async allocateCart(
    @Param('cartId') cartId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateOrderFromCartDto,
  ) {
    const data = await this.orderService.createFromCart(cartId, user, dto);
    return { data, message: 'Orders submitted successfully' };
  }
}
