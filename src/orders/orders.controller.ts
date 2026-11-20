import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role, OrderStatus, OrderChannel } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePosSaleDto } from './dto/create-pos-sale.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderQueryDto } from './dto/order-query.dto';
import { PermissionModule } from 'src/common/decorators/permission-module.decorator';
import { ModuleName } from '../staff-management/enums/module-name.enum';
import { OrderRequestResponseDto } from 'src/order-allocation/dto/order-request-response.dto';
import { PreviewFranchisesDto } from './dto/preview-franchises.dto';

@ApiTags('Orders <- Customers, Franchise Owners, Staff, Auditors, Super Admin')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  private applyStatusLogic(dto: any, channel?: string) {
    // Universally default to CREATED
    dto.status = OrderStatus.CREATED;

    // Ensure other flows should not be broken, only apply when CHANNEL is POS
    const actualChannel = channel || dto.channel?.toString().toUpperCase();

    if (actualChannel === 'POS' || actualChannel === OrderChannel.POS) {
      const saleType = dto.saleType?.toString().toUpperCase();
      const paymentMode = dto.paymentMode?.toString().toUpperCase();

      const isCodOrCash = paymentMode === 'COD' || paymentMode === 'CASH';
      const isPickupOrDelivery =
        saleType === 'PICKUP' || saleType === 'DELIVERY';
      const isWalkIn =
        saleType === 'WALK-IN' ||
        saleType === 'WALK_IN' ||
        saleType === 'WALKIN';

      if (isCodOrCash) {
        if (isPickupOrDelivery) {
          dto.status = OrderStatus.CONFIRMED;
        } else if (isWalkIn) {
          dto.status = OrderStatus.DELIVERED;
        }
      }
    }
  }

  @Get()
  @ApiOperation({
    summary:
      'List orders with pagination and optional filters (Franchise Owner, Staff, Auditor, Super Admin, or Admin Staff)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.CUSTOMER,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  list(@CurrentUser() user: JwtUser, @Query() query: OrderQueryDto) {
    console.log('Received query parameters:', user);
    return this.orders.listForUser(user, {
      ...query,
      ...(user.role === Role.CUSTOMER ? { customerId: user.customerId } : {}),
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : {}),
      ...(user.role === Role.FRANCHISE_STAFF
        ? { franchiseId: user.franchiseOwnerId }
        : {}),
    });
  }

  @Get('preview-franchises')
  @ApiOperation({
    summary: 'Preview top 5 nearest active franchises within a range',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.CUSTOMER,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  previewFranchises(@Query() dto: PreviewFranchisesDto) {
    return this.orders.previewNearestFranchises(dto);
  }

  @Get(':id/invoice')
  @ApiOperation({
    summary:
      'Get HTML invoice for an order (Franchise Owner, Staff, Auditor, Customer, Super Admin, or Admin Staff)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.CUSTOMER,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  async invoice(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.orders.invoiceHtml(id, user);
  }

  @Get(':orderNumber/upsert-invoice')
  @ApiOperation({
    summary:
      'To get invoice (Franchise Owner, Staff, Auditor, Customer, Super Admin, or Admin Staff)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.CUSTOMER,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  async upsertInvoice(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.orders.upsertInvoice(user, orderNumber);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get order details by ID (Franchise Owner, Staff, Auditor, Customer, Super Admin, or Admin Staff)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.CUSTOMER,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  getOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.orders.getById(id, user);
  }

  @Post('pos')
  @ApiOperation({
    summary: 'Create POS sale (for franchise staff, franchise owner, or admin)',
  })
  @Roles(
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
  )
  createPos(
    @Body() dto: CreatePosSaleDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    this.applyStatusLogic(dto, OrderChannel.POS);
    return this.orders.createPosSale(dto, user, ip);
  }

  @Post()
  @ApiOperation({
    summary: 'Create new order request (for customers or admin)',
  })
  @Roles(Role.CUSTOMER, Role.SUPERADMIN, Role.ADMIN_STAFF)
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: JwtUser,
  ): Promise<OrderRequestResponseDto> {
    return this.orders.create(dto, user);
  }

  @Post(':id/pay')
  @ApiOperation({
    summary: 'Pay for an order online (for customers)',
  })
  @Roles(Role.CUSTOMER)
  pay(
    @Param('id') id: string,
    @Body() dto: PayOrderDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.orders.payOnline(id, user, dto);
  }

  @Post(':id/mark-paid')
  @ApiOperation({
    summary: 'Mark an order as paid manually (typically for COD orders)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  markPaid(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.orders.markOrderPaidManual(id, user);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an unpaid order (for customers)',
  })
  @Roles(Role.CUSTOMER)
  cancel(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.orders.cancelOnlineUnpaid(id, user);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update order status (for franchise owner, staff, or admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.orders.updateStatus(id, dto.status, user, ip);
  }
}
