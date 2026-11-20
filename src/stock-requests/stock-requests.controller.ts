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
import { ApproveStockRequestDto } from './dto/approve-stock-request.dto';
import { BulkApproveStockRequestsDto } from './dto/bulk-approve.dto';
import { CreateAdminStockRequestDto } from './dto/create-admin-stock-request.dto';
import {
  CreateAdminBulkStockRequestDto,
  CreateBulkStockRequestsDto,
} from './dto/create-bulk-stock-requests.dto';
import { CreateStockRequestDto } from './dto/create-stock-request.dto';
import { InstantStockRequestPaymentDto } from './dto/instant-stock-request-payment.dto';
import { RejectStockRequestDto } from './dto/reject-stock-request.dto';
import { UpdateStockRequestPaymentDto } from './dto/update-stock-request-payment.dto';
import { BulkInstantStockRequestPaymentDto } from './dto/bulk-instant-stock-request-payment.dto';
import { StockRequestsService } from './stock-requests.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StockRequestQueryDto } from './dto/stock-request.query.dto';
import { PermissionModule } from '../common/decorators/permission-module.decorator';
import { ModuleName } from 'src/staff-management/enums/module-name.enum';

@ApiTags(
  'Stock-Requests <- Admin, Franchise Owner, Franchise Staff, Franchise Auditor',
)
@ApiBearerAuth('access-token')
@PermissionModule(ModuleName.STOCK_REQUESTS)
@Controller('stock-requests')
export class StockRequestsController {
  constructor(private readonly stockRequests: StockRequestsService) { }

  @Get()
  @ApiOperation({
    summary:
      'List stock requests for the current user, optionally filtered (Franchise Owner, Staff, Auditor, or Super Admin)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_OWNER,
  )
  list(@CurrentUser() user: JwtUser, @Query() query: StockRequestQueryDto) {
    return this.stockRequests.listWithFiltersPagination(user, {
      ...query,
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : user.role === Role.FRANCHISE_STAFF
          ? { franchiseId: user.franchiseOwnerId }
          : {}),
    });
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get details of a single stock request by ID (Franchise Owner, Staff, Auditor, or Super Admin).',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_OWNER,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.stockRequests.findOne(id, user);
  }

  @Post('bulk-approve')
  @ApiOperation({
    summary: 'Bulk approve multiple stock requests by their IDs (Super Admin).',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  bulkApprove(
    @Body() dto: BulkApproveStockRequestsDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.stockRequests.bulkApprove(dto.ids, user, ip);
  }

  @Post('bulk')
  @ApiOperation({
    summary:
      'Create multiple stock requests in bulk for the current user (Franchise Owner or Staff).',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  createBulk(
    @Body() dto: CreateBulkStockRequestsDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.stockRequests.createByFranchiseInBulk(
      user,
      dto.items,
      dto.note,
      ip,
      dto.type,
    );
  }

  @Post('admin')
  @ApiOperation({
    summary: 'Create a stock request on behalf of a franchise (Super Admin).',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  createAdmin(
    @Body() dto: CreateAdminStockRequestDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.stockRequests.createByAdmin(dto, user, ip);
  }

  @Post('bulk/admin')
  @ApiOperation({
    summary:
      'Create a stock request with bulk on behalf of a franchise (Super Admin).',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  createBulkAdmin(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAdminBulkStockRequestDto,
    @Ip() ip: string,
  ) {
    return this.stockRequests.createByAdminInBulk(user, dto, ip);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a stock request for the current user (Franchise Owner or Staff).',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  create(@Body() dto: CreateStockRequestDto, @CurrentUser() user: JwtUser) {
    return this.stockRequests.create(dto, user);
  }

  @Post(':id/instant-payment')
  @ApiOperation({
    summary:
      'Initiate instant payment for a stock request using credit or direct gateway flow.',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  instantPayment(
    @Param('id') id: string,
    @Body() dto: InstantStockRequestPaymentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.stockRequests.instantPayment(id, dto, user);
  }

  @Post('bulk-instant-payment')
  @ApiOperation({
    summary:
      'Initiate instant payment for multiple stock requests (Franchise Owner/Staff).',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  bulkInstantPayment(
    @Body() dto: BulkInstantStockRequestPaymentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.stockRequests.bulkInstantPayment(dto.ids, dto, user);
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Approve a stock request by its ID (Super Admin).',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveStockRequestDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.stockRequests.approve(id, user, ip, dto.approvedQuantity);
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Reject a stock request by its ID with a reason (Super Admin).',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectStockRequestDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.stockRequests.reject(id, dto.reason, user, ip);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a stock request by its ID (Franchise Owner, Staff, or Admin).',
  })
  @Roles(
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
  )
  cancel(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RejectStockRequestDto,
    @Ip() ip: string,
  ) {
    return this.stockRequests.cancel(id, dto.reason, user, ip);
  }

  @Patch(':id/payment')
  @ApiOperation({
    summary:
      'Update payment details of a stock request by its ID (Super Admin).',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  updatePayment(
    @Param('id') id: string,
    @Body() dto: UpdateStockRequestPaymentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.stockRequests.updatePayments(id, dto, user);
  }
}
