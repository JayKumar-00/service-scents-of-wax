import { Controller, Get, Post, Param, Query, ForbiddenException, Ip } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { SettlementQueryDto } from './dto/settlement-query.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Settlement <- SuperAdmin, Franchise, Affiliate')
@ApiBearerAuth('access-token')
@Controller('settlement')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get('admin-settlements')
  @ApiOperation({ summary: 'Get all settlements (SuperAdmin / AdminStaff / FranchiseAuditor)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_AUDITOR)
  getAdminSettlements(@Query() query: SettlementQueryDto) {
    return this.settlementService.getSettlementsForAdmin(query);
  }

  @Post('admin/settle/:orderNumber')
  @ApiOperation({ summary: 'Manually settle an order immediately (SuperAdmin / AdminStaff)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  manuallySettleOrder(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.settlementService.manuallySettleOrder(orderNumber, user, ip);
  }

  @Get('my-settlements')
  @ApiOperation({ summary: 'Get settlements for the logged-in franchise owner / staff' })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  getMySettlements(@CurrentUser() user: JwtUser, @Query() query: SettlementQueryDto) {
    const franchiseId = user.franchiseId ?? user.franchiseOwnerId;
    if (!franchiseId) {
      throw new ForbiddenException('User is not associated with any franchise');
    }
    return this.settlementService.getSettlementsForFranchise(franchiseId, query);
  }

  @Get('my-affiliate-settlements')
  @ApiOperation({ summary: 'Get settlements for the logged-in affiliate / customer' })
  @Roles(Role.AFFILIATE, Role.CUSTOMER)
  getMyAffiliateSettlements(@CurrentUser() user: JwtUser, @Query() query: SettlementQueryDto) {
    if (!user.customerId) {
      throw new ForbiddenException('User is not associated with a customer account');
    }
    return this.settlementService.getSettlementsForAffiliate(user.customerId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get settlement by ID' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.AFFILIATE,
    Role.CUSTOMER,
  )
  getSettlementById(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.settlementService.getSettlementById(id, user);
  }
}
