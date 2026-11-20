import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { CreateFranchiseNoticeDto } from './dto/create-franchise-notice.dto';
import { FranchiseNoticesService } from './franchise-notices.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  FranchiseNoticeQueryDto,
  NoticeQueryDto,
} from './dto/franchise-notice-query.dto';

@ApiTags('Franchise Notices <- Superadmin / Franchise Users')
@ApiBearerAuth('access-token')
@Controller('franchise-notices')
export class FranchiseNoticesController {
  constructor(private readonly notices: FranchiseNoticesService) {}

  @Get('inbox')
  @ApiOperation({ summary: 'List notices for current Franchise user' })
  @Roles(
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
    Role.ADMIN_STAFF,
  )
  inbox(@CurrentUser() user: JwtUser, @Query() query: FranchiseNoticeQueryDto) {
    return this.notices.list({
      ...query,
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : user.role === Role.FRANCHISE_STAFF
          ? { franchiseId: user.franchiseOwnerId }
          : {}),
      includeGlobal: true,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all notices (Superadmin)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  listAdmin(@Query() query: NoticeQueryDto) {
    return this.notices.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create notice for a Franchise (Superadmin)' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  create(
    @Body() dto: CreateFranchiseNoticeDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.notices.create(dto, user, ip);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notice as read (Franchise user)' })
  @Roles(
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
    Role.ADMIN_STAFF,
  )
  read(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.notices.markRead(id, user);
  }
}
