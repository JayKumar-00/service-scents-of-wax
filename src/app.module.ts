import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { FranchiseDocumentsModule } from './franchise-documents/franchise-documents.module';
import { FranchiseNoticesModule } from './franchise-notices/franchise-notices.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { FranchiseReturnsModule } from './franchise-returns/franchise-returns.module';
import { FranchisesModule } from './franchises/franchises.module';
import { GeoModule } from './geo/geo.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { PromotionsModule } from './promotions/promotions.module';
import { RetailCustomersModule } from './retail-customers/retail-customers.module';
import { StockRequestsModule } from './stock-requests/stock-requests.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SupplyChainModule } from './supply-chain/supply-chain.module';
import { StarterBundlesModule } from './starter-bundles/starter-bundles.module';
import { UsersModule } from './users/users.module';
import { OtpModule } from './otp/otp.module';
import { RedisModule } from './redis/redis.module';
import { UploadsModule } from './uploads/uploads.module';
import { FinancialModule } from './financial/financial.module';
import { RevenueModule } from './revenue/revenue.module';
import { BullModule } from '@nestjs/bullmq';
import { CartsModule } from './carts/carts.module';
import { NotificationModule } from './notification/notification.module';
import { CouponModule } from './coupon/coupon.module';
import { InvoiceModule } from './invoice/invoice.module';
import { TransportModule } from './transport/transport.module';
import { AddressModule } from './address/address.module';
import { FaqsModule } from './faqs/faqs.module';
import { AppRoleModule } from './app-role/app-role.module';
import { StaffManagementModule } from './staff-management/staff-management.module';
import redisConfig from './common/config/redis.config';
import { PermissionGuard } from './common/guards/permission.guard';
import { BannerModule } from './banner/banner.module';
import { ElasticSearchModule } from './elastic-search/elastic-search.module';
import { ProductReturnModule } from './product-return/product-return.module';
import { ReturnsV2Module } from './modules/returns-v2/returns-v2.module';
import { DatabaseBackupModule } from './database-backup/database-backup.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ProductReviewsModule } from './product-reviews/product-reviews.module';
import { SuggestionModule } from './suggestion/suggestion.module';
import { ThemeModule } from './theme/theme.module';
import { ReportModule } from './report/report.module';
import { IdentityVerificationModule } from './identity-verification/identity-verification.module';
import { RetentionModule } from './retention/retention.module';
import { ReturnsFinancialModule } from './modules/returns-financial/returns-financial.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';
import { ProcurementModule } from './procurement/procurement.module';
import * as fs from 'fs';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [redisConfig],
    }),
    ScheduleModule.forRoot(),
    // ThrottlerModule.forRoot([
    //   {
    //     ttl: 60000,
    //     limit: 500,
    //   },
    // ]),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: 60000,
          limit: 500,
        },
        {
          name: 'otp',
          limit: config.get<number>('OTP_LIMIT', 5),
          ttl: config.get<number>('OTP_TTL', 60), // in seconds
        },
        {
          name: 'login',
          limit: config.get<number>('LOGIN_LIMIT', 24),
          ttl: config.get<number>('LOGIN_TTL', 1440),
        },
      ],
    }),
    PrismaModule,
    AuditModule,
    GeoModule,
    AuthModule,
    RecaptchaModule,
    FranchisesModule,
    FranchiseReturnsModule,
    ProductsModule,
    OrdersModule,
    WarehouseModule,
    StockRequestsModule,
    StarterBundlesModule,
    RetailCustomersModule,
    DeliveriesModule,
    AnalyticsModule,
    DashboardModule,
    PromotionsModule,
    AdminUsersModule,
    FranchiseNoticesModule,
    FranchiseDocumentsModule,
    SupportTicketsModule,
    WebhooksModule,
    SupplyChainModule,
    HealthModule,
    MetricsModule,
    UsersModule,
    OtpModule,
    RedisModule,
    UploadsModule,
    FinancialModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.connection.host'),
          username: configService.get('redis.connection.username'),
          port: configService.get('redis.connection.port'),
          password: configService.get('redis.connection.password'),
          db: configService.get('redis.connection.db'),
          // Must agree with the cluster: see REDIS_TLS in redis.module.ts.
          ...(process.env.REDIS_TLS === 'true' ? {
            tls: {
              ca: (process.env.REDIS_CA_CERT_PATH && fs.existsSync(process.env.REDIS_CA_CERT_PATH))
                ? fs.readFileSync(process.env.REDIS_CA_CERT_PATH, 'utf8')
                : undefined,
              rejectUnauthorized: false,
            }
          } : {}),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    CartsModule,
    NotificationModule,
    CouponModule,
    InvoiceModule,
    TransportModule,
    AddressModule,
    FaqsModule,
    AppRoleModule,
    StaffManagementModule,
    BannerModule,
    ElasticSearchModule,
    ProductReturnModule,
    ReturnsV2Module,
    DatabaseBackupModule,
    WishlistModule,
    ProductReviewsModule,
    SuggestionModule,
    ThemeModule,
    ReportModule,
    IdentityVerificationModule,
    RetentionModule,
    ReturnsFinancialModule,
    ProcurementModule,
    RevenueModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule { }
