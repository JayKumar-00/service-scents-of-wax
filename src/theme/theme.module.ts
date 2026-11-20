import { Module } from '@nestjs/common';
import { AdminThemeService } from './admin-theme/admin-theme.service';
import { AdminThemeController } from './admin-theme/admin-theme.controller';
import { FranchiseThemeController } from './franchise-theme.controller';
import { ThemeController } from './web/theme.controller';
import { WebThemeService } from './web/web-theme.service';

@Module({
  providers: [AdminThemeService, WebThemeService],
  controllers: [
    AdminThemeController,
    FranchiseThemeController,
    ThemeController,
  ],
})
export class ThemeModule {}
