import { Body, Controller, Delete, Get, Ip, Patch } from '@nestjs/common';
import { WebThemeService } from './web-theme.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateWebThemeDto } from '../dto/update-web-theme.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('Theme <- Web')
@Controller('web/theme')
export class ThemeController {
  constructor(private readonly webThemeService: WebThemeService) { }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get the active web theme' })
  async getTheme() {
    return this.webThemeService.getTheme();
  }

  @Patch()
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Update or create the public web theme' })
  async updateTheme(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateWebThemeDto,
    @Ip() ip: string
  ) {
    return this.webThemeService.updateTheme(user, dto, ip);
  }

  @Delete()
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Reset the public web theme to default values' })
  async resetTheme(@CurrentUser() user: JwtUser, @Ip() ip: string) {
    return this.webThemeService.resetToDefault(user, ip);
  }
}
