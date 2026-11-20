import { Controller, Get, Patch, Param, Query, Body, Ip } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminCustomerService } from './admin-customer.service';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CustomerQueryDto, CustomerType } from './dto/customer-query.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtUser } from '../../auth/types/jwt-user.type';

@ApiTags('Customers <- Superadmin/Admin Staff')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
@ApiBearerAuth('access-token')
@Controller('admin/customers')
export class AdminCustomerController {
  constructor(private readonly adminCustomerService: AdminCustomerService) {}

  @Get()
  @ApiOperation({
    summary:
      'List all customers (Online or Retail) with filters and pagination',
  })
  async listCustomer(@Query() query: CustomerQueryDto) {
    return this.adminCustomerService.listCustomer(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiQuery({ name: 'customerType', enum: CustomerType, required: false })
  async getByCustomerId(
    @Param('id') id: string,
    @Query('customerType') customerType?: CustomerType,
  ) {
    return this.adminCustomerService.getByCustomerId(id, customerType);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update Online Customer status (Block, Active, etc.)',
  })
  async toSetStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerStatusDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.adminCustomerService.toSetStatus(id, dto.status, {
      userId: user.sub,
      ip,
    });
  }
}
