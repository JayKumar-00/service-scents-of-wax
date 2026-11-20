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
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AddressService } from './address.service';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
  AddressQueryDto,
} from './dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Address <- Customer')
@ApiBearerAuth('access-token')
@Roles(
  Role.CUSTOMER,
  Role.SUPERADMIN,
  Role.ADMIN_STAFF,
  Role.FRANCHISE_OWNER,
  Role.FRANCHISE_STAFF,
)
@Controller('address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get('list')
  @ApiOperation({
    summary: 'List customer addresses with pagination and filters',
  })
  async list(@CurrentUser() user: JwtUser, @Query() query: AddressQueryDto) {
    return this.addressService.list(
      {
        ...query,
        ...(user.role === Role.CUSTOMER ? { customerId: user.customerId } : {}),
      },
      query.page,
      query.limit,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Add a new customer address' })
  async add(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCustomerAddressDto,
    @Ip() ip: string,
  ) {
    return this.addressService.add(user.sub, dto, ip);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a customer address by address ID' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerAddressDto,
    @Ip() ip: string,
  ) {
    return this.addressService.update(user, id, dto, ip);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a customer address by address ID' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  async delete(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.addressService.delete(user, id, ip);
  }

  @Patch(':id/set-default')
  @ApiOperation({
    summary: 'Set a specific address as the default address for the customer',
  })
  @ApiParam({ name: 'id', description: 'Address ID to set as default' })
  async setDefault(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.addressService.setDefault(user, id, ip);
  }
}
