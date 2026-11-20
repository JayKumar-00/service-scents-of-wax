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
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionsService } from './promotions.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PromotionsQueryDto } from './dto/promotions-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';

@ApiTags('Promotions <- SuperAdmin')
@ApiBearerAuth('access-token')
@Controller('promotions')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) { }

  @Get()
  @ApiOperation({ summary: 'List all promotions' })
  list(@Query() query: PromotionsQueryDto) {
    return this.promotions.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new promotion' })
  create(
    @Body() dto: CreatePromotionDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.promotions.create(user, dto, ip);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing promotion' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
    @Ip() ip: string,
  ) {
    return this.promotions.update(user, id, dto, ip);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a promotion' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.promotions.remove(user, id, ip);
  }
}
