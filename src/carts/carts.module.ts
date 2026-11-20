import { Module } from '@nestjs/common';
import { CartsService } from './carts.service';
import { CartController } from './carts.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [CartController],
  providers: [CartsService, PrismaService],
  exports: [CartsService],
})
export class CartsModule {}
