import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { FranchiseDashboardQueryDto } from './dto/franchise-dashboard-query.dto';
import { FranchiseDashboardResponseDto } from './dto/franchise-dashboard-response.dto';
import { DashboardService } from './dashboard.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Dashboard Metrics')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({
    summary: 'Get unified dashboard metrics based on role and permissions',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  getMetrics(@CurrentUser() user: JwtUser, @Query() query: DashboardQueryDto) {
    console.log(user, '[[[[[[[[[[[[]]]]]]]]]]]]');
    return this.dashboardService.getMetrics(user, query);
  }

  @Get('franchise')
  @ApiOperation({
    summary:
      'Get dedicated franchise dashboard metrics scoped to logged-in franchise',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.SUPERADMIN)
  getFranchiseMetrics(
    @CurrentUser() user: JwtUser,
    @Query() query: FranchiseDashboardQueryDto,
  ): Promise<FranchiseDashboardResponseDto> {
    return this.dashboardService.getFranchiseMetrics(user, query);
  }
}
