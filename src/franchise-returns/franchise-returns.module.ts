import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FranchiseReturnsController } from './franchise-returns.controller';
import { FranchiseReturnsService } from './franchise-returns.service';

@Module({
  imports: [PrismaModule],
  controllers: [FranchiseReturnsController],
  providers: [FranchiseReturnsService],
})
export class FranchiseReturnsModule {}
