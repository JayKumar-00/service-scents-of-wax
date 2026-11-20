import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  Put,
  ForbiddenException,
} from '@nestjs/common';
import { CreditService } from './credit.service';
import { ApplyCreditDto } from './dto/apply-credit.dto';
import { CreditPaymentDto } from './dto/credit-payment.dto';
import { CreditStatusDto } from './dto/credit-status.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreditSummaryQueryDto } from './dto/credit-summary-query.dto';
import { CreditTransactionQueryDto } from './dto/credit-transaction-query.dto';
import { AdjustCreditLimitDto } from './dto/adjust-credit.dto';

@ApiTags('Credit <- SuperAdmin, Franchise')
@ApiBearerAuth('access-token')
@Controller('credit')
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Apply for credit (SuperAdmin)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  apply(
    @Body() dto: ApplyCreditDto,
    @CurrentUser() user?: JwtUser,
    @Ip() ip?: string,
  ) {
    return this.creditService.applyCredit(dto, user?.sub, ip);
  }

  @Post('adjust-limit')
  @ApiOperation({
    summary:
      'To adjust the credit limit of a franchise as well transfer credit to franchise (SuperAdmin)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  adjustCreditLimit(
    @Body() dto: AdjustCreditLimitDto,
    @CurrentUser() user?: JwtUser,
    @Ip() ip?: string,
  ) {
    return this.creditService.adjustCreditLimit(dto, user?.sub, ip);
  }

  @Post('payment/:franchiseId')
  @ApiOperation({
    summary: 'To clear out the credit dues by making payment (SuperAdmin)',
  })
  @Roles(
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
  )
  payment(
    @CurrentUser() user: JwtUser,
    @Param('franchiseId') franchiseId: string,
    @Body() dto: CreditPaymentDto,
    @Ip() ip?: string,
  ) {
    const userFranchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (
      user.role !== Role.SUPERADMIN &&
      user.role !== Role.ADMIN_STAFF &&
      userFranchiseId !== franchiseId
    ) {
      throw new ForbiddenException('Unauthorized');
    }

    return this.creditService.recordPayment(franchiseId, dto, user.sub, ip);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get credit summary for a franchise (SuperAdmin, Franchise Owner)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.ADMIN_STAFF,
  )
  summary(@CurrentUser() user: JwtUser, @Query() query: CreditSummaryQueryDto) {
    return this.creditService.getSummary({
      ...query,
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : user.role === Role.FRANCHISE_STAFF
          ? { franchiseId: user.franchiseOwnerId }
          : {}),
    });
  }

  @Get('transactions')
  @ApiOperation({
    summary:
      'Get credit transactions for a franchise (SuperAdmin, Franchise Owner)',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.ADMIN_STAFF,
  )
  getTransactions(
    @CurrentUser() user: JwtUser,
    @Query() query: CreditTransactionQueryDto,
  ) {
    return this.creditService.getTransactions({
      ...query,
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : user.role === Role.FRANCHISE_STAFF
          ? { franchiseId: user.franchiseOwnerId }
          : {}),
    });
  }

  @Post('status/:franchiseId')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  setStatus(
    @Param('franchiseId') franchiseId: string,
    @Body() dto: CreditStatusDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip?: string,
  ) {
    return this.creditService.setStatus(franchiseId, user.sub, dto, ip);
  }

  // ====== AUTOMATION CONTROLS (SuperAdmin only) ======

  @Get('automation/:franchiseId')
  @ApiOperation({
    summary: 'Get automation status for a franchise (SuperAdmin)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  getAutomationStatus(@Param('franchiseId') franchiseId: string) {
    return this.creditService.getAutomationStatus(franchiseId);
  }

  @Put('automation/:franchiseId')
  @ApiOperation({
    summary:
      'Update automation settings for a franchise - enable/disable penalties, reminders, auto-refill (SuperAdmin)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  updateAutomation(
    @CurrentUser() user: JwtUser,
    @Param('franchiseId') franchiseId: string,
    @Body() dto: UpdateAutomationDto,
    @Ip() ip: string,
  ) {
    return this.creditService.updateAutomation(user, franchiseId, dto, ip);
  }

  @Post('automation/:franchiseId/pause')
  @ApiOperation({
    summary:
      'Pause all automation for a franchise until specified date (SuperAdmin)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  pauseAutomation(
    @CurrentUser() user: JwtUser,
    @Param('franchiseId') franchiseId: string,
    @Body('pauseUntil') pauseUntil: string,
    @Ip() ip: string,
  ) {
    return this.creditService.pauseAutomation(
      user,
      franchiseId,
      new Date(pauseUntil),
      ip,
    );
  }

  @Post('automation/:franchiseId/resume')
  @ApiOperation({
    summary: 'Resume automation for a franchise (SuperAdmin)',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  resumeAutomation(
    @CurrentUser() user: JwtUser,
    @Param('franchiseId') franchiseId: string,
    @Ip() ip: string,
  ) {
    return this.creditService.resumeAutomation(user, franchiseId, ip);
  }
}
