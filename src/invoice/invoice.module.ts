import { Module, Global, forwardRef } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { FinancialModule } from 'src/financial/financial.module';

@Global()
@Module({
  imports: [forwardRef(() => FinancialModule)],
  providers: [InvoiceService],
  controllers: [InvoiceController],
  exports: [InvoiceService],
})
export class InvoiceModule {}
