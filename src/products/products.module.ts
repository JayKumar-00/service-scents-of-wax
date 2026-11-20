import { forwardRef, Module } from '@nestjs/common';
import { PromotionsModule } from '../promotions/promotions.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories/categories.service';
import { AdminCategoriesController } from './categories/controllers/admin-categories.controller';
import { AdminBrandsController } from './brands/controllers/admin-brands.controller';
import { BrandsService } from './brands/brands.service';
import { MediaLibraryService } from './media-library/media-library.service';
import { MediaLibraryController } from './media-library/media-library.controller';
import { UploadsModule } from 'src/uploads/uploads.module';
import { LocalService } from './product-controllers/local.service';
import { AdminProductsController } from './product-controllers/admin-products.controller';
import { AttributesService } from './attributes/attributes.service';
import { AttributesController } from './attributes/attributes.controller';
import { PublicProductsController } from './product-controllers/public-products.controller';
import { WebProductService } from './web-product/web-product.service';
import { WebProductController } from './web-product/web-product.controller';
import { WebCategoriesController } from './categories/controllers/web-categories.controller';
import { WebBrandsController } from './brands/controllers/web-brands.controller';
import { NotificationModule } from 'src/notification/notification.module';
import { ReportModule } from 'src/report/report.module';

@Module({
  imports: [
    forwardRef(() => UploadsModule),
    PromotionsModule,
    NotificationModule,
    ReportModule,
  ],
  controllers: [
    ProductsController,
    AdminCategoriesController,
    AdminCategoriesController,
    AdminBrandsController,
    MediaLibraryController,
    AdminProductsController,
    PublicProductsController,
    AttributesController,
    WebProductController,
    WebCategoriesController,
    WebBrandsController,
  ],
  providers: [
    ProductsService,
    CategoriesService,
    BrandsService,
    MediaLibraryService,
    LocalService,
    AttributesService,
    WebProductService,
  ],
  exports: [ProductsService, MediaLibraryService, WebProductService],
})
export class ProductsModule {}
