import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FinancialReportQueryDto } from '../dto/report-query.dto';
import {
  InvoiceType,
  ReturnType,
  RefundStatus,
  RefundMethod,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(query: FinancialReportQueryDto) {
    const whereClause: Prisma.InvoiceWhereInput = {
      isDeleted: false,
      type: {
        in: [
          InvoiceType.PAYMENT,
          InvoiceType.DEBIT_NOTE,
          InvoiceType.CREDIT_NOTE,
        ],
      },
    };

    this.applyInvoiceFilters(whereClause, query);

    const invoices = await this.prisma.invoice.findMany({
      where: whereClause,
      include: {
        order: true,
      },
    });

    let paymentTotal = new Prisma.Decimal(0);
    let debitNoteTotal = new Prisma.Decimal(0);
    let creditNoteTotal = new Prisma.Decimal(0);

    for (const inv of invoices) {
      const amount = inv.grandTotal;
      if (inv.type === InvoiceType.PAYMENT) {
        paymentTotal = paymentTotal.add(amount);
      } else if (inv.type === InvoiceType.DEBIT_NOTE) {
        debitNoteTotal = debitNoteTotal.add(amount);
      } else if (inv.type === InvoiceType.CREDIT_NOTE) {
        creditNoteTotal = creditNoteTotal.add(amount);
      }
    }

    const netSales = paymentTotal.add(debitNoteTotal).sub(creditNoteTotal);

    return {
      summary: {
        paymentTotal: paymentTotal.toNumber(),
        debitNoteTotal: debitNoteTotal.toNumber(),
        creditNoteTotal: creditNoteTotal.toNumber(),
        netSales: netSales.toNumber(),
        count: invoices.length,
      },
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        grandTotal: inv.grandTotal.toNumber(),
        issuedAt: inv.issuedAt,
        buyerName: inv.buyerName,
        orderId: inv.orderId,
      })),
    };
  }

  async getReturnsReport(query: FinancialReportQueryDto) {
    const whereClause: Prisma.ReturnRequestWhereInput = {};

    if (query.fromDate || query.toDate) {
      whereClause.createdAt = {
        ...(query.fromDate && { gte: new Date(query.fromDate) }),
        ...(query.toDate && { lte: new Date(query.toDate) }),
      };
    }

    if (query.franchiseId) {
      whereClause.franchiseId = query.franchiseId;
    }

    if (query.returnType) {
      whereClause.returnType = query.returnType;
    }

    if (query.customerId) {
      whereClause.requestedById = query.customerId;
    }

    if (query.channel || query.paymentMode) {
      whereClause.order = {
        ...(query.channel && { channel: query.channel }),
        ...(query.paymentMode && { paymentMode: query.paymentMode }),
      };
    }

    const returnRequests = await this.prisma.returnRequest.findMany({
      where: whereClause,
      include: {
        items: true,
        order: true,
      },
    });

    const statusBreakdown: Record<string, number> = {};
    let totalItemsReturned = 0;

    for (const req of returnRequests) {
      statusBreakdown[req.status] = (statusBreakdown[req.status] || 0) + 1;
      for (const item of req.items) {
        totalItemsReturned += item.requestedQty;
      }
    }

    return {
      summary: {
        count: returnRequests.length,
        totalItemsReturned,
        statusBreakdown,
      },
      returns: returnRequests.map((req) => ({
        id: req.id,
        returnNumber: req.returnNumber,
        returnType: req.returnType,
        status: req.status,
        createdAt: req.createdAt,
        itemsCount: req.items.length,
        orderNumber: req.order?.orderNumber,
      })),
    };
  }

  async getRefundsReport(query: FinancialReportQueryDto) {
    const whereClause: Prisma.RefundWhereInput = {};

    if (query.fromDate || query.toDate) {
      whereClause.createdAt = {
        ...(query.fromDate && { gte: new Date(query.fromDate) }),
        ...(query.toDate && { lte: new Date(query.toDate) }),
      };
    }

    if (query.refundMethod) {
      whereClause.method = query.refundMethod;
    }

    if (query.refundStatus) {
      whereClause.status = query.refundStatus;
    }

    if (query.franchiseId || query.customerId || query.channel) {
      whereClause.returnRequest = {
        ...(query.franchiseId && { franchiseId: query.franchiseId }),
        ...(query.customerId && { requestedById: query.customerId }),
        ...(query.channel && {
          order: {
            channel: query.channel,
          },
        }),
      };
    }

    const refunds = await this.prisma.refund.findMany({
      where: whereClause,
      include: {
        returnRequest: true,
      },
    });

    let totalRefunded = new Prisma.Decimal(0);
    const statusBreakdown: Record<string, number> = {};
    const methodBreakdown: Record<string, number> = {};

    for (const rf of refunds) {
      if (rf.status === RefundStatus.PROCESSED) {
        totalRefunded = totalRefunded.add(rf.amount);
      }
      statusBreakdown[rf.status] = (statusBreakdown[rf.status] || 0) + 1;
      methodBreakdown[rf.method] = (methodBreakdown[rf.method] || 0) + 1;
    }

    return {
      summary: {
        count: refunds.length,
        totalRefunded: totalRefunded.toNumber(),
        statusBreakdown,
        methodBreakdown,
      },
      refunds: refunds.map((rf) => ({
        id: rf.id,
        refundNumber: rf.refundNumber,
        amount: rf.amount.toNumber(),
        method: rf.method,
        status: rf.status,
        processedAt: rf.processedAt,
        createdAt: rf.createdAt,
      })),
    };
  }

  async getCreditNotesReport(query: FinancialReportQueryDto) {
    const whereClause: Prisma.InvoiceWhereInput = {
      isDeleted: false,
      type: InvoiceType.CREDIT_NOTE,
    };

    this.applyInvoiceFilters(whereClause, query);

    const creditNotes = await this.prisma.invoice.findMany({
      where: whereClause,
    });

    const totalValue = creditNotes.reduce(
      (sum, cn) => sum.add(cn.grandTotal),
      new Prisma.Decimal(0),
    );

    return {
      summary: {
        count: creditNotes.length,
        totalValue: totalValue.toNumber(),
      },
      creditNotes: creditNotes.map((cn) => ({
        id: cn.id,
        invoiceNumber: cn.invoiceNumber,
        grandTotal: cn.grandTotal.toNumber(),
        issuedAt: cn.issuedAt,
        buyerName: cn.buyerName,
        returnRequestId: cn.returnRequestId,
      })),
    };
  }

  async getExchangesReport(query: FinancialReportQueryDto) {
    const whereClause: Prisma.InvoiceWhereInput = {
      isDeleted: false,
      type: {
        in: [InvoiceType.EXCHANGE_MEMO, InvoiceType.EXCHANGE_RECEIPT],
      },
    };

    this.applyInvoiceFilters(whereClause, query);

    const invoices = await this.prisma.invoice.findMany({
      where: whereClause,
    });

    let exchangeMemoTotal = new Prisma.Decimal(0);
    let exchangeReceiptTotal = new Prisma.Decimal(0);
    let exchangeMemoCount = 0;
    let exchangeReceiptCount = 0;

    for (const inv of invoices) {
      if (inv.type === InvoiceType.EXCHANGE_MEMO) {
        exchangeMemoTotal = exchangeMemoTotal.add(inv.grandTotal);
        exchangeMemoCount++;
      } else {
        exchangeReceiptTotal = exchangeReceiptTotal.add(inv.grandTotal);
        exchangeReceiptCount++;
      }
    }

    return {
      summary: {
        count: invoices.length,
        exchangeMemoCount,
        exchangeReceiptCount,
        exchangeMemoTotal: exchangeMemoTotal.toNumber(),
        exchangeReceiptTotal: exchangeReceiptTotal.toNumber(),
        totalExchangeValue: exchangeMemoTotal
          .add(exchangeReceiptTotal)
          .toNumber(),
      },
      exchanges: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        grandTotal: inv.grandTotal.toNumber(),
        issuedAt: inv.issuedAt,
        buyerName: inv.buyerName,
      })),
    };
  }

  async getReceiptsReport(query: FinancialReportQueryDto) {
    const whereClause: Prisma.InvoiceWhereInput = {
      isDeleted: false,
      type: {
        in: [InvoiceType.REFUND_RECEIPT, InvoiceType.EXCHANGE_RECEIPT],
      },
    };

    this.applyInvoiceFilters(whereClause, query);

    const invoices = await this.prisma.invoice.findMany({
      where: whereClause,
    });

    let refundReceiptTotal = new Prisma.Decimal(0);
    let exchangeReceiptTotal = new Prisma.Decimal(0);
    let refundReceiptCount = 0;
    let exchangeReceiptCount = 0;

    for (const inv of invoices) {
      if (inv.type === InvoiceType.REFUND_RECEIPT) {
        refundReceiptTotal = refundReceiptTotal.add(inv.grandTotal);
        refundReceiptCount++;
      } else {
        exchangeReceiptTotal = exchangeReceiptTotal.add(inv.grandTotal);
        exchangeReceiptCount++;
      }
    }

    return {
      summary: {
        count: invoices.length,
        refundReceiptCount,
        exchangeReceiptCount,
        refundReceiptTotal: refundReceiptTotal.toNumber(),
        exchangeReceiptTotal: exchangeReceiptTotal.toNumber(),
        totalReceiptsValue: refundReceiptTotal
          .add(exchangeReceiptTotal)
          .toNumber(),
      },
      receipts: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        grandTotal: inv.grandTotal.toNumber(),
        issuedAt: inv.issuedAt,
        buyerName: inv.buyerName,
      })),
    };
  }

  private applyInvoiceFilters(
    whereClause: Prisma.InvoiceWhereInput,
    query: FinancialReportQueryDto,
  ) {
    if (query.fromDate || query.toDate) {
      whereClause.issuedAt = {
        ...(query.fromDate && { gte: new Date(query.fromDate) }),
        ...(query.toDate && { lte: new Date(query.toDate) }),
      };
    }

    if (
      query.franchiseId ||
      query.customerId ||
      query.retailCustomerId ||
      query.channel ||
      query.paymentMode
    ) {
      whereClause.order = {
        ...(query.franchiseId && { franchiseId: query.franchiseId }),
        ...(query.customerId && { customerId: query.customerId }),
        ...(query.retailCustomerId && {
          retailCustomerId: query.retailCustomerId,
        }),
        ...(query.channel && { channel: query.channel }),
        ...(query.paymentMode && { paymentMode: query.paymentMode }),
      };
    }

    if (query.returnType) {
      whereClause.returnRequest = {
        returnType: query.returnType,
      };
    }
  }
}
