import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Public } from 'src/common/decorators/public.decorator';
import { VerifyPaymentDto } from './dto/razorpay/verify-payment.dto';
import { CapturePaymentDto } from './dto/razorpay/capture-payment.dto';
import { TransactionQueryDto } from './dto/razorpay/transaction-query.dto';
import { PaymentRefundDto } from './dto/razorpay/payment-refund.dto';
import { CreateSubscriptionDto } from './dto/razorpay/create-subscription.dto';
import { CreateInvoiceDto } from './dto/razorpay/create-invoice.dto';
import { CreatePaymentOrderDto } from './dto/razorpay/create-order.dto';
import { CreateCustomerDto } from './dto/razorpay/create-customer.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('Payment <- SuperAdmin, Franchise, Customer')
@ApiBearerAuth('access-token')
@Controller('payment')
export class PaymentController {
  constructor(private readonly razorpayService: RazorpayService) {}
  // 🔹 Orders
  @Post('orders')
  @ApiOperation({ summary: 'Create a new order' })
  @Roles(
    Role.CUSTOMER,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.AFFILIATE,
  )
  async createOrder(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePaymentOrderDto,
    @Ip() ip: string,
  ) {
    try {
      return this.razorpayService.createOrder(user, dto, ip);
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Fetch order details by ID' })
  @Roles(Role.SUPERADMIN)
  async fetchOrder(@Param('id') orderId: string) {
    return this.razorpayService.fetchOrder(orderId);
  }

  @Post('orders/:razorpayOrderId/cancel')
  @ApiOperation({ summary: 'Cancel a payment order' })
  @Public()
  async cancelOrder(
    @Param('razorpayOrderId') razorpayOrderId: string,
    @Ip() ip?: string,
  ) {
    return this.razorpayService.cancelOrder(razorpayOrderId, ip);
  }

  @Get('public-config')
  @ApiOperation({ summary: 'Get Razorpay checkout configuration' })
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  @Public()
  async checkoutConfig() {
    return this.razorpayService.checkoutConfig();
  }

  // 🔹 Verify Payments
  @Post('verify')
  @ApiOperation({ summary: 'Verify a payment after checkout' })
  @Public()
  async verifyPayment(@Body() dto: VerifyPaymentDto, @Ip() ip?: string) {
    return this.razorpayService.verify(dto, ip);
  }

  // 🔹 Verify / Capture Payments
  @Post('capture')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Capture Payment (Manual Capture)' })
  async capturePayment(
    @CurrentUser() user: JwtUser,
    @Body() dto: CapturePaymentDto,
    @Ip() ip?: string,
  ) {
    return this.razorpayService.capturePayment(dto, user, ip);
  }

  @Get('transactions')
  @ApiOperation({
    summary:
      'Fetch all payment transactions with optional filters (SuperAdmin)',
  })
  @ApiBearerAuth('access-token')
  @Roles(
    Role.SUPERADMIN,
    Role.FRANCHISE_OWNER,
    Role.CUSTOMER,
    Role.FRANCHISE_STAFF,
  )
  async fetchAllTransactions(
    @CurrentUser() user: JwtUser,
    @Query() query: TransactionQueryDto,
  ) {
    return this.razorpayService.fetchAllTransactions(query, user);
  }

  @Get('transactions/:id')
  @ApiOperation({
    summary: 'Fetch payment transaction details by ID (SuperAdmin)',
  })
  @ApiBearerAuth('access-token')
  @Roles(
    Role.SUPERADMIN,
    Role.FRANCHISE_OWNER,
    Role.CUSTOMER,
    Role.FRANCHISE_STAFF,
  )
  async fetchTransaction(
    @CurrentUser() user: JwtUser,
    @Param('id') paymentId: string,
  ) {
    return this.razorpayService.fetchTransaction(paymentId, user);
  }

  @Post('refund')
  @ApiOperation({ summary: 'Refund a payment (SuperAdmin)' })
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  async refundPayment(
    @CurrentUser() user: JwtUser,
    @Body() dto: PaymentRefundDto,
    @Ip() ip?: string,
  ) {
    return this.razorpayService.refundPayment(dto, user, ip);
  }

  // 🔹 Customers
  @Post('customers')
  @ApiOperation({ summary: 'Create a new customer (SuperAdmin)' })
  @ApiBearerAuth('access-token')
  @Roles(
    Role.SUPERADMIN,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  async createCustomer(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCustomerDto,
    @Ip() ip?: string,
  ) {
    return this.razorpayService.createCustomer(
      dto.name,
      dto.email,
      dto.contact,
      user,
      ip,
    );
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Fetch customer details by ID (SuperAdmin)' })
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  async fetchCustomer(@Param('id') customerId: string) {
    return this.razorpayService.fetchCustomer(customerId);
  }

  // 🔹 Subscriptions
  @Post('subscriptions')
  @ApiOperation({ summary: 'Create a new subscription (SuperAdmin)' })
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  async createSubscription(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSubscriptionDto,
    @Ip() ip?: string,
  ) {
    const { planId, customerId } = dto;
    return this.razorpayService.createSubscription(
      planId,
      customerId,
      user,
      ip,
    );
  }

  @Post('subscriptions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription (SuperAdmin)' })
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  async cancelSubscription(
    @CurrentUser() user: JwtUser,
    @Param('id') subscriptionId: string,
    @Ip() ip?: string,
  ) {
    return this.razorpayService.cancelSubscription(subscriptionId, user, ip);
  }

  // 🔹 Invoices
  @Post('invoices')
  @ApiOperation({ summary: 'Create a new invoice (SuperAdmin)' })
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.FRANCHISE_OWNER)
  async createInvoice(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateInvoiceDto,
    @Ip() ip?: string,
  ) {
    return this.razorpayService.createInvoice(dto, user, ip);
  }

  @Get('invoices-all')
  @ApiOperation({ summary: 'Fetch invoice details by ID (SuperAdmin)' })
  @ApiBearerAuth('access-token')
  @Roles(
    Role.SUPERADMIN,
    Role.FRANCHISE_OWNER,
    Role.CUSTOMER,
    Role.FRANCHISE_STAFF,
  )
  async fetchAllInvoice(@CurrentUser() user: JwtUser) {
    return this.razorpayService.fetchInvoices(user);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Fetch invoice details by ID (SuperAdmin)' })
  @ApiBearerAuth('access-token')
  @Roles(
    Role.SUPERADMIN,
    Role.FRANCHISE_OWNER,
    Role.CUSTOMER,
    Role.FRANCHISE_STAFF,
  )
  async fetchInvoice(
    @CurrentUser() user: JwtUser,
    @Param('id') invoiceId: string,
  ) {
    return this.razorpayService.fetchInvoice(invoiceId, user);
  }
}
