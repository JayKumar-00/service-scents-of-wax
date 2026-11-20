import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Ip,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StarterBundlesService } from './starter-bundles.service';
import { BundleProvisionService } from './bundle-provision.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStarterBundleDto } from './dto/create-bundle.dto';
import { UpdateStarterBundleDto } from './dto/update-bundle.dto';
import { BundleItemDto, AddBundleItemsDto } from './dto/add-items.dto';
import { StarterBundleQueryDto } from './dto/starter-bundle.query.dto';
import { AssignBundleDto } from './dto/assign-bundle.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PermissionModule } from 'src/common/decorators/permission-module.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { Role, StarterBundleStatus, BundleAssignmentStatus } from '@prisma/client';
import { SuperAdminModuleEnum } from 'src/staff-management/enums/module-name.enum';

@ApiTags('Starter Bundles')
@ApiBearerAuth('access-token')
@PermissionModule(SuperAdminModuleEnum.STARTER_BUNDLES)
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
@Controller()
export class StarterBundlesController {
  constructor(
    private readonly starterBundlesService: StarterBundlesService,
    private readonly provisionService: BundleProvisionService,
    private readonly prisma: PrismaService,
  ) { }

  @ApiOperation({ summary: 'Create a new starter bundle' })
  @Post('starter-bundles')
  create(
    @Body() dto: CreateStarterBundleDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.starterBundlesService.create(dto, user.sub, ip);
  }

  @ApiOperation({ summary: 'Update an existing starter bundle' })
  @Patch('starter-bundles/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStarterBundleDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.starterBundlesService.update(id, dto, user.sub, ip);
  }

  @ApiOperation({ summary: 'List all starter bundles' })
  @Get('starter-bundles')
  findAll(@Query() query: StarterBundleQueryDto) {
    return this.starterBundlesService.findAll(query);
  }

  @ApiOperation({ summary: 'Get details of a starter bundle' })
  @Get('starter-bundles/:id')
  findOne(@Param('id') id: string) {
    return this.starterBundlesService.findOne(id);
  }

  @ApiOperation({ summary: 'Delete a starter bundle' })
  @Delete('starter-bundles/:id')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.starterBundlesService.delete(id, user.sub, ip);
  }

  @ApiOperation({ summary: 'Add items to a starter bundle' })
  @Post('starter-bundles/:id/items')
  addItems(
    @Param('id') id: string,
    @Body() dto: AddBundleItemsDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.starterBundlesService.addItems(id, dto.items, user.sub, ip);
  }

  @ApiOperation({ summary: 'Replace items of a starter bundle' })
  @Post('starter-bundles/:id/items/replace')
  replaceItems(
    @Param('id') id: string,
    @Body() dto: AddBundleItemsDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.starterBundlesService.replaceItems(id, dto.items, user.sub, ip);
  }

  @ApiOperation({ summary: 'Remove an item from a starter bundle' })
  @Delete('starter-bundles/:id/items/:itemId')
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.starterBundlesService.removeItem(id, itemId, user.sub, ip);
  }

  @ApiOperation({ summary: 'Retry bundle provisioning for a franchise - initial-inventory ' })
  @Post('franchises/:id/provision-bundle')
  @HttpCode(HttpStatus.OK)
  async retryProvision(
    @Param('id') franchiseId: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
    });
    if (!franchise) {
      throw new NotFoundException('Franchise not found.');
    }

    // Look for existing assignment
    let assignment = await this.prisma.franchiseBundleAssignment.findFirst({
      where: { franchiseId },
    });

    if (!assignment) {
      // Find default starter bundle to assign
      const defaultBundle = await this.prisma.starterBundle.findFirst({
        where: { isDefault: true, status: StarterBundleStatus.ACTIVE },
      });
      if (!defaultBundle) {
        throw new BadRequestException('No default active bundle found to provision.');
      }
      assignment = await this.prisma.franchiseBundleAssignment.create({
        data: {
          franchiseId,
          bundleId: defaultBundle.id,
          status: BundleAssignmentStatus.PENDING,
        },
      });
    }

    // Call provision service directly (retry is idempotent)
    await this.provisionService.provisionBundle(assignment.id, user.sub, ip);

    // Fetch the updated assignment
    const updated = await this.prisma.franchiseBundleAssignment.findUnique({
      where: { id: assignment.id },
      include: {
        bundle: true,
      },
    });

    if (updated?.status === BundleAssignmentStatus.FAILED) {
      throw new BadRequestException(
        updated.failureReason || 'Bundle provisioning failed due to central warehouse stock shortfall.',
      );
    }

    return updated;
  }

  @ApiOperation({ summary: 'Assign starter bundle to a franchise' })
  @Post('starter-bundles/:id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignBundleDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.starterBundlesService.assignBundle(id, dto.franchiseId, user.sub, ip, dto.method);
  }

  @ApiOperation({ summary: 'Get all franchise assignments of a starter bundle' })
  @Get('starter-bundles/:id/assignments')
  getAssignments(@Param('id') id: string) {
    return this.starterBundlesService.getAssignments(id);
  }

  @ApiOperation({ summary: 'Get all starter bundle assignments of a franchise' })
  @Get('franchises/:id/bundles')
  getFranchiseBundles(@Param('id') id: string) {
    return this.starterBundlesService.getFranchiseBundles(id);
  }

  @ApiOperation({ summary: 'Get details of initial inventory provisioning for a franchise' })
  @Get('franchises/:id/initial-inventory')
  getFranchiseInitialInventory(@Param('id') id: string) {
    return this.starterBundlesService.getFranchiseInitialInventory(id);
  }
}
