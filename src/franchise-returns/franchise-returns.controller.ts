import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { CreateFranchiseReturnDto } from './dto/create-franchise-return.dto';
import { UpdateFranchiseReturnDto } from './dto/update-franchise-return.dto';
import { FranchiseReturnsService } from './franchise-returns.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FranchiseReturnQueryDto } from './dto/franchise-return-query.dto';

@ApiTags(
  'Franchise Returns <- SuperAdmin, Franchise Owner, Franchise Staff, Franchise Auditor',
)
@ApiBearerAuth('access-token')
@Controller('franchise-returns')
export class FranchiseReturnsController {
  // constructor(private readonly returns: FranchiseReturnsService) {}
  // @Get()
  // @ApiOperation({ summary: 'List Franchise Returns' })
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_STAFF,
  //   Role.FRANCHISE_AUDITOR,
  // )
  // list(@CurrentUser() user: JwtUser, @Query() query: FranchiseReturnQueryDto) {
  //   return this.returns.list(user, query);
  // }
  // @Post()
  // @ApiOperation({ summary: 'Create Franchise Return' })
  // @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  // create(
  //   @Body() dto: CreateFranchiseReturnDto,
  //   @CurrentUser() user: JwtUser,
  //   @Ip() ip: string,
  // ) {
  //   return this.returns.create(dto, user, { userId: user.sub, ip });
  // }
  // @Patch(':id')
  // @ApiOperation({ summary: 'Update Franchise Return (SuperAdmin)' })
  // @Roles(Role.SUPERADMIN)
  // update(
  //   @Param('id') id: string,
  //   @Body() dto: UpdateFranchiseReturnDto,
  //   @CurrentUser() user: JwtUser,
  //   @Ip() ip: string,
  // ) {
  //   return this.returns.update(id, dto, { userId: user.sub, ip });
  // }
}
