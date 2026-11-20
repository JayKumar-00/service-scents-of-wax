import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AppRoleController } from './app-role.controller';
import { AppRoleService } from './app-role.service';

@Module({
  imports: [DiscoveryModule],
  controllers: [AppRoleController],
  providers: [AppRoleService],
  exports: [AppRoleService],
})
export class AppRoleModule {}
