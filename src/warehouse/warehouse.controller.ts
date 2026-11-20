import { Body, Controller, Get, Ip, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { AdjustWarehouseStockDto } from './dto/adjust-warehouse-stock.dto';
import { WarehouseBulkDto } from './dto/warehouse-bulk.dto';
import { WarehouseDeltaDto } from './dto/warehouse-delta.dto';
import { WarehouseThresholdDto } from './dto/warehouse-threshold.dto';
import { WarehouseService } from './warehouse.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  WarehouseQueryDto,
  WarehouseWithoutPaginationQueryDto,
} from './dto/warehouse-query.dto';

@ApiTags('Warehouse <- Admin')
@ApiBearerAuth('access-token')
@Controller('warehouse')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) { }

  @Get('inventory')
  @ApiOperation({ summary: 'Get current inventory status' })
  inventory(@Query() query: WarehouseQueryDto) {
    return this.warehouse.inventory(query);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Get all warehouse products inventory without pagination',
  })
  allInventory(@Query() query: WarehouseWithoutPaginationQueryDto) {
    return this.warehouse.allInventory(query);
  }

  @Patch('inventory')
  @ApiOperation({ summary: 'Adjust stock quantity for a product' })
  adjust(
    @Body() dto: AdjustWarehouseStockDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.warehouse.adjust(user, dto, ip);
  }

  @Post('inventory/delta')
  @ApiOperation({
    summary: 'Adjust warehouse stock by delta (increase or decrease quantity)',
  })
  delta(
    @Body() dto: WarehouseDeltaDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.warehouse.applyDelta(user, dto, ip);
  }

  @Patch('inventory/threshold')
  @ApiOperation({
    summary: 'Set low stock threshold for a product with audit logging',
  })
  threshold(
    @Body() dto: WarehouseThresholdDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.warehouse.setThreshold(user, dto, ip);
  }

  @Post('inventory/bulk')
  @ApiOperation({
    summary: 'Bulk set stock quantities for multiple products in one request',
  })
  bulk(
    @Body() dto: WarehouseBulkDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.warehouse.bulkSet(user, dto, ip);
  }
}
