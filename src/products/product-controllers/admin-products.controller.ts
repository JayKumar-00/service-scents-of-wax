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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  UpdateProductDto,
  ProductStatusDto,
  ProductVisibilityDto,
  DeleteBulkProductsDto,
} from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateBrandDto } from '../brands/dto/create-brand.dto';
import { ProductsService } from '../products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { PermissionModule } from 'src/common/decorators/permission-module.decorator';
import { SuperAdminModuleEnum } from 'src/staff-management/enums/module-name.enum';

@ApiBearerAuth('access-token')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
@ApiTags('Products <- Admin')
@PermissionModule(SuperAdminModuleEnum.ADMIN_PRODUCTS)
@Controller('admin-products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBody({ type: CreateProductDto })
  @ApiOperation({ summary: 'Create product' })
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    console.log(user, '--- Current User ---');
    try {
      return this.productsService.create(dto, { userId: user.sub, ip });
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // @Post('bulk')
  // @ApiBody({ type: CreateBrandDto, isArray: true })
  // @ApiOperation({ summary: 'Create bulk products' })
  // createBulk(@Body() dto: CreateProductDto[]) {
  //   return this.productsService.createBulk(dto);
  // }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  list(@Query() query: ProductQueryDto) {
    return this.productsService.list(query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Get product by id' })
  get(@Param('id') id: string) {
    return this.productsService.get(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateProductDto })
  @ApiOperation({ summary: 'Update product' })
  updateBase(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productsService.update(id, dto, user, ip);
  }

  @Patch('variant/:id')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateProductVariantDto })
  @ApiOperation({ summary: 'Update product variant' })
  updateVariant(
    @Param('id') id: string,
    @Body() dto: UpdateProductVariantDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productsService.updateVariant(id, dto, user, ip);
  }

  @Patch(':id/status')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ProductStatusDto })
  @ApiOperation({ summary: 'Update product status' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: ProductStatusDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productsService.updateStatus(id, dto, user.sub, ip);
  }

  @Patch(':id/visibility')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ProductVisibilityDto })
  @ApiOperation({ summary: 'Update product' })
  updateVisibility(
    @Param('id') id: string,
    @Body() dto: ProductVisibilityDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.productsService.updateVisibility(id, dto, user, ip);
  }

  // Possible May Be Remove
  // @Patch('bulk')
  // @ApiParam({ name: 'id', type: String })
  // @ApiBody({ type: UpdateProductDto, isArray: true })
  // @ApiOperation({ summary: 'Update multiple products' })
  // updateBulk(@Body() items: { id: string; data: UpdateProductDto }[]) {
  //   return this.productsService.updateBulk(items);
  // }

  @Delete('hard-delete/:id')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Delete product by id' })
  delete(@Param('id') id: string) {
    return this.productsService.hardDelete(id);
  }

  @Delete('hard-delete/variant/:id')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Delete product by id' })
  deleteProductVariant(@Param('id') id: string) {
    return this.productsService.hardDeleteVarient(id);
  }

  @Delete('hard-delete-bulk')
  @ApiBody({ type: DeleteBulkProductsDto })
  @ApiOperation({ summary: 'Update product' })
  deleteBulk(@Body() dto: DeleteBulkProductsDto) {
    return this.productsService.hardDeleteBulk(dto);
  }

  @Delete('hard-delete-bulk/variants')
  @ApiBody({ type: DeleteBulkProductsDto })
  @ApiOperation({ summary: 'Delete all product variants' })
  deleteBulkVariant(@Body() dto: DeleteBulkProductsDto) {
    return this.productsService.clearAllVarients(dto);
  }
}
