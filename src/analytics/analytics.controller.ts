import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsService } from './analytics.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionModule } from 'src/common/decorators/permission-module.decorator';
import { ModuleName } from 'src/staff-management/enums/module-name.enum';

@ApiTags(
  'Analytics <- Admin, Franchise Owner, Franchise Staff, Franchise Auditor',
)
@ApiBearerAuth('access-token')
@PermissionModule(ModuleName.ANALYTICS)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('superadmin')
  @ApiOperation({ summary: 'Get analytics data for superadmin dashboard' })
  @Roles(Role.SUPERADMIN)
  superadmin(@Query() query: AnalyticsQueryDto) {
    return this.analytics.superadmin({
      from: query.from,
      to: query.to,
      type: query.type ?? 'overview',
    });
  }

  @Get('superadmin/export')
  @ApiOperation({
    summary: 'Export superadmin analytics data as CSV (SuperAdmin)',
  })
  @Roles(Role.SUPERADMIN)
  async superadminExport(@Query() query: AnalyticsQueryDto) {
    const { filename, csv } = await this.analytics.superadminExportCsv({
      from: query.from,
      to: query.to,
    });

    return { filename, csv };
    // res.setHeader('Content-Type', 'text/csv');
    // res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // res.send(csv);
  }

  @Get('franchise')
  @ApiOperation({
    summary:
      'Get analytics data for franchise dashboard  (Franchise Owner, Staff, or Auditor)',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  franchise(@CurrentUser() user: JwtUser, @Query() query: AnalyticsQueryDto) {
    return this.analytics.franchise(user, {
      from: query.from,
      to: query.to,
      period: query.period,
    });
  }

  @Get('ops-queue')
  @ApiOperation({ summary: 'Get analytics data for ops queue (Superadmin)' })
  @Roles(Role.SUPERADMIN)
  opsQueue() {
    return this.analytics.opsQueue();
  }

  @Get('franchise-sla')
  @ApiOperation({
    summary:
      'Get SLA analytics for franchise (Franchise Owner, Staff, or Auditor)',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  franchiseSla(@CurrentUser() user: JwtUser) {
    return this.analytics.franchiseSla(user);
  }
}
