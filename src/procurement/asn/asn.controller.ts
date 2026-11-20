import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateAsnDto } from './dto/create-asn.dto';
import { AsnQueryDto } from './dto/asn-query.dto';
import { SubmitAsnDto } from './dto/submit-asn.dto';
import { UpdateAsnStatusDto } from './dto/update-asn-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { AsnService } from './asn.service';

@ApiTags('Procurement ASN')
@ApiBearerAuth('access-token')
@Controller('procurement/asn')
export class AsnController {
  constructor(private readonly asnService: AsnService) { }

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  create(@Body() dto: CreateAsnDto, @CurrentUser() user: JwtUser,) {
    return this.asnService.create(dto, user);
  }

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'List Advance Shipping Notices (ASN) with filters, search, sorting, and pagination',
  })
  list(@Query() query: AsnQueryDto) {
    return this.asnService.list(query);
  }


  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  get(@Param('id') id: string) {
    return this.asnService.get(id);
  }

  @Patch(':id/submit')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Submit Advance Shipping Notice (ASN) with shipping and courier details',
  })
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitAsnDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.asnService.submit(id, dto, user.sub);
  }

  @Patch(':id/status')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Update status of Advance Shipping Notice (ASN)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAsnStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.asnService.updateStatus(id, dto.status, user.sub);
  }
}


