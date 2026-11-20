import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Ip,
} from '@nestjs/common';
import { AdminThemeService } from './admin-theme.service';
import { UpdateThemeDto } from '../dto/update-theme.dto';
import { PanelType, Role } from '@prisma/client';
import { ThemeQueryDto } from '../dto/theme-query.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('Themes <- Super Admin, Admin Staff')
@ApiBearerAuth('access-token')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
@Controller('admin-theme')
export class AdminThemeController {
  constructor(private readonly adminThemeService: AdminThemeService) { }

  @Get()
  @ApiOperation({ summary: 'List themes with optional filters' })
  list(@Query() query: ThemeQueryDto) {
    return this.adminThemeService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get theme details by ID' })
  getById(@Param('id') id: string) {
    return this.adminThemeService.getById(id);
  }

  @Patch(':panelType')
  @ApiOperation({ summary: 'Upsert theme by panel type' })
  @ApiParam({ name: 'panelType', enum: PanelType })
  async upsertTheme(
    @CurrentUser() user: JwtUser,
    @Param('panelType') panelType: PanelType,
    @Body() updateThemeDto: UpdateThemeDto,
    @Ip() ip: string,
  ) {
    return this.adminThemeService.upsertByPanelType(user, panelType, updateThemeDto, ip);
  }

  @Delete(':panelType')
  @ApiOperation({ summary: 'Reset theme to default seed by panel type' })
  @ApiParam({ name: 'panelType', enum: PanelType })
  async resetTheme(
    @CurrentUser() user: JwtUser,
    @Param('panelType') panelType: PanelType,
    @Ip() ip: string
  ) {
    return this.adminThemeService.resetToDefault(user, panelType, ip);
  }
}
