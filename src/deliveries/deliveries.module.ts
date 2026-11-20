import { Module } from '@nestjs/common';
import { SupplyChainModule } from '../supply-chain/supply-chain.module';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    SupplyChainModule,
    NotificationModule,
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
})
export class DeliveriesModule {}
