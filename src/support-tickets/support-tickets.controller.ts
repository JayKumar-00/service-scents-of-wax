import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Ip,
} from '@nestjs/common';
import { Role, SupportTicketStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateCustomerTicketDto } from './dto/create-customer-ticket.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { SupportTicketsService } from './support-tickets.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TicketQueryDto } from './dto/support-ticket-query.dto';

@ApiBearerAuth('access-token')
@ApiTags('Support Tickets <- Supperadmin, Franchise Owner/Staff/Auditor')
@Roles(
  Role.SUPERADMIN,
  Role.ADMIN_STAFF,
  Role.FRANCHISE_OWNER,
  Role.FRANCHISE_STAFF,
  Role.CUSTOMER,
)
@Controller('support-tickets')
export class SupportTicketsController {
  constructor(private readonly tickets: SupportTicketsService) { }

  @Get()
  @ApiOperation({
    summary: 'List support tickets',
    description:
      'Retrieve support tickets with optional franchise ID and status filters. SUPERADMIN can view all tickets, franchisees can view only their own.',
  })
  @ApiQuery({
    name: 'franchiseId',
    description: 'Filter tickets by franchise ID (SUPERADMIN only)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'status',
    description: `Filter tickets by status`,
    required: false,
    type: String,
    enum: Object.values(SupportTicketStatus),
  })
  @ApiResponse({
    status: 200,
    description: 'List of support tickets retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  list(
    @CurrentUser() user: JwtUser,
    @Query('franchiseId') franchiseId?: string,
    @Query('status') status?: string,
  ) {
    const st =
      status &&
        (Object.values(SupportTicketStatus) as string[]).includes(status)
        ? (status as SupportTicketStatus)
        : undefined;
    return this.tickets.list(user, franchiseId?.trim() || undefined, st);
  }

  @Get('with-filter')
  @ApiOperation({
    summary: 'List support tickets with advanced filtering',
    description:
      'Retrieve support tickets with pagination, search, sorting, and filtering. Supports searching by ticket number, subject, and type.',
  })
  @ApiQuery({
    name: 'search',
    description: 'Search tickets by ticket number, subject, or type',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'priority',
    description: 'Filter by priority level',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by ticket status',
    required: false,
    type: String,
    enum: Object.values(SupportTicketStatus),
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Sort by field (createdAt or priority)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'order',
    description: 'Sort order (asc or desc)',
    required: false,
    type: String,
    enum: ['asc', 'desc'],
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination (default: 1)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page (default: 10)',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of support tickets with metadata',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async listWithFilter(
    @CurrentUser() user: JwtUser,
    @Query() query: TicketQueryDto,
  ) {
    return this.tickets.listWithFilter(user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new support ticket',
    description:
      'Create a new support ticket for a franchise. Only franchise staff and owners can create tickets.',
  })
  @ApiBody({
    description: 'Support ticket creation data',
    type: CreateSupportTicketDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Support ticket created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSupportTicketDto,
    @Ip() ip: string,
  ) {
    return this.tickets.create(dto, user, ip);
  }

  @Post('customer-coversession')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: 'Raise support ticket by customer or admin on behalf of customer',
    description:
      'Raise a support ticket. Customers only need to pass "type" and "subject" (all other details are resolved internally). Superadmin and Admin Staff can raise tickets on behalf of a customer by additionally passing "customerUserId".',
  })
  @ApiQuery({
    name: 'customerUserId',
    description: 'ID of the Customer user (Required for Admin/Superadmin)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'franchiseId',
    description:
      'Franchise ID for the ticket. Falls back to customer franchise or Central Warehouse.',
    required: false,
    type: String,
  })
  @ApiBody({
    description: 'Support ticket creation data for customer coversession',
    type: CreateCustomerTicketDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Support ticket created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async raiseCustomerTicket(
    @Body() dto: CreateCustomerTicketDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
    @Query('customerUserId') customerUserId?: string,
    @Query('franchiseId') franchiseId?: string,
  ) {
    return this.tickets.raiseCustomerTicket(
      dto,
      user,
      ip,
      customerUserId,
      franchiseId,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get support ticket details',
    description:
      'Retrieve detailed information for a specific support ticket including messages and related data.',
  })
  @ApiParam({
    name: 'id',
    description: 'Support ticket ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Support ticket details retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  get(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tickets.getById(id, user);
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Add message to support ticket',
    description:
      'Add a new message or reply to a support ticket. Only superadmin, franchise staff, and owners can add messages.',
  })
  @ApiParam({
    name: 'id',
    description: 'Support ticket ID',
    type: String,
  })
  @ApiBody({
    description: 'Message data to add to the ticket',
    type: AddTicketMessageDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Message added to ticket successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid message data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  message(
    @Param('id') id: string,
    @Body() dto: AddTicketMessageDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.tickets.addMessage(id, dto, user, ip);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update support ticket',
    description:
      'Update support ticket details such as status, priority, and assignment. Only SUPERADMIN or ADMIN_STAFF can update tickets.',
  })
  @ApiParam({
    name: 'id',
    description: 'Support ticket ID',
    type: String,
  })
  @ApiBody({
    description: 'Ticket update data',
    type: UpdateSupportTicketDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Support ticket updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Only SUPERADMIN can update tickets',
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.tickets.updateTicket(id, dto, user, ip);
  }
}
