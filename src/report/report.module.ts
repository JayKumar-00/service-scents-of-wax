import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportController } from './controllers/report.controller';
import { ReportService } from './services/report.service';
import { ReportQueryService } from './services/report-query.service';
import { ReportExportService } from './services/report-export.service';
import { OrderReportBuilder } from './builders/order-report.builder';
import { ProductReportBuilder } from './builders/product-report.builder';
import { CustomerReportBuilder } from './builders/customer-report.builder';
import { InventoryReportBuilder } from './builders/inventory-report.builder';
import { CreditReportBuilder } from './builders/credit-report.builder';
import { PayoutReportBuilder } from './builders/payout-report.builder';
import { FranchiseReportBuilder } from './builders/franchise-report.builder';
import { StaffReportBuilder } from './builders/staff-report.builder';
import { InvoiceReportBuilder } from './builders/invoice-report.builder';
import { PaymentReportBuilder } from './builders/payment-report.builder';
import { TransactionReportBuilder } from './builders/transaction-report.builder';
import { LoyaltyReportBuilder } from './builders/loyalty-report.builder';
import { LoyaltyTransactionReportBuilder } from './builders/loyalty-transaction-report.builder';
import { NewsletterSubscriberReportBuilder } from './builders/newsletter-subscriber-report.builder';
import { ReferralReportBuilder } from './builders/referral-report.builder';
import { RetentionReportBuilder } from './builders/retention-report.builder';
import { SettlementReportBuilder } from './builders/settlement-report.builder';

@Module({
  imports: [PrismaModule],
  controllers: [ReportController],
  providers: [
    ReportService,
    ReportQueryService,
    ReportExportService,
    OrderReportBuilder,
    ProductReportBuilder,
    CustomerReportBuilder,
    InventoryReportBuilder,
    CreditReportBuilder,
    PayoutReportBuilder,
    FranchiseReportBuilder,
    StaffReportBuilder,
    InvoiceReportBuilder,
    PaymentReportBuilder,
    TransactionReportBuilder,
    LoyaltyReportBuilder,
    LoyaltyTransactionReportBuilder,
    NewsletterSubscriberReportBuilder,
    ReferralReportBuilder,
    RetentionReportBuilder,
    SettlementReportBuilder,
  ],
  exports: [
    ReportService,
    ReportQueryService,
    OrderReportBuilder,
    ProductReportBuilder,
    CustomerReportBuilder,
    InventoryReportBuilder,
    CreditReportBuilder,
    PayoutReportBuilder,
    FranchiseReportBuilder,
    StaffReportBuilder,
    InvoiceReportBuilder,
    PaymentReportBuilder,
    TransactionReportBuilder,
    LoyaltyReportBuilder,
    LoyaltyTransactionReportBuilder,
    NewsletterSubscriberReportBuilder,
    ReferralReportBuilder,
    RetentionReportBuilder,
    SettlementReportBuilder,
  ],
})
export class ReportModule {}
