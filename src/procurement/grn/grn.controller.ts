import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateGrnDto } from './dto/create-grn.dto';
import { GrnQueryDto } from './dto/grn-query.dto';
import { GrnService } from './grn.service';
import { PostGrnDto } from './dto/post-grn.dto';
import { UpdateGrnStatusDto } from './dto/update-grn-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtUser } from '../../auth/types/jwt-user.type';

@ApiTags('Procurement GRN')
@ApiBearerAuth('access-token')
@Controller('procurement/grn')
export class GrnController {
  constructor(private readonly grnService: GrnService) { }

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  create(@Body() dto: CreateGrnDto, @CurrentUser() user: JwtUser,) {
    return this.grnService.create(dto, user);
  }

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'List Goods Receipt Notes (GRN) with filters, search, sorting, and pagination',
  })
  list(@Query() query: GrnQueryDto) {
    return this.grnService.list(query);
  }


  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  get(@Param('id') id: string) {
    return this.grnService.get(id);
  }

  @Patch(':id/post')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  post(
    @Param('id') id: string,
    @Body() dto: PostGrnDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.grnService.post(id, dto, user.sub);
  }

  @Patch(':id/status')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGrnStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.grnService.updateStatus(id, dto.status, user.sub);
  }
}


