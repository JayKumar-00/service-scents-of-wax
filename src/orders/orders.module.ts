import { forwardRef, Module } from '@nestjs/common';
import { GeoModule } from '../geo/geo.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { SupplyChainModule } from '../supply-chain/supply-chain.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { NotificationModule } from 'src/notification/notification.module';
import { CustomerOrderController } from './controllers/customer-order.controller';
import { FulfillmentPreviewService } from './services/fulfillment-preview.service';
import { OrderStockService } from './services/order-stock.service';
import { OrderAllocationModule } from 'src/order-allocation/order-allocation.module';
import { OrderQueryService } from './services/order-query.service';
import { OrderPaymentService } from './services/order-payment.service';
import { OrderPosService } from './services/order-pos.service';
import { OrderCartService } from './services/order-cart.service';
import { OrderStatusService } from './services/order-status.service';
import { OrderDiscountService } from './services/order-discount.service';
import { InvoiceModule } from '../invoice/invoice.module';
import { PickupReminderCron } from './crons/pickup-reminder.cron';
import { OrderSettlementService } from './services/order-settlement.service';
import { OrderSettlementCron } from './crons/order-settlement.cron';
import { FinancialModule } from '../financial/financial.module';
import { OrderRefundCron } from './crons/order-refund.cron';

@Module({
  imports: [
    GeoModule,
    PromotionsModule,
    forwardRef(() => WebhooksModule),
    forwardRef(() => SupplyChainModule),
    NotificationModule,
    forwardRef(() => InvoiceModule),
    forwardRef(() => OrderAllocationModule),
    forwardRef(() => FinancialModule),
  ],
  controllers: [OrdersController, CustomerOrderController],
  providers: [
    OrdersService,
    FulfillmentPreviewService,
    OrderStockService,
    OrderQueryService,
    OrderPaymentService,
    OrderPosService,
    OrderCartService,
    OrderStatusService,
    OrderDiscountService,
    PickupReminderCron,
    OrderSettlementService,
    OrderSettlementCron,
    OrderRefundCron,
  ],
  exports: [
    OrdersService,
    FulfillmentPreviewService,
    OrderStockService,
    OrderSettlementService,
  ],
})
export class OrdersModule {}
