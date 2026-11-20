import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { ProcurementDashboardService } from './dashboard/dashboard.service';

@ApiTags('Procurement')
@ApiBearerAuth('access-token')
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly dashboardService: ProcurementDashboardService) {}

  @Get('dashboard/summary')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  getDashboardSummary() {
    return this.dashboardService.getSummary();
  }
}
