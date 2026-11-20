import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { BannerQueryDto } from './dto/banner-query.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { BannerService } from './banner.service';
import { PermissionModule } from 'src/common/decorators/permission-module.decorator';
import { SuperAdminModuleEnum } from 'src/staff-management/enums/module-name.enum';

@ApiTags('Banners <- SuperAdmin')
@ApiBearerAuth('access-token')
@Controller('banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'List active/scheduled banners for public UI' })
  findPublic(@Query() query: BannerQueryDto) {
    return this.bannerService.findPublic(query);
  }

  @Public()
  @Post(':id/impression')
  @ApiOperation({ summary: 'Track a banner impression' })
  trackImpression(@Param('id') id: string) {
    return this.bannerService.trackImpression(id);
  }

  @Public()
  @Post(':id/click')
  @ApiOperation({ summary: 'Track a banner click' })
  trackClick(@Param('id') id: string) {
    return this.bannerService.trackClick(id);
  }

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.BANNERS)
  @ApiOperation({ summary: 'Create a banner' })
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateBannerDto,
    @Ip() ip: string,
  ) {
    return this.bannerService.create(user, dto, ip);
  }

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.BANNERS)
  @ApiOperation({ summary: 'List banners (admin)' })
  findAll(@Query() query: BannerQueryDto) {
    return this.bannerService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get banner by id (admin)' })
  findOne(@Param('id') id: string) {
    return this.bannerService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.BANNERS)
  @ApiOperation({ summary: 'Update a banner' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @Ip() ip: string,
  ) {
    return this.bannerService.update(user, id, dto, ip);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.BANNERS)
  @ApiOperation({ summary: 'Delete a banner' })
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.bannerService.remove(user, id, ip);
  }
}
