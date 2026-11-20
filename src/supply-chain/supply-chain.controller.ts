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
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { DomainEventsService } from './domain-events.service';
import { ReplenishmentNetworkService } from './replenishment-network.service';
import { StockingNodesService } from './stocking-nodes.service';
import { StockTransfersService } from './stock-transfers.service';
import { TransportLanesService } from './transport-lanes.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { CreateStockingNodeDto } from './dto/create-stocking-node.dto';
import { CreateTransportLaneDto } from './dto/create-transport-lane.dto';
import { UpsertReplenishmentPolicyDto } from './dto/upsert-replenishment-policy.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListNodeQueryDto } from './dto/list-node-query.dto';
import { TransportLaneQueryDto } from './dto/transport-lane-query.dto';
import { StockTransferQueryDto } from './dto/stock-transfer-query.dto';
import { ReplenishmentPolicyQueryDto } from './dto/replenishmentPolicy-query.dto';
import { NetworkInventoryQueryDto } from './dto/network-inventory-query.dto';
import { AtpQueryDto } from './dto/atp-query.dto';
import {
  AllocationQueryDto,
  AllocationWithoutFilterQueryDto,
} from './dto/allocation-query.dto';
import { SuggessionQueryDto } from './dto/suggession-query.dto';
import { EventTimeLineQueryDto } from './dto/event-query.dto';
import { OutboxQueryDto } from './dto/outbox-query.dto';
import { StockingNodeInventoryQueryDto } from './dto/stocking-nodes-with-inventory.dto';
import { TransferStatusDto } from './dto/transfer-status.dto';

@ApiTags(
  'Supply-Chain  <- Admin, Franchise Owner, Franchise Staff, Franchise Auditor',
)
@ApiBearerAuth('access-token')
@Controller('supply-chain')
export class SupplyChainController {
  constructor(
    private readonly nodes: StockingNodesService,
    private readonly lanes: TransportLanesService,
    private readonly transfers: StockTransfersService,
    private readonly network: ReplenishmentNetworkService,
    private readonly domainEvents: DomainEventsService,
  ) { }

