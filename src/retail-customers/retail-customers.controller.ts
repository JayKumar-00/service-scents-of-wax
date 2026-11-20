import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { RetailCustomersService } from './retail-customers.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RetailCustomerQueryDto } from './dto/retail-customer-query.dto';
import { RetailCustomerPaymentDto } from './dto/retail-customer-payment.dto';

@ApiTags('Retail Customers <- SuperAdmin, Franchise Owner/Staff/Auditor')
@ApiBearerAuth('access-token')
@Roles(
  Role.SUPERADMIN,
  Role.ADMIN_STAFF,
  Role.FRANCHISE_OWNER,
  Role.FRANCHISE_STAFF,
  Role.FRANCHISE_AUDITOR,
)
@Controller('retail-customers')
export class RetailCustomersController {
  constructor(private readonly retailCustomers: RetailCustomersService) { }

  @Get()
  @ApiOperation({ summary: 'List retail customers' })
  list(@CurrentUser() user: JwtUser, @Query() query: RetailCustomerQueryDto) {
    return this.retailCustomers.list(user, {
      ...query,
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : user.role === Role.FRANCHISE_STAFF
          ? { franchiseId: user.franchiseOwnerId }
          : {}),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get retail customer by ID' })
  getOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.retailCustomers.getById(id, user);
  }

  @Post(':orderNumber/payment')
  @ApiOperation({ summary: 'Record payment for a POS order by order number' })
  payment(
    @CurrentUser() user: JwtUser,
    @Param('orderNumber') orderNumber: string,
    @Body() dto: RetailCustomerPaymentDto,
    @Ip() ip: string
  ) {
    return this.retailCustomers.recordPayment(user, orderNumber, dto, ip);
  }
}
