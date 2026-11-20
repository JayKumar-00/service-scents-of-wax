import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminCustomerService } from './admin-customer.service';
// NOTE: Import your JwtAuthGuard and RolesGuard specific to your setup here.
// import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CustomerQueryDto, CustomerType } from './customer-query.dto';
import { UpdateCustomerStatusDto } from './update-customer-status.dto';

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
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  async listCustomer(@Query() query: CustomerQueryDto) {
    return this.adminCustomerService.listCustomer(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiQuery({ name: 'customerType', enum: CustomerType, required: false })
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
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
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  async toSetStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    return this.adminCustomerService.toSetStatus(id, dto.status);
  }
}
