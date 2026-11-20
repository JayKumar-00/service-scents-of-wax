import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { FranchiseService } from './franchise/franchise.service';
import { FranchiseController } from './franchise/franchise.controller';
import { AdminFranchiseService } from './admin-franchise/admin-franchise.service';
import { AdminFranchiseController } from './admin-franchise/admin-franchise.controller';
import { CustomerService } from './customer/customer.service';
import { CustomerController } from './customer/customer.controller';
import { AuthModule } from 'src/auth/auth.module';
import { GeoModule } from 'src/geo/geo.module';
import { NotificationModule } from 'src/notification/notification.module';
import { OtpModule } from 'src/otp/otp.module';
import { AdminCustomerService } from './admin-customer/admin-customer.service';
import { AdminCustomerController } from './admin-customer/admin-customer.controller';
import { StarterBundlesModule } from 'src/starter-bundles/starter-bundles.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
    AuthModule,
    OtpModule,
    GeoModule,
    NotificationModule,
    StarterBundlesModule,
  ],
  controllers: [
    FranchiseController,
    AdminFranchiseController,
    CustomerController,
    AdminCustomerController,
  ],
  providers: [
    FranchiseService,
    AdminFranchiseService,
    CustomerService,
    AdminCustomerService,
  ],
})
export class UsersModule {}
