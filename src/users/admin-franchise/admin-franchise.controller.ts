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
import { Franchise, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { AdminFranchiseService } from './admin-franchise.service';
import { AdminFranchiseQueryDto } from './dto/admin-franchise.query.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FranchiseStatusDto } from './dto/status.dto';
import {
  IMeta,
  ISuccessResponse,
} from 'src/common/interceptors/envelope.interface';
import { CreateFranchiseDto } from './dto/create-franchise.dto';
import { UpdateFranchiseDto } from './dto/update-franchise.dto';

@ApiTags('Franchise Management <- Admin')
@Roles(Role.ADMIN_STAFF, Role.SUPERADMIN)
@ApiBearerAuth('access-token')
@Controller('admin-franchise')
export class AdminFranchiseController {
  constructor(private readonly adminFranchiseService: AdminFranchiseService) {}

  @Post('create-franchise')
  @ApiOperation({
    summary: 'To create a new franchise.',
  })
  create(
    @Body() dto: CreateFranchiseDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.adminFranchiseService.create(dto, user.sub, ip);
  }

  @Get('all-franchises')
  @ApiOperation({
    summary: 'Get a list of all franchises.',
  })
  list(
    @Query() query: AdminFranchiseQueryDto,
  ): Promise<ISuccessResponse<Franchise[], IMeta>> {
    return this.adminFranchiseService.list(query);
  }

  @Patch('status/:franchiseId')
  @ApiOperation({
    summary: 'To approve or reject a franchise.',
  })
  updateStatus(
    @Param('franchiseId') franchiseId: string,
    @Body() dto: FranchiseStatusDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.adminFranchiseService.updateStatus(
      franchiseId,
      dto.status,
      user.sub,
      ip,
    );
  }

  @Patch('badge/remove/:franchiseId')
  @ApiOperation({
    summary: 'To remove a badge from a franchise.',
  })
  removeBadge(
    @Param('franchiseId') franchiseId: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.adminFranchiseService.removeBadge(franchiseId, user.sub, ip);
  }

  @Patch('badge/:franchiseId')
  @ApiOperation({
    summary: 'To update or assign a badge to a franchise.',
  })
  updateBadge(
    @Param('franchiseId') franchiseId: string,
    @Body('badge') badge: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.adminFranchiseService.updateBadge(
      franchiseId,
      badge,
      user.sub,
      ip,
    );
  }

  @Delete('delete-all')
  @ApiOperation({
    summary: 'Delete all franchise records (Be carefully)',
  })
  deleteAll() {
    return this.adminFranchiseService.deleteAll();
  }

  @Get(':franchiseId')
  @ApiOperation({
    summary: 'To get details of a specific franchise by its ID.',
  })
  getOne(@Param('franchiseId') franchiseId: string) {
    return this.adminFranchiseService.findOne(franchiseId);
  }

  @Patch(':franchiseId')
  @ApiOperation({
    summary: 'To update details of a specific franchise.',
  })
  update(
    @Param('franchiseId') franchiseId: string,
    @Body() dto: UpdateFranchiseDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.adminFranchiseService.update(franchiseId, dto, user.sub, ip);
  }

  @Delete('hard/:franchiseId')
  @ApiOperation({
    summary: 'Hard delete a franchise and all related data (irreversible).',
  })
  hardDelete(@Param('franchiseId') franchiseId: string) {
    return this.adminFranchiseService.hardDelete(franchiseId);
  }
}
