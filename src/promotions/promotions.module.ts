import { Module } from '@nestjs/common';
import { CatalogPromotionService } from './catalog-promotion.service';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, CatalogPromotionService],
  exports: [PromotionsService, CatalogPromotionService],
})
export class PromotionsModule {}
