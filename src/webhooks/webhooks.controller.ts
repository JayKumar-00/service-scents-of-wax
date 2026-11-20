import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Ip,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { WebhooksService } from './webhooks.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhookEndpointQueryDto } from './dto/webhook-endpoint-query.dto';
import { WebhookDeliveryQueryDto } from './dto/webhook-delivery-query.dto';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly configService: ConfigService,
  ) {}

  @Post('razorpay')
  @ApiOperation({ summary: 'Handle Razorpay webhook events' })
  @Public()
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const secret =
      this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') ??
      'RAZORPAY_WEBHOOK_SECRET';
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new HttpException(
        { success: false, message: 'Invalid webhook signature' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Process event safely
    console.log('Webhook event:', req.body);
    return { success: true };
  }

  @Get()
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'List all webhook endpoints' })
  list(@Query() query: WebhookEndpointQueryDto) {
    return this.webhooks.listEndpoints(query);
  }

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Create a new webhook endpoint' })
  create(
    @Body() dto: CreateWebhookEndpointDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.webhooks.createEndpoint(user, dto, ip);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Update a webhook endpoint' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookEndpointDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.webhooks.updateEndpoint(user, id, dto, ip);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.webhooks.deleteEndpoint(user, id, ip);
  }

  @Get(':id/deliveries')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'List recent deliveries for a webhook endpoint' })
  deliveries(@Param('id') id: string, @Query() query: WebhookDeliveryQueryDto) {
    return this.webhooks.listDeliveries(id, query);
  }

  @Post(':id/test')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Send a test event to the webhook endpoint' })
  test(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.webhooks.pingTest(user, id, ip);
  }
}
