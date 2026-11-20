import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('Procurement Suppliers')
@ApiBearerAuth('access-token')
@Controller('procurement/suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'List procurement suppliers with filters, search, sorting, and pagination',
  })
  list(@Query() query: SupplierQueryDto) {
    return this.suppliersService.list(query);
  }


  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  get(@Param('id') id: string) {
    return this.suppliersService.get(id);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Patch(':id/toggle-status')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Toggle supplier status',
    description: 'Toggles the supplier status between ACTIVE and INACTIVE. If the supplier is currently BLOCKED, it will toggle to ACTIVE.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The unique supplier ID to toggle status' })
  @ApiOkResponse({ description: 'Supplier status toggled successfully' })
  toggleStatus(@Param('id') id: string) {
    return this.suppliersService.toggleStatus(id);
  }
}

