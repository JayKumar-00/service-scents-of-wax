import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { BaseReportBuilder } from '../builders/base-report.builder';
import { OrderReportBuilder } from '../builders/order-report.builder';
import { ProductReportBuilder } from '../builders/product-report.builder';
import { CustomerReportBuilder } from '../builders/customer-report.builder';
import { InventoryReportBuilder } from '../builders/inventory-report.builder';
import { CreditReportBuilder } from '../builders/credit-report.builder';
import { PayoutReportBuilder } from '../builders/payout-report.builder';
import { FranchiseReportBuilder } from '../builders/franchise-report.builder';
import { StaffReportBuilder } from '../builders/staff-report.builder';
import { InvoiceReportBuilder } from '../builders/invoice-report.builder';
import { PaymentReportBuilder } from '../builders/payment-report.builder';
import { TransactionReportBuilder } from '../builders/transaction-report.builder';
import { LoyaltyReportBuilder } from '../builders/loyalty-report.builder';
import { LoyaltyTransactionReportBuilder } from '../builders/loyalty-transaction-report.builder';
import { NewsletterSubscriberReportBuilder } from '../builders/newsletter-subscriber-report.builder';
import { ReferralReportBuilder } from '../builders/referral-report.builder';
import { RetentionReportBuilder } from '../builders/retention-report.builder';
import { SettlementReportBuilder } from '../builders/settlement-report.builder';
import { ReportMetadata } from '../interfaces/report.interface';
import { Prisma } from '@prisma/client';
import { GenericReportBuilder } from '../builders/generic-report.builder';
import { mapModuleToPrismaModel } from '../constants/report.constants';

@Injectable()
export class ReportService implements OnModuleInit {
  private readonly registry = new Map<string, BaseReportBuilder>();

  constructor(
    private readonly orderBuilder: OrderReportBuilder,
    private readonly productBuilder: ProductReportBuilder,
    private readonly customerBuilder: CustomerReportBuilder,
    private readonly inventoryBuilder: InventoryReportBuilder,
    private readonly creditBuilder: CreditReportBuilder,
    private readonly payoutBuilder: PayoutReportBuilder,
    private readonly franchiseBuilder: FranchiseReportBuilder,
    private readonly staffBuilder: StaffReportBuilder,
    private readonly invoiceBuilder: InvoiceReportBuilder,
    private readonly paymentBuilder: PaymentReportBuilder,
    private readonly transactionBuilder: TransactionReportBuilder,
    private readonly loyaltyBuilder: LoyaltyReportBuilder,
    private readonly loyaltyTransactionBuilder: LoyaltyTransactionReportBuilder,
    private readonly newsletterSubscriberBuilder: NewsletterSubscriberReportBuilder,
    private readonly referralBuilder: ReferralReportBuilder,
    private readonly retentionBuilder: RetentionReportBuilder,
    private readonly settlementBuilder: SettlementReportBuilder,
  ) {}

  onModuleInit() {
    this.register(this.orderBuilder);
    this.register(this.productBuilder);
    this.register(this.customerBuilder);
    this.register(this.inventoryBuilder);
    this.register(this.creditBuilder);
    this.register(this.payoutBuilder);
    this.register(this.franchiseBuilder);
    this.register(this.staffBuilder);
    this.register(this.invoiceBuilder);
    this.register(this.paymentBuilder);
    this.register(this.transactionBuilder);
    this.register(this.loyaltyBuilder);
    this.register(this.loyaltyTransactionBuilder);
    this.register(this.newsletterSubscriberBuilder);
    this.register(this.referralBuilder);
    this.register(this.retentionBuilder);
    this.register(this.settlementBuilder);
  }

  private register(builder: BaseReportBuilder) {
    this.registry.set(builder.getModuleName().toLowerCase(), builder);
  }

  public getBuilder(moduleName: string): BaseReportBuilder {
    const key = moduleName.toLowerCase();
    let builder = this.registry.get(key);
    if (!builder) {
      const prismaModelName = mapModuleToPrismaModel(key);
      const modelExists = Prisma.dmmf.datamodel.models.some(
        (m) => m.name.toLowerCase() === prismaModelName.toLowerCase(),
      );

      if (modelExists) {
        builder = new GenericReportBuilder(moduleName, prismaModelName);
        this.registry.set(key, builder);
      }
    }

    if (!builder) {
      throw new NotFoundException(
        `Reporting module '${moduleName}' is not registered or supported.`,
      );
    }
    return builder;
  }

  public getMetadata(moduleName: string): ReportMetadata {
    const builder = this.getBuilder(moduleName);

    const fieldCategories: Record<string, string[]> = {};
    for (const field of builder.getAvailableFields()) {
      if (!fieldCategories[field.category]) {
        fieldCategories[field.category] = [];
      }
      fieldCategories[field.category].push(field.key);
    }

    return {
      module: builder.getModuleName(),
      title: builder.getTitle(),
      defaultFields: builder.getDefaultFields(),
      availableFields: builder.getAvailableFields().map((f) => ({
        key: f.key,
        label: f.label,
      })),
      fieldCategories,
      filters: builder.getFilters(),
      supportedFormats: ['html', 'pdf', 'xlsx'],
    };
  }

  public getRegisteredModules(): string[] {
    return Array.from(this.registry.keys());
  }
}
