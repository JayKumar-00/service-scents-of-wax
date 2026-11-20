import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { SupplierReturnsController } from './supplier-returns.controller';
import { SupplierReturnsService } from './supplier-returns.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SupplierReturnsController],
  providers: [SupplierReturnsService],
})
export class SupplierReturnsModule { }