  @Get('nodes')
  @ApiOperation({
    summary:
      'List all stocking nodes (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  listNodes(@CurrentUser() user: JwtUser, @Query() query: ListNodeQueryDto) {
    return this.nodes.list(user, query);
  }

  @Get('nodes/inventory/with-types')
  @ApiOperation({
    summary:
      'List inventory records resolved from the StockingNodeType case-map (CSV model per nodeType): ' +
      'WAREHOUSE_STOCK/CENTRAL_DC → WarehouseStock | REGIONAL_HUB → HubInventory (joined to its StockingNode) | STORE → FranchiseStock (joined to its StockingNode/franchise). ' +
      'Filter by type=WarehouseStock, type=CentralDc, type=RegionalHub, or type=Store. Each record includes the full product detail.',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  listNodeInventory(
    @CurrentUser() user: JwtUser,
    @Query() query: StockingNodeInventoryQueryDto,
  ) {
    return this.nodes.listNodeInventory(user, query);
  }

  @Get('nodes/:id')
  @ApiOperation({
    summary:
      'Get details of a specific stocking node by ID (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  getNode(@Param('id') id: string) {
    return this.nodes.get(id);
  }

  @Post('nodes')
  @ApiOperation({
    summary: 'Create a new stocking node (Super Admin only)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  createNode(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateStockingNodeDto,
    @Ip() ip: string,
  ) {
    return this.nodes.create(user, dto, ip);
  }

  @Post('nodes/ensure-central')
  @ApiOperation({
    summary:
      'Ensure that a central distribution center (DC) stocking node exists, and return its ID (Super Admin only)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  ensureCentral(
    @CurrentUser() user: JwtUser,
    @Ip() ip: string
  ) {
    return this.nodes.ensureCentralDc({ userId: user.sub, ip });
  }

  @Get('lanes')
  @ApiOperation({
    summary:
      'List all transport lanes between stocking nodes (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  listLanes(
    @CurrentUser() user: JwtUser,
    @Query() query: TransportLaneQueryDto,
  ) {
    return this.lanes.list(user, query);
  }

  @Post('lanes')
  @ApiOperation({
    summary:
      'Create a new transport lane between stocking nodes (Super Admin only)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  async createLane(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateTransportLaneDto,
    @Ip() ip: string,
  ) {
    await this.nodes.ensureCentralDc({ userId: user.sub, ip });
    return this.lanes.create(dto, { userId: user.sub, ip });
  }

  @Get('transfers')
  @ApiOperation({
    summary:
      'List all stock transfers between nodes (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  listTransfers(
    @CurrentUser() user: JwtUser,
    @Query() query: StockTransferQueryDto,
  ) {
    return this.transfers.list(user, query);
  }

  @Post('transfers')
  @ApiOperation({
    summary: 'Create a new stock transfer between nodes (Super Admin only)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  createTransfer(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateStockTransferDto,
    @Ip() ip: string
  ) {
    return this.transfers.createDraft(user, {
      fromNodeId: dto.fromNodeId,
      toNodeId: dto.toNodeId,
      note: dto.note,
      lines: dto.lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
      })),
    }, ip);
  }

  @Patch('transfers/:id/approve')
  @ApiOperation({
    summary: 'Approve a pending stock transfer (Super Admin only)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  approveTransfer(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.transfers.approve(id, user);
  }

  @Patch('transfers/status/:transferId')
  @ApiOperation({
    summary: 'Update the status of a stock transfer (Super Admin only)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  updateTransferStatus(
    @CurrentUser() user: JwtUser,
    @Param('transferId') transferId: string,
    @Body() dto: TransferStatusDto,
    @Ip() ip: string
  ) {
    return this.transfers.setTransferStatus(user, transferId, dto.status, ip);
  }

  @Patch('transfers/:id/ship')
  @ApiOperation({
    summary: 'Mark an approved stock transfer as shipped (Super Admin only)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  shipTransfer(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.transfers.ship(id, user);
  }

  @Patch('transfers/:id/receive')
  @ApiOperation({
    summary:
      'Mark a shipped stock transfer as received (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  receiveTransfer(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string
  ) {
    return this.transfers.receive(id, user, ip);
  }

  @Get('policies')
  @ApiOperation({
    summary:
      'List replenishment policies for products at stocking nodes (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  listPolicies(
    @CurrentUser() user: JwtUser,
    @Query() query: ReplenishmentPolicyQueryDto,
  ) {
    // return this.network.listPolicies(user, franchiseId);
    return this.network.listPolicies(user, query);
  }

  @Post('policies')
  @ApiOperation({
    summary:
      'Create or update a replenishment policy for a product at a stocking node (Super Admin only)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  upsertPolicy(
    @Body() dto: UpsertReplenishmentPolicyDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.network.upsertPolicy(user, dto, ip);
  }

  @Get('network-inventory')
  @ApiOperation({
    summary:
      'Get current inventory levels across the replenishment network (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  networkInventory(@CurrentUser() user: JwtUser) {
    return this.network.networkInventory(user);
  }

  @Get('network-inventory/with--filter-pagination')
  @ApiOperation({
    summary:
      'Get current inventory levels across the replenishment network with filter & pagination (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  networkInventoryWithFilterPagination(
    @CurrentUser() user: JwtUser,
    @Query() query: NetworkInventoryQueryDto,
  ) {
    return this.network.networkInventoryWithFilterPagination(user, query);
  }

  // @Get('atp')
  // @ApiOperation({
  //   summary:
  //     'Get available-to-promise (ATP) quantity for a product at a franchise (Franchise Owner, Staff, Auditor, or Super Admin)',
  // })
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_STAFF,
  //   Role.FRANCHISE_AUDITOR,
  // )
  // atp(@CurrentUser() user: JwtUser, @Query() query: AtpQueryDto) {
  //   return this.network.atp(user, query);
  // }

  @Get('atp/with-filter-pagination')
  @ApiOperation({
    summary:
      'Get available-to-promise (ATP) quantity for a product at a franchise (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  atpWithPagination(@CurrentUser() user: JwtUser, @Query() query: AtpQueryDto) {
    return this.network.atpWithFilterPagination(user, query);
  }

  @Get('allocation')
  @ApiOperation({
    summary:
      'Get recommended transport lane allocations for a product at a franchise (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  allocation(
    @CurrentUser() user: JwtUser,
    @Query() query: AllocationWithoutFilterQueryDto,
  ) {
    return this.network.allocationLanes(user, query);
  }

  @Get('allocation/with-filter-pagination')
  @ApiOperation({
    summary:
      'Get recommended transport lane allocations for a product at a franchise (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  @ApiOperation({
    summary:
      'Get recommended transport lane allocations for a product at a franchise with filter & pagination (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  allocationWithFilterPagination(
    @CurrentUser() user: JwtUser,
    @Query() query: AllocationQueryDto,
  ) {
    return this.network.allocationLanesFilterWithPagination(user, query);
  }

  @Get('suggestions')
  @ApiOperation({
    summary:
      'Get suggested replenishment orders for a franchise based on current inventory and policies (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  suggestions(
    @CurrentUser() user: JwtUser,
    @Query() query: SuggessionQueryDto,
  ) {
    return this.network.suggestedOrdersWithFilterPagination(user, query);
  }

  @Get('events')
  @ApiOperation({
    summary:
      'Get timeline of supply chain events (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  events(@CurrentUser() user: JwtUser, @Query() query: EventTimeLineQueryDto) {
    return this.network.eventTimeline(user, query);
  }

  @Get('outbox')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'List outbox messages for supply chain events (Super Admin only)',
  })
  outbox(@CurrentUser() user: JwtUser, @Query() query: OutboxQueryDto) {
    return this.network.listOutbox(user, query);
  }

  @Post('outbox/retry')
  @ApiOperation({
    summary:
      'Manually trigger retry of failed outbox messages for supply chain events (Super Admin only)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  retryOutbox(
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : 25;
    return this.domainEvents.retryOutboxBatch(
      user,
      Number.isFinite(limit) ? limit : 25,
      ip,
    );
  }
}
