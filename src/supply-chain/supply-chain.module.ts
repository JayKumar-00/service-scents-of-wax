import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { DomainEventsService } from './domain-events.service';
import { ReplenishmentNetworkService } from './replenishment-network.service';
import { StockingNodesService } from './stocking-nodes.service';
import { StockTransfersService } from './stock-transfers.service';
import { SupplyChainController } from './supply-chain.controller';
import { TransportLanesService } from './transport-lanes.service';

@Module({
  imports: [WebhooksModule],
  controllers: [SupplyChainController],
  providers: [
    DomainEventsService,
    StockingNodesService,
    TransportLanesService,
    StockTransfersService,
    ReplenishmentNetworkService,
  ],
  exports: [
    DomainEventsService,
    StockingNodesService,
    TransportLanesService,
    StockTransfersService,
  ],
})
export class SupplyChainModule {}
