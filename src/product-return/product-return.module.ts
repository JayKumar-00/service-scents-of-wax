import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductReturnService } from './product-return.service';
import { ProductReturnController } from './product-return.controller';

@Module({
  imports: [PrismaModule],
  providers: [ProductReturnService],
  controllers: [ProductReturnController],
})
export class ProductReturnModule {}
