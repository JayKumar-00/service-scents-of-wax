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
import { ProductReviewsService } from './product-reviews.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { GenericResponse } from './interfaces/product-review.interface';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetProductReviewQueryDto } from './dto/get-product-review-query.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { UpdateProductReviewDto } from './dto/update-product-review.dto';

@ApiTags('Product Reviews <- SuperAdmin, Admin Staff, Customer')
@Controller('product-reviews')
export class ProductReviewsController {
  constructor(private readonly productReviewsService: ProductReviewsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Create a product review' })
  @ApiResponse({
    status: 201,
    description: 'Review submitted successfully. Waiting for approval.',
  })
  async create(
    @CurrentUser() user: JwtUser,
    @Body() createProductReviewDto: CreateProductReviewDto,
    @Ip() ip: string,
  ): Promise<GenericResponse> {
    // Extract user logic from standard Request or your Custom @CurrentUser decorator

    const review = await this.productReviewsService.create(
      user,
      createProductReviewDto,
      ip,
    );

    return {
      success: true,
      message: 'Review submitted successfully. Waiting for approval.',
      data: review,
    };
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all product reviews with pagination and filtering',
  })
  @ApiResponse({ status: 200, description: 'Returns paginated reviews list' })
  async findAllPaginated(
    @Query() query: GetProductReviewQueryDto,
  ): Promise<GenericResponse> {
    const result = await this.productReviewsService.findAllPaginated(query);

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('all')
  @Public()
  @ApiOperation({ summary: 'Get all product reviews without pagination' })
  @ApiResponse({ status: 200, description: 'Returns full reviews list' })
  async findAll(
    @Query() query: GetProductReviewQueryDto,
  ): Promise<GenericResponse> {
    const data = await this.productReviewsService.findAll(query);

    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single product review by ID' })
  @ApiResponse({ status: 200, description: 'Returns a single product review' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findOne(@Param('id') id: string): Promise<GenericResponse> {
    const review = await this.productReviewsService.findOne(id);

    return {
      success: true,
      data: review,
    };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'Update a product review (Admin or Owner)' })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden access' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() updateProductReviewDto: UpdateProductReviewDto,
    @Ip() ip: string,
  ): Promise<GenericResponse> {
    const updatedReview = await this.productReviewsService.update(
      id,
      user,
      updateProductReviewDto,
      ip,
    );

    return {
      success: true,
      message: 'Review updated successfully',
      data: updatedReview,
    };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'Delete a product review (Admin or Owner)' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden access' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ): Promise<GenericResponse> {
    await this.productReviewsService.remove(id, user, ip);

    return {
      success: true,
      message: 'Review successfully deleted',
    };
  }
}
