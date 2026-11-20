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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AdminStaffQueryDto, StaffQueryDto } from './dto/staff-query.dto';
import {
  UpdateAdminStaffProfileDto,
  UpdateFranchiseStaffProfileDto,
  UpdateStaffDto,
} from './dto/update-staff.dto';
import { StaffManagementService } from './staff-management.service';
import { PermissionModule } from 'src/common/decorators/permission-module.decorator';
import { FranchiseOwnerModuleEnum } from './enums/module-name.enum';

@ApiTags('RBAC <- Staff Management')
@ApiBearerAuth('access-token')
@Controller()
export class StaffManagementController {
  constructor(private readonly staff: StaffManagementService) { }

  @Get('admin/staff')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'List all staff with filters' })
  listAdminStaff(
    @CurrentUser() user: JwtUser,
    @Query() query: AdminStaffQueryDto,
  ) {
    return this.staff.listAdminStaff(user, query);
  }

  @Get('franchise/staff')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'List staff for the current franchise owner' })
  listFranchiseStaff(
    @CurrentUser() user: JwtUser,
    @Query() query: StaffQueryDto,
  ) {
    return this.staff.listFranchiseStaff(user, query);
  }

  @Post('admin/staff')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Create staff for a superadmin scope' })
  @ApiCreatedResponse({ description: 'Staff member created' })
  createAdminStaff(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateStaffDto,
    @Ip() ip: string) {
    return this.staff.createAdminStaff(user, dto, ip);
  }

  @Post('franchise/staff')
  @PermissionModule(FranchiseOwnerModuleEnum.STAFF_MANAGEMENT)
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Create staff for the current franchise owner' })
  @ApiCreatedResponse({ description: 'Staff member created' })
  createFranchiseStaff(
    @Body() dto: CreateStaffDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.staff.createFranchiseStaff(user, dto, ip);
  }

  @Patch('admin/staff/:id')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Update a superadmin staff member' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Staff member updated' })
  updateAdminStaff(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.staff.updateAdminStaff(user, id, dto, ip);
  }

  @Delete('admin/staff/:id')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Delete a superadmin staff member' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Staff member deleted' })
  deleteAdminStaff(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.staff.deleteAdminStaff(user, id, ip);
  }

  @Patch('franchise/staff/:id')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Update a franchise staff member' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Staff member updated' })
  updateFranchiseStaff(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.staff.updateFranchiseStaff(user, id, dto, ip);
  }

  @Patch('franchise/staff/:id/toggle-status')
  @PermissionModule(FranchiseOwnerModuleEnum.STAFF_MANAGEMENT)
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({
    summary: 'Toggle status (active/inactive) of a franchise staff member',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Staff member status toggled' })
  toggleFranchiseStaffStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.staff.toggleFranchiseStaffStatus(user, id, ip);
  }

  @Patch('admin/staff/:id/toggle-status')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Toggle status (active/inactive) of a admin staff member',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Staff member status toggled' })
  toggleAdminStaffStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.staff.toggleAdminStaffStatus(user, id, ip);
  }

  @Delete('franchise/staff/:id')
  @PermissionModule(FranchiseOwnerModuleEnum.STAFF_MANAGEMENT)
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Delete a franchise staff member' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Staff member deleted' })
  deleteFranchiseStaff(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.staff.deleteFranchiseStaff(user, id, ip);
  }

  @Patch('admin/staff/:id/profile')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Upsert admin staff profile (create or update)' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Admin staff profile upserted' })
  upsertAdminStaffProfile(
    @Param('id') id: string,
    @Body() dto: UpdateAdminStaffProfileDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.staff.upsertAdminStaffProfile(user, id, dto, ip);
  }

  @Patch('franchise/staff/:id/profile')
  // @PermissionModule(FranchiseOwnerModuleEnum.STAFF_MANAGEMENT)
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Upsert franchise staff profile documents' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Franchise staff profile upserted' })
  upsertFranchiseStaffProfile(
    @Param('id') id: string,
    @Body() dto: UpdateFranchiseStaffProfileDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.staff.upsertFranchiseStaffProfile(user, id, dto, ip);
  }
}
