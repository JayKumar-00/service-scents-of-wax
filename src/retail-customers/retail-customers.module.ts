import { Module } from '@nestjs/common';
import { OrdersModule } from 'src/orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RetailCustomersController } from './retail-customers.controller';
import { RetailCustomersService } from './retail-customers.service';

@Module({
  imports: [PrismaModule, OrdersModule],
  controllers: [RetailCustomersController],
  providers: [RetailCustomersService],
})
export class RetailCustomersModule {}
