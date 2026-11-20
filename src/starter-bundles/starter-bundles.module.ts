import { Module } from '@nestjs/common';
import { StarterBundlesController } from './starter-bundles.controller';
import { StarterBundlesService } from './starter-bundles.service';
import { BundleProvisionService } from './bundle-provision.service';
import { StarterBundleProcessor } from './jobs/starter-bundle.processor';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuditModule } from 'src/audit/audit.module';
import { SupplyChainModule } from 'src/supply-chain/supply-chain.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    SupplyChainModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'starter-bundle',
    }),
  ],
  controllers: [StarterBundlesController],
  providers: [
    StarterBundlesService,
    BundleProvisionService,
    StarterBundleProcessor,
  ],
  exports: [
    StarterBundlesService,
    BundleProvisionService,
    BullModule,
  ],
})
export class StarterBundlesModule {}
