import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Delete,
  Param,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { SearchHistoryService } from './services/search-history.service';
import {
  CreateProductViewDto,
  CreateSearchHistoryDto,
} from './dto/create-search-history.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { SearchHistoryQueryDto } from './dto/search-history-query.dto';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Search History')
@Controller('customer')
export class SearchHistoryController {
  constructor(private readonly searchHistoryService: SearchHistoryService) {}

  @Post('search-history')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER, Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Record a customer search event' })
  async recordSearch(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSearchHistoryDto,
  ) {
    const data = await this.searchHistoryService.recordSearch({
      ...dto,
      customerId: user.customerId,
    });

    return { data };
  }

  @Post('view-product')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER, Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Record a customer product view event' })
  async recordView(
    @CurrentUser() user: JwtUser,
    @Body() body: CreateProductViewDto,
  ) {
    const data = await this.searchHistoryService.recordView({
      customerId: user.customerId || body.customerId,
      productId: body.productId,
      categoryId: body.categoryId,
      query: body.query || '',
    });

    return { data };
  }

  @Get('search-history')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER, Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary:
      'List search history for a customer (customer can only see their own history)',
  })
  async listByCustomerId(
    @CurrentUser() user: JwtUser,
    @Query() query: SearchHistoryQueryDto,
  ) {
    const data = await this.searchHistoryService.getListByCustomerId({
      ...query,
      ...(user.role === Role.CUSTOMER ? { customerId: user.customerId } : {}),
    });

    return { data };
  }

  @Get('recommended')
  @Public()
  @ApiOperation({
    summary: 'Recommended products from search and view behavior',
  })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async recommended(
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.searchHistoryService.recommended(
      customerId,
      limit ? Number(limit) : 12,
    );

    return { data };
  }

  @Delete('search-history/all')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: 'Clear all search history for the current customer',
  })
  async clearAll(@CurrentUser() user: JwtUser) {
    if (!user.customerId) {
      throw new BadRequestException('User is not a valid customer');
    }
    const data = await this.searchHistoryService.clearAllCustomerHistory(
      user.customerId,
    );

    return { data };
  }

  @Delete('search-history/:id')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER, Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Delete a specific search history record' })
  async remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    if (!user.customerId) {
      throw new BadRequestException('User is not a valid customer');
    }

    const data = await this.searchHistoryService.remove(id, user.customerId);

    return { data };
  }
}
