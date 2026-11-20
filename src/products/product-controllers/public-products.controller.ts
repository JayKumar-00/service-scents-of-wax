import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ProductsService } from '../products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductStatus } from '@prisma/client';

@Public()
@ApiTags('Products <- Web (Franchise Public)')
@Controller('public-products')
export class PublicProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  list(@Query() query: ProductQueryDto) {
    return this.productsService.list({
      ...query,
      visibility: 'true',
      status: ProductStatus.ACTIVE,
    });
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Get product by id' })
  get(@Param('id') id: string) {
    return this.productsService.get(id);
  }
}
