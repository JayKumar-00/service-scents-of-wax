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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Brand, Role } from '@prisma/client';
import { BrandsService } from '../brands.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { BrandQueryDto } from '../dto/brand-query.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('Brands <- Admin')
@ApiBearerAuth('access-token')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
@Controller('admin-brands')
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Post()
  @ApiBody({ type: CreateBrandDto })
  @ApiOperation({ summary: 'Create brand' })
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateBrandDto,
    @Ip() ip: string,
  ): Promise<Brand> {
    return this.brands.create(user, dto, ip);
  }

  @Get('brands')
  @ApiOperation({ summary: 'List brands (admin)' })
  list(@Query() query: BrandQueryDto) {
    return this.brands.list(query);
  }

  @Get('brands/:id')
  @ApiOperation({ summary: 'Get brand by id' })
  getById(@Param('id') id: string) {
    return this.brands.findById(id);
  }

  @Patch('brands/:id')
  @ApiBody({ type: UpdateBrandDto })
  @ApiOperation({ summary: 'Update brand' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @Ip() ip: string,
  ) {
    return this.brands.update(user, id, dto as any, ip);
  }

  @Delete('brands/:id')
  @ApiOperation({ summary: 'Delete brand' })
  delete(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.brands.delete(user, id, ip);
  }
}
