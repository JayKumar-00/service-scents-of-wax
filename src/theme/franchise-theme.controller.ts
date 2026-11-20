import { Controller, Get, Param } from '@nestjs/common';
import { AdminThemeService } from './admin-theme/admin-theme.service';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { PanelType } from '@prisma/client';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Theme <- Franchise Owner/Staff')
@Controller('franchise-theme')
@Public()
export class FranchiseThemeController {
  constructor(private readonly themeService: AdminThemeService) {}

  @Get()
  @ApiOperation({ summary: 'Get theme by panel type' })
  async getTheme() {
    return this.themeService.getByPanelType(PanelType.FRANCHISE);
  }
}
