import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReturnsV2Controller } from './controllers/returns-v2.controller';
import { ReturnRequestService } from './services/return-request.service';
import { ReturnWorkflowService } from './services/return-workflow.service';
import { ReturnInspectionService } from './services/return-inspection.service';
import { ReturnInventoryService } from './services/return-inventory.service';
import { ReturnRefundService } from './services/return-refund.service';
import { ReturnExchangeService } from './services/return-exchange.service';
import { UploadsModule } from 'src/uploads/uploads.module';
import { NotificationModule } from 'src/notification/notification.module';
import { FinancialModule } from 'src/financial/financial.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    UploadsModule,
    NotificationModule,
    FinancialModule,
  ],
  controllers: [ReturnsV2Controller],
  providers: [
    ReturnRequestService,
    ReturnWorkflowService,
    ReturnInspectionService,
    ReturnInventoryService,
    ReturnRefundService,
    ReturnExchangeService,
  ],
  exports: [
    ReturnRequestService,
    ReturnWorkflowService,
    ReturnInspectionService,
    ReturnInventoryService,
    ReturnRefundService,
    ReturnExchangeService,
  ],
})
export class ReturnsV2Module {}
