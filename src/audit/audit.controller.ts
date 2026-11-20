import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditQueryDto, FranchiseAuditQueryDto } from './dto/audit-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get all audit logs (SuperAdmin, Admin Staff)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  logs(@Query() query: AuditQueryDto, @CurrentUser() user: JwtUser) {
    return this.audit.list(query, user);
  }

  @Get('franchise/logs')
  @ApiOperation({
    summary: 'Get franchise audit logs (Franchise Owner, Franchise Staff))',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  franchiseLogs(
    @Query() query: FranchiseAuditQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.audit.list(query, user);
  }
}
