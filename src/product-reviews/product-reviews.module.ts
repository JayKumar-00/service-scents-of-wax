import { Module } from '@nestjs/common';
import { ProductReviewsService } from './product-reviews.service';
import { ProductReviewsController } from './product-reviews.controller';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [ProductReviewsService],
  controllers: [ProductReviewsController],
})
export class ProductReviewsModule {}
