import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { SupplierReturnsService } from './supplier-returns.service';

@ApiTags('Procurement Supplier Returns')
@ApiBearerAuth('access-token')
@Controller('procurement/supplier-returns')
export class SupplierReturnsController {
  constructor(private readonly supplierReturnsService: SupplierReturnsService) {}

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'List all supplier return orders (RTVs)' })
  findAll() {
    return this.supplierReturnsService.findAll();
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Get details of a specific supplier return order' })
  findOne(@Param('id') id: string) {
    return this.supplierReturnsService.findOne(id);
  }
}
