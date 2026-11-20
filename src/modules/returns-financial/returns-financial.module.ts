import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReturnsV2Module } from '../returns-v2/returns-v2.module';
import { FinancialModule } from '../../financial/financial.module';
import { UploadsModule } from '../../uploads/uploads.module';
import { CreditNoteController } from './controllers/credit-note.controller';
import { RefundController } from './controllers/refund.controller';
import { ExchangeExtensionController } from './controllers/exchange-extension.controller';
import { ReportingController } from './controllers/reporting.controller';
import { CreditNoteService } from './services/credit-note.service';
import { RefundExtensionService } from './services/refund-extension.service';
import { ExchangeExtensionService } from './services/exchange-extension.service';
import { ReportingService } from './services/reporting.service';

@Module({
  imports: [PrismaModule, ReturnsV2Module, FinancialModule, UploadsModule],
  controllers: [
    CreditNoteController,
    RefundController,
    ExchangeExtensionController,
    ReportingController,
  ],
  providers: [
    CreditNoteService,
    RefundExtensionService,
    ExchangeExtensionService,
    ReportingService,
  ],
  exports: [
    CreditNoteService,
    RefundExtensionService,
    ExchangeExtensionService,
    ReportingService,
  ],
})
export class ReturnsFinancialModule {}
