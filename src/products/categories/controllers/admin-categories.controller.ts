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
import { Role } from '@prisma/client';
import { CategoriesService, CategoryTreeNode } from '../categories.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { CategoryQueryDto } from '../dto/category-query.dto';
import {
  IMeta,
  ISuccessResponse,
} from 'src/common/interceptors/envelope.interface';
import { IFlatCategory } from '../interfaces/category-list.interface';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('Categories <- Admin')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
@ApiBearerAuth('access-token')
@Controller('admin-categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get('categories/tree')
  @ApiOperation({ summary: 'Get category tree' })
  categoryTree(
    @Query() query: CategoryQueryDto,
  ): Promise<ISuccessResponse<CategoryTreeNode[], IMeta>> {
    return this.categories.categoryTree(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all categories as flat' })
  list(
    @Query() query: CategoryQueryDto,
  ): Promise<ISuccessResponse<IFlatCategory[], IMeta>> {
    return this.categories.categoriesFlat(query);
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'To get base category by id' })
  getCategoryById(@Param('slug') sl: string) {
    return this.categories.getCategoryBySlug(sl);
  }

  @Post('categories')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a category' })
  @ApiBody({ type: CreateCategoryDto })
  createCategory(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCategoryDto,
    @Ip() ip: string,
  ) {
    return this.categories.createCategory(user, dto as any, ip);
  }

  @Patch('categories/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a category' })
  @ApiBody({ type: UpdateCategoryDto })
  updateCategory(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Ip() ip: string,
  ) {
    return this.categories.updateCategory(user, id, dto as any, ip);
  }

  @Delete('categories/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a category' })
  deleteCategory(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.categories.deleteCategory(user, id, ip);
  }
}
