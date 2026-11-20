import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { GeoModule } from 'src/geo/geo.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PromotionsModule } from 'src/promotions/promotions.module';
import { NotificationModule } from 'src/notification/notification.module';
import { InvoiceModule } from 'src/invoice/invoice.module';
import { OrderDiscountService } from 'src/orders/services/order-discount.service';
import { ORDER_ALLOCATION_QUEUE } from './constants/order-allocation.constants';
import { OrderAllocationQueue } from './queues/order-allocation.queue';
import { OrderAllocationProcessor } from './processors/order-allocation.processor';
import { OrderAllocationService } from './services/order-allocation.service';
import { InventoryReservationService } from './services/inventory-reservation.service';
import { OrderAllocationEmitterService } from './events/order-allocation-emitter.service';
import { OrderAllocationNotificationsService } from './services/order-allocation-notifications.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    GeoModule,
    PromotionsModule,
    NotificationModule,
    InvoiceModule,
    BullModule.registerQueue({
      name: ORDER_ALLOCATION_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 604800 },
      },
    }),
  ],
  providers: [
    OrderAllocationQueue,
    OrderAllocationProcessor,
    OrderAllocationService,
    InventoryReservationService,
    OrderAllocationEmitterService,
    OrderAllocationNotificationsService,
    OrderDiscountService,
  ],
  exports: [
    OrderAllocationService,
    OrderAllocationQueue,
    InventoryReservationService,
  ],
})
export class OrderAllocationModule {}
