import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { CreatePayoutDto } from './dto/payout-create.dto';
import { CreatePayoutRequestDto } from './dto/payout-request.dto';
import { PayoutQueryDto } from './dto/payout-query.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PayoutApproveDto } from './dto/payout-approve.dto';
import { PayoutRejectDto } from './dto/payout-reject.dto';

@ApiTags('Payout <- SuperAdmin, Franchise')
@ApiBearerAuth('access-token')
@Controller('payout')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Post('request')
  @ApiOperation({ summary: 'Request a payout (Franchise Owner / Staff)' })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  createPayoutRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePayoutRequestDto,
    @Ip() ip: string,
  ) {
    return this.payoutService.createPayoutRequest(user, dto, ip);
  }

  @Post('create')
  @ApiOperation({
    summary: 'Create a direct payout for a franchise (SuperAdmin)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  createPayout(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePayoutDto,
    @Ip() ip: string,
  ) {
    return this.payoutService.createPayout(dto, user.sub, ip);
  }

  @Post('approve/:id')
  @ApiOperation({ summary: 'Approve a payout request (SuperAdmin)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  approvePayout(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: PayoutApproveDto,
    @Ip() ip: string,
  ) {
    return this.payoutService.approvePayout(id, user.sub, dto.referenceId, ip);
  }

  @Post('reject/:id')
  @ApiOperation({ summary: 'Reject a payout request (SuperAdmin)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  rejectPayout(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: PayoutRejectDto,
    @Ip() ip: string,
  ) {
    return this.payoutService.rejectPayout(id, user.sub, dto.reason, ip);
  }

  @Get('my-payouts')
  @ApiOperation({ summary: 'Get payouts for the logged-in franchise owner' })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  getMyPayouts(@CurrentUser() user: JwtUser, @Query() query: PayoutQueryDto) {
    return this.payoutService.getPayoutsForUser(user, query);
  }

  @Get('admin-payouts')
  @ApiOperation({ summary: 'Get all payouts (SuperAdmin)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  getAdminPayouts(@Query() query: PayoutQueryDto) {
    return this.payoutService.getPayoutsForAdmin(query);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Get all payouts summary and list' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  getPayouts(@CurrentUser() user: JwtUser) {
    return this.payoutService.getPayouts(user);
  }
}
