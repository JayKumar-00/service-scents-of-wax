import { Module } from '@nestjs/common';
import { FranchisesController } from './franchises.controller';
import { FranchisesService } from './franchises.service';
import { FranchiseProposalsController } from './franchise-proposals.controller';
import { OrderAllocationModule } from 'src/order-allocation/order-allocation.module';
import { SupplyChainModule } from 'src/supply-chain/supply-chain.module';
import { StarterBundlesModule } from 'src/starter-bundles/starter-bundles.module';

@Module({
  imports: [OrderAllocationModule, SupplyChainModule, StarterBundlesModule],
  controllers: [FranchisesController, FranchiseProposalsController],
  providers: [FranchisesService],
  exports: [FranchisesService],
})
export class FranchisesModule {}
