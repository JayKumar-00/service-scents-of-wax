import { Body, Controller, Get, Ip, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { RecordPartialReceiptDto } from './dto/record-partial-receipt.dto';
import { ResolveInboundDiscrepancyDto } from './dto/resolve-inbound-discrepancy.dto';
import { UpdateDeliveryMetaDto } from './dto/update-delivery-meta.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { DeliveriesService } from './deliveries.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeliveryQueryDto } from './dto/delivery-query.dto';
import { DeliveryShipmentDto } from './dto/delivery-shipment.dto';
import { UnifiedListQueryDto } from './dto/unified-list-query.dto';

@ApiTags(
  'Deliveries <- Admin, Franchise Owner, Franchise Staff, Franchise Auditor',
)
@ApiBearerAuth('access-token')
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  @ApiOperation({
    summary:
      'List deliveries (SuperAdmin | Franchise Owner/Staff for their deliveries)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  list(@CurrentUser() user: JwtUser, @Query() query: DeliveryQueryDto) {
    return this.deliveries.list({
      ...query,
      ...(user?.franchiseId ? { franchiseId: user.sub } : {}),
      ...(user?.franchiseOwnerId ? { franchiseId: user.franchiseOwnerId } : {}),
    });
  }

  @Get('admin/unified-list')
  @ApiOperation({
    summary:
      'List online orders and stock requests unified with pagination and optional filters (Super Admin or Admin Staff)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  listUnified(
    @CurrentUser() user: JwtUser,
    @Query() query: UnifiedListQueryDto,
  ) {
    return this.deliveries.listUnifiedForAdmin(user, query);
  }

  @Get('shipments')
  @ApiOperation({
    summary:
      'List deliveries (SuperAdmin | Franchise Owner/Staff for their deliveries)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  listWithShipments(
    @CurrentUser() user: JwtUser,
    @Query() query: DeliveryShipmentDto,
  ) {
    return this.deliveries.listWithShipments({
      ...query,
      ...(user?.franchiseId ? { franchiseId: user.sub } : {}),
      ...(user?.franchiseOwnerId ? { franchiseId: user.franchiseOwnerId } : {}),
    });
  }

  @Patch(':id/meta')
  @ApiOperation({ summary: 'Update delivery metadata (SuperAdmin)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  updateMeta(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryMetaDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.deliveries.updateMeta(id, dto, user, ip);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Update delivery status via deliveryId (SuperAdmin | Franchise Owner/Staff for their deliveries)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.deliveries.updateStatus(id, dto.status, user, ip);
  }

  @Patch(':id/receive')
  @ApiOperation({
    summary:
      'Record a partial receipt for a delivery (Franchise Owner/Staff for their deliveries)',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  recordPartialReceipt(
    @Param('id') id: string,
    @Body() dto: RecordPartialReceiptDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.deliveries.recordPartialReceipt(id, dto, user, ip);
  }

  @Patch(':id/discrepancy/resolve')
  @ApiOperation({
    summary: 'Resolve an inbound discrepancy for a delivery (SuperAdmin)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  resolveDiscrepancy(
    @Param('id') id: string,
    @Body() dto: ResolveInboundDiscrepancyDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.deliveries.resolveDiscrepancy(id, dto, user, ip);
  }
}
