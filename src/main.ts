import * as dotenv from 'dotenv';
dotenv.config();
// Must precede every other import: the OpenTelemetry SDK instruments modules as
// they are loaded, so anything required before this is never traced.
import { startTracing } from './telemetry/tracing';
startTracing();
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';
import { AppModule } from './app.module';
import { UsersModule } from './users/users.module';
import { UploadsModule } from './uploads/uploads.module';
import { ProductsModule } from './products/products.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { createLogger } from './common/logger/json.logger';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { SupplyChainModule } from './supply-chain/supply-chain.module';
import { StockRequestsModule } from './stock-requests/stock-requests.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OrdersModule } from './orders/orders.module';
import { FranchiseReturnsModule } from './franchise-returns/franchise-returns.module';
import { PromotionsModule } from './promotions/promotions.module';
import { RetailCustomersModule } from './retail-customers/retail-customers.module';
import { FranchiseNoticesModule } from './franchise-notices/franchise-notices.module';
import { AuditModule } from './audit/audit.module';
import { GeoModule } from './geo/geo.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { FinancialModule } from './financial/financial.module';
import { CartsModule } from './carts/carts.module';
import { CouponModule } from './coupon/coupon.module';
import { NotificationModule } from './notification/notification.module';
import { InvoiceModule } from './invoice/invoice.module';
import { TransportModule } from './transport/transport.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AuthModule } from './auth/auth.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';
import { AddressModule } from './address/address.module';
import { FaqsModule } from './faqs/faqs.module';
import { AppRoleModule } from './app-role/app-role.module';
import { StaffManagementModule } from './staff-management/staff-management.module';
import { HealthModule } from './health/health.module';
import { BannerModule } from './banner/banner.module';
import { ProductReturnModule } from './product-return/product-return.module';
import { ElasticSearchModule } from './elastic-search/elastic-search.module';
import { DatabaseBackupModule } from './database-backup/database-backup.module';
import { FranchisesModule } from './franchises/franchises.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { FranchiseDocumentsModule } from './franchise-documents/franchise-documents.module';
import { ProductReviewsModule } from './product-reviews/product-reviews.module';
import { SuggestionModule } from './suggestion/suggestion.module';
import { ThemeModule } from './theme/theme.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportModule } from './report/report.module';
import { IdentityVerificationModule } from './identity-verification/identity-verification.module';
import { RetentionModule } from './retention/retention.module';
import { ReturnsV2Module } from './modules/returns-v2/returns-v2.module';
import { ReturnsFinancialModule } from './modules/returns-financial/returns-financial.module';
import { ProcurementModule } from './procurement/procurement.module';
import { StarterBundlesModule } from './starter-bundles/starter-bundles.module';
import { RevenueModule } from './revenue/revenue.module';
function parseCorsOrigins(): string[] | boolean {
  const fromEnv = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (fromEnv?.length) {
    return fromEnv;
  }
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
    'http://192.168.29.151:3001',
    'https://web-unboxio.ezzme.com',
    'https://admin-unboxio.ezzme.com',
    'https://giftfactory-web.onrender.com',
    'https://dev-franchise.ezzme.com/',
    'https://dev-admin.ezzme.com',
  ];
}

function isDevelopmentMode(): boolean {
  return ['development', 'local'].includes(process.env.NODE_ENV ?? '');
}

async function bootstrap() {
  // JSON lines in deployed environments so FireLens can fan structured logs out
  // to Loki and Logstash; human-readable output locally.
  const app = await NestFactory.create(AppModule, { logger: createLogger() });
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', true);
  }
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: isDevelopmentMode() ? true : parseCorsOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
      transformOptions: { enableImplicitConversion: true },
      errorHttpStatusCode: 400,
    }),
  );
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  // Serve public folder, allowing dotfiles (e.g. .well-known)
  app.use(express.static(join(process.cwd(), 'public'), { dotfiles: 'allow' }));

  // START SWAGGER SETUP
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ScentsOfWax (FBS) API')
    .setDescription('Swagger docs for all module only')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    include: [
      HealthModule,
      AuthModule,
      RecaptchaModule,
      AdminUsersModule,
      FranchiseDocumentsModule,
      FranchisesModule,
      UsersModule,
      AddressModule,
      UploadsModule,
      ProductsModule,
      SupportTicketsModule,
      StockRequestsModule,
      DeliveriesModule,
      WarehouseModule,
      SupplyChainModule,
      FranchiseReturnsModule,
      PromotionsModule,
      RetailCustomersModule,
      FranchiseNoticesModule,
      AnalyticsModule,
      AuditModule,
      GeoModule,
      OrdersModule,
      FinancialModule,
      CartsModule,
      WebhooksModule,
      CouponModule,
      NotificationModule,
      InvoiceModule,
      TransportModule,
      FaqsModule,
      AppRoleModule,
      StaffManagementModule,
      BannerModule,
      ProductReturnModule,
      ElasticSearchModule,
      DatabaseBackupModule,
      WishlistModule,
      ProductReviewsModule,
      SuggestionModule,
      ThemeModule,
      DashboardModule,
      ReportModule,
      IdentityVerificationModule,
      RetentionModule,
      ReturnsV2Module,
      ReturnsFinancialModule,
      ProcurementModule,
      StarterBundlesModule,
      RevenueModule
    ],
  });
  SwaggerModule.setup('swagger', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // END SWAGGER SETUP

  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, host);
  console.log(
    `ScentsOfWax API listening on http://${host}:${port}/api/v1/health (metrics: /api/v1/metrics)`,
  );
}
bootstrap();
