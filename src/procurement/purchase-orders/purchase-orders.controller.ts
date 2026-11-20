import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';
import { UpdatePurchaseOrderStatusDto } from './dto/update-purchase-order-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('Procurement Purchase Orders')
@ApiBearerAuth('access-token')
@Controller('procurement/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: JwtUser) {
    return this.purchaseOrdersService.create(dto, user.sub);
  }

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'List purchase orders with filters, search, sorting, and pagination',
  })
  list(@Query() query: PurchaseOrderQueryDto) {
    return this.purchaseOrdersService.list(query);
  }


  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  get(@Param('id') id: string) {
    return this.purchaseOrdersService.get(id);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.update(id, dto, user.sub);
  }

  @Patch(':id/status')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Update status of purchase order',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.updateStatus(id, dto.status, user.sub);
  }

  @Post(':id/approve')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  approve(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.purchaseOrdersService.approve(id, user.sub);
  }
}
