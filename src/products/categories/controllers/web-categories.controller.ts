import { Controller, Get, Query } from '@nestjs/common';
import { CategoriesService, CategoryTreeNode } from '../categories.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoryQueryDto } from '../dto/category-query.dto';
import {
  IMeta,
  ISuccessResponse,
} from 'src/common/interceptors/envelope.interface';
import { IFlatCategory } from '../interfaces/category-list.interface';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Categories <- Web (Public)')
@Public()
@Controller('web-categories')
export class WebCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get('categories/tree')
  @ApiOperation({ summary: 'Get category tree' })
  categoryTree(
    @Query() query: CategoryQueryDto,
  ): Promise<ISuccessResponse<CategoryTreeNode[], IMeta>> {
    return this.categories.categoryTree(query);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List all categories as flat' })
  list(
    @Query() query: CategoryQueryDto,
  ): Promise<ISuccessResponse<IFlatCategory[], IMeta>> {
    return this.categories.categoriesFlat(query);
  }
}
