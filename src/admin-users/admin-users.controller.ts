import { Body, Controller, Get, Ip, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { AdminUserQueryDto } from './dto/admin-user.query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';

@ApiTags('Users <- SuperAdmin')
@ApiBearerAuth('access-token')
// @PermissionModule(SuperAdminModuleEnum.ADMIN_FRANCHISE)
@Controller('admin/users')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: AdminUserQueryDto) {
    return this.users.list(query);
  }

  @Post()
  invite(
    @Body() dto: InviteUserDto,
    @CurrentUser() actor?: JwtUser,
    @Ip() ip?: string,
  ) {
    return this.users.invite(dto, actor, ip);
  }
}
