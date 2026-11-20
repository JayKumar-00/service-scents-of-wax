import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers/suppliers.controller';
import { SuppliersService } from './suppliers/suppliers.service';
import { PurchaseOrdersController } from './purchase-orders/purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders/purchase-orders.service';
import { AsnController } from './asn/asn.controller';
import { AsnService } from './asn/asn.service';
import { GrnController } from './grn/grn.controller';
import { GrnService } from './grn/grn.service';
import { QcController } from './qc/qc.controller';
import { QcService } from './qc/qc.service';
import { ProcurementDashboardService } from './dashboard/dashboard.service';
import { ProcurementEventsService } from './events/procurement-events.service';
import { LedgerService } from './ledger/ledger.service';
import { ValuationService } from './valuation/valuation.service';
import { LedgerController } from './ledger/ledger.controller';
import { SupplierReturnsModule } from './supplier-returns/supplier-returns.module';

@Module({
  imports: [SupplierReturnsModule],
  controllers: [
    LedgerController,
    SuppliersController,
    PurchaseOrdersController,
    AsnController,
    GrnController,
    QcController,
  ],
  providers: [
    SuppliersService,
    PurchaseOrdersService,
    AsnService,
    GrnService,
    QcService,
    LedgerService,
    ValuationService,
    ProcurementDashboardService,
    ProcurementEventsService,
  ],
  exports: [
    SuppliersService,
    PurchaseOrdersService,
    AsnService,
    GrnService,
    LedgerService,
    ValuationService,
  ],
})
export class ProcurementModule {}
