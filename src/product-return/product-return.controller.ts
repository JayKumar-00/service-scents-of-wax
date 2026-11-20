import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Query,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import {
  ProductReturnCreateDto,
  ReturnRequestRejectDto,
} from './dto/product-return-create.dto';
import {
  ProductReturnFilteredQueryDto,
  ReturnInventoryQueryDto,
} from './dto/product-return-filtered-query.dto';
import { ProductReturnListQueryDto } from './dto/product-return-list-query.dto';
import { ProductReturnService } from './product-return.service';

@ApiTags('Product Return <- > Return, Exchange, Refund')
@ApiBearerAuth('access-token')
@Controller('product-return')
export class ProductReturnController {
  constructor(private readonly productReturns: ProductReturnService) {}

  @Get()
  @ApiOperation({
    summary: 'List returns with pagination, search, and scoped filtering',
  })
  @ApiOkResponse({ description: 'Returns fetched successfully' })
  @Roles(
    Role.FRANCHISE_OWNER,
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  list(
    @Query() query: ProductReturnListQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.productReturns.list(query, user);
  }

  @Get('filtered')
  @ApiOperation({
    summary:
      'List returns filtered by sourceType and franchiseId (no pagination)',
  })
  @ApiOkResponse({ description: 'Returns fetched successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  getFiltered(
    @Query() query: ProductReturnFilteredQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.productReturns.getFiltered(query, user);
  }

  @Get('request/:id')
  @ApiOperation({ summary: 'Get a return request by request id' })
  @ApiOkResponse({ description: 'Return request fetched successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.CUSTOMER,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  getByRequestId(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.productReturns.getByRequestId(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create processed return, exchange, or refund' })
  @ApiCreatedResponse({
    description: 'Return processed successfully',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  create(
    @Body() dto: ProductReturnCreateDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productReturns.create(dto, user, ip);
  }

  @Post('online-request')
  @ApiOperation({ summary: 'Create an online return request from a customer' })
  @ApiCreatedResponse({
    description: 'Online return request created successfully',
  })
  @Roles(Role.CUSTOMER)
  createOnlineRequest(
    @Body() dto: ProductReturnCreateDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productReturns.createOnlineRequest(dto, user, ip);
  }

  @Patch('online-request/:id')
  @ApiOperation({ summary: 'Update a pending online return request' })
  @ApiOkResponse({
    description: 'Online return request updated successfully',
  })
  @Roles(Role.CUSTOMER)
  updateOnlineRequest(
    @Param('id') id: string,
    @Body() dto: ProductReturnCreateDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productReturns.updateOnlineRequest(id, dto, user, ip);
  }

  @Delete('online-request/:id')
  @ApiOperation({ summary: 'Delete a pending online return request' })
  @ApiOkResponse({
    description: 'Online return request deleted successfully',
  })
  @Roles(
    Role.CUSTOMER,
    Role.SUPERADMIN,
    Role.FRANCHISE_OWNER,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_STAFF,
  )
  deleteOnlineRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productReturns.deleteOnlineRequest(id, user, ip);
  }

  @Post('online-request/:id/approve')
  @ApiOperation({
    summary: 'Approve and process a pending online return request',
  })
  @ApiOkResponse({
    description: 'Online return request approved successfully',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  approveOnlineRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productReturns.approveOnlineRequest(id, user, ip);
  }

  @Post('stock-request/:id/approve')
  @ApiOperation({
    summary: 'Approve and process a pending stock request return',
  })
  @ApiOkResponse({
    description: 'Stock request return approved successfully',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  approveStockRequestRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productReturns.approveStockRequestRequest(id, user, ip);
  }

  @Post('stock-request/:id/reject')
  @ApiOperation({
    summary: 'Reject a pending stock request return',
  })
  @ApiBody({ type: ReturnRequestRejectDto })
  @ApiOkResponse({
    description: 'Stock request return rejected successfully',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  rejectStockRequestRequest(
    @Param('id') id: string,
    @Body() dto: ReturnRequestRejectDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productReturns.rejectStockRequestRequest(id, dto, user, ip);
  }

  @Post('online-request/:id/reject')
  @ApiOperation({ summary: 'Reject a pending online return request' })
  @ApiBody({ type: ReturnRequestRejectDto })
  @ApiOkResponse({
    description: 'Online return request rejected successfully',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  rejectOnlineRequest(
    @Param('id') id: string,
    @Body() dto: ReturnRequestRejectDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productReturns.rejectOnlineRequest(id, dto, user, ip);
  }

  @Get('return-inventory')
  @ApiOperation({ summary: 'List return inventory' })
  @ApiOkResponse({ description: 'Return inventory fetched successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  async listReturnInventory(
    @CurrentUser() user: JwtUser,
    @Query() query: ReturnInventoryQueryDto,
  ) {
    return this.productReturns.listReturnInventory({
      ...query,
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : user.role === Role.FRANCHISE_STAFF
          ? { franchiseId: user.franchiseOwnerId }
          : user.adminOwnerId
            ? { customerId: user.customerId }
            : {}),
    });
  }
}
