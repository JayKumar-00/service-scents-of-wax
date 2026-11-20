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
  ApiBody,
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { AppRoleService } from './app-role.service';
import { CreateAppRoleDto } from './dto/create-app-role.dto';
import { UpdateAppRoleDto } from './dto/update-app-role.dto';
import { SetAppRoleActiveDto } from './dto/update-app-role.dto';
import { AppRoleQueryDto } from './dto/app-role.query.dto';
import { AssignRolePermissionsDto } from './dto/assign-role-permissions.dto';
import {
  APP_ROLE_MODULE_VALUES,
  AppRoleModuleEnum,
} from 'src/staff-management/enums/module-name.enum';

@ApiTags('RBAC <- Roles')
@ApiBearerAuth('access-token')
@Roles(
  Role.SUPERADMIN,
  Role.FRANCHISE_OWNER,
  Role.ADMIN_STAFF,
  Role.FRANCHISE_STAFF,
)
@Controller('roles')
export class AppRoleController {
  constructor(private readonly appRoles: AppRoleService) {}

  @Post()
  @ApiOperation({ summary: 'Create an AppRole' })
  @ApiOkResponse({ description: 'AppRole created' })
  create(
    @Body() dto: CreateAppRoleDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.appRoles.create(dto, user, ip);
  }

  @Get()
  @ApiOperation({ summary: 'List AppRoles with pagination' })
  list(@Query() query: AppRoleQueryDto, @CurrentUser() user: JwtUser) {
    return this.appRoles.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get AppRole details' })
  get(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.appRoles.getById(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an AppRole and optionally add/update module permissions',
  })
  @ApiBody({
    type: UpdateAppRoleDto,
    description:
      'Provide role fields and optionally permissions[] to add or update module permissions in the same request.',
  })
  @ApiOkResponse({
    description:
      'AppRole updated. Optional permissions are upserted by module.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppRoleDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.appRoles.update(id, dto, user, ip);
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Set AppRole active state' })
  @ApiBody({
    type: SetAppRoleActiveDto,
    description: 'Set isActive using a boolean enum payload.',
  })
  @ApiOkResponse({ description: 'AppRole active state updated' })
  setActive(
    @Param('id') id: string,
    @Body() dto: SetAppRoleActiveDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.appRoles.setActive(id, dto, user, ip);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an AppRole' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.appRoles.remove(id, user, ip);
  }

  @Get('actions/:moduleName')
  @ApiOperation({
    summary: 'Get available permission actions for a module',
  })
  @ApiParam({ name: 'moduleName', enum: APP_ROLE_MODULE_VALUES })
  @ApiOkResponse({ description: 'Controller actions resolved' })
  controllerActions(@Param('moduleName') moduleName: AppRoleModuleEnum) {
    return this.appRoles.getControllerActions(moduleName);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'List permissions assigned to a role' })
  listPermissions(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.appRoles.listPermissions(id, user);
  }

  @Delete(':id/permissions/:moduleName')
  @ApiOperation({
    summary: 'Delete a module permission from a role',
    description:
      'Deletes a module permission matrix from the role. Valid module names depend on the role type: SuperAdmin roles use SuperAdminModuleEnum, while Franchise roles use FranchiseOwnerModuleEnum.',
  })
  @ApiParam({
    name: 'moduleName',
    description: 'The name of the module to remove from the role.',
  })
  @ApiOkResponse({ description: 'Module permission deleted successfully' })
  removePermission(
    @Param('id') id: string,
    @Param('moduleName') moduleName: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.appRoles.removePermission(id, moduleName, user, ip);
  }

  @Post(':id/permissions')
  @ApiOperation({ summary: 'Replace permissions assigned to a role' })
  @ApiOkResponse({ description: 'Role permissions updated' })
  assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignRolePermissionsDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.appRoles.assignPermissions(id, dto, user, ip);
  }
}
