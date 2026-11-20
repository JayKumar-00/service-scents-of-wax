import { Module, forwardRef } from '@nestjs/common';
import { SupplyChainModule } from '../supply-chain/supply-chain.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { StockRequestsController } from './stock-requests.controller';
import { StockRequestsService } from './stock-requests.service';
import { NotificationModule } from 'src/notification/notification.module';
import { FinancialModule } from 'src/financial/financial.module';

@Module({
  imports: [
    WebhooksModule,
    SupplyChainModule,
    NotificationModule,
    FinancialModule,
  ],
  controllers: [StockRequestsController],
  providers: [StockRequestsService],
})
export class StockRequestsModule {}

