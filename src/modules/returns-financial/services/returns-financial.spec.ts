import { Test, TestingModule } from '@nestjs/testing';
import { CreditNoteService } from './credit-note.service';
import { RefundExtensionService } from './refund-extension.service';
import { ExchangeExtensionService } from './exchange-extension.service';
import { ReportingService } from './reporting.service';
import { UploadsService } from 'src/uploads/uploads.service';
import { ReturnExchangeService } from '../../returns-v2/services/return-exchange.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { RazorpayService } from 'src/financial/payment/razorpay.service';
import {
  InvoiceType,
  ReturnStatus,
  ReturnType,
  InvoiceStatus,
  InvoicePaymentStatus,
  RefundStatus,
  RefundMethod,
  PaymentModeEnum,
  Role,
  Prisma,
  OnlinePaymentStatus,
} from '@prisma/client';

describe('Returns Financial Layer Extension Services', () => {
  let creditNoteService: CreditNoteService;
  let refundService: RefundExtensionService;
  let exchangeService: ExchangeExtensionService;
  let reportingService: ReportingService;

  // In-memory db collections
  let dbReturnRequests: any[] = [];
  let dbInvoices: any[] = [];
  let dbRefunds: any[] = [];
  let dbOrders: any[] = [];
  let dbProducts: any[] = [];
  let dbRetentionSnapshots: any[] = [];
  let dbLoyaltyTransactions: any[] = [];
  let dbReturnItems: any[] = [];

  const mockUser: JwtUser = {
    sub: 'user_123',
    email: 'admin@giftfactory.com',
    role: Role.SUPERADMIN,
  };

  const mockPrisma: any = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    returnRequest: {
      findUnique: jest.fn(({ where }) =>
        dbReturnRequests.find((r) => r.id === where.id),
      ),
      update: jest.fn(({ where, data }) => {
        const index = dbReturnRequests.findIndex((r) => r.id === where.id);
        if (index !== -1) {
          Object.assign(dbReturnRequests[index], data);
          return dbReturnRequests[index];
        }
        return null;
      }),
    },
    invoice: {
      findUnique: jest.fn(({ where }) =>
        dbInvoices.find(
          (i) =>
            (where.id && i.id === where.id) ||
            (where.invoiceNumber && i.invoiceNumber === where.invoiceNumber),
        ),
      ),
      findFirst: jest.fn(({ where }) => {
        return dbInvoices.find((i) => {
          if (
            where.returnRequestId &&
            i.returnRequestId !== where.returnRequestId
          )
            return false;
          if (where.type) {
            if (typeof where.type === 'object' && where.type.in) {
              if (!where.type.in.includes(i.type)) return false;
            } else if (i.type !== where.type) {
              return false;
            }
          }
          if (where.orderId && i.orderId !== where.orderId) return false;
          if (where.isDeleted !== undefined && i.isDeleted !== where.isDeleted)
            return false;
          return true;
        });
      }),
      findMany: jest.fn(({ where }) => {
        return dbInvoices.filter((i) => {
          if (
            where?.parentInvoiceId &&
            i.parentInvoiceId !== where.parentInvoiceId
          )
            return false;
          if (where?.type) {
            if (where.type.in) {
              if (!where.type.in.includes(i.type)) return false;
            } else if (i.type !== where.type) {
              return false;
            }
          }
          if (where?.isDeleted !== undefined && i.isDeleted !== where.isDeleted)
            return false;
          return true;
        });
      }),
      create: jest.fn(({ data }) => {
        const newInvoice: any = {
          id: `inv_${Date.now()}_${Math.random()}`,
          isDeleted: false,
          issuedAt: new Date(),
          ...data,
          grandTotal: new Prisma.Decimal(data.grandTotal ?? 0),
          subtotal: new Prisma.Decimal(data.subtotal ?? 0),
          gst: new Prisma.Decimal(data.gst ?? 0),
        };
        if (data.returnRequest?.connect?.id) {
          newInvoice.returnRequestId = data.returnRequest.connect.id;
        }
        if (data.parentInvoice?.connect?.id) {
          newInvoice.parentInvoiceId = data.parentInvoice.connect.id;
        }
        if (data.order?.connect?.id) {
          newInvoice.orderId = data.order.connect.id;
        }
        dbInvoices.push(newInvoice);
        return newInvoice;
      }),
      count: jest.fn(() => 0),
    },
    refund: {
      findUnique: jest.fn(({ where }) => {
        const r = dbRefunds.find((ref) => ref.id === where.id);
        if (!r) return null;
        const returnReq = dbReturnRequests.find((req) => req.id === r.returnId);
        return {
          ...r,
          returnRequest: returnReq
            ? {
                ...returnReq,
                order:
                  dbOrders.find((ord) => ord.id === returnReq.orderId) ??
                  returnReq.order,
              }
            : undefined,
          invoice:
            dbInvoices.find((inv) => inv.id === r.invoiceId) ??
            (returnReq ? returnReq.invoice : undefined),
        };
      }),
      findMany: jest.fn(({ where }) => {
        return dbRefunds.filter((r) => {
          if (where?.invoiceId && r.invoiceId !== where.invoiceId) return false;
          if (where?.status?.in && !where.status.in.includes(r.status))
            return false;
          return true;
        });
      }),
      create: jest.fn(({ data }) => {
        const newRefund = {
          id: `ref_${Date.now()}_${Math.random()}`,
          createdAt: new Date(),
          ...data,
          amount: new Prisma.Decimal(data.amount ?? 0),
        };
        dbRefunds.push(newRefund);
        return newRefund;
      }),
      update: jest.fn(({ where, data }) => {
        const index = dbRefunds.findIndex((r) => r.id === where.id);
        if (index !== -1) {
          Object.assign(dbRefunds[index], data);
          return dbRefunds[index];
        }
        return null;
      }),
      count: jest.fn(() => 0),
    },
    order: {
      findUnique: jest.fn(({ where }) =>
        dbOrders.find((o) => o.id === where.id),
      ),
      create: jest.fn(({ data }) => {
        const newOrder = {
          id: `ord_${Date.now()}_${Math.random()}`,
          createdAt: new Date(),
          ...data,
          total: new Prisma.Decimal(data.total ?? 0),
        };
        dbOrders.push(newOrder);
        return newOrder;
      }),
    },
    product: {
      findUnique: jest.fn(({ where }) =>
        dbProducts.find((p) => p.id === where.id),
      ),
    },
    retentionSnapshot: {
      findUnique: jest.fn(({ where }) =>
        dbRetentionSnapshots.find((s) => s.customerId === where.customerId),
      ),
      update: jest.fn(({ where, data }) => {
        const idx = dbRetentionSnapshots.findIndex(
          (s) => s.customerId === where.customerId,
        );
        if (idx !== -1) {
          const s = dbRetentionSnapshots[idx];
          if (data.loyaltyPoints?.increment) {
            s.loyaltyPoints += data.loyaltyPoints.increment;
          }
          if (data.engagementCount?.increment) {
            s.engagementCount += data.engagementCount.increment;
          }
          return s;
        }
        return null;
      }),
      create: jest.fn(({ data }) => {
        const s = { ...data };
        dbRetentionSnapshots.push(s);
        return s;
      }),
    },
    loyaltyTransaction: {
      create: jest.fn(({ data }) => {
        const t = { id: `lt_${Date.now()}`, createdAt: new Date(), ...data };
        dbLoyaltyTransactions.push(t);
        return t;
      }),
    },
    auditLog: {
      create: jest.fn(({ data }) => {
        return { id: `al_${Date.now()}`, createdAt: new Date(), ...data };
      }),
    },
    returnItem: {
      findMany: jest.fn(({ where }) => {
        return dbReturnItems
          .filter((item) => {
            if (where.productId && item.productId !== where.productId)
              return false;
            if (where.variantId && item.variantId !== where.variantId)
              return false;
            if (where.returnRequest) {
              const req = dbReturnRequests.find(
                (r) => r.id === item.returnRequestId,
              );
              if (!req) return false;
              if (
                where.returnRequest.orderId &&
                req.orderId !== where.returnRequest.orderId
              )
                return false;
              if (
                where.returnRequest.status?.not &&
                req.status === where.returnRequest.status.not
              )
                return false;
              if (
                where.returnRequest.id?.not &&
                req.id === where.returnRequest.id.not
              )
                return false;
            }
            return true;
          })
          .map((item) => ({
            ...item,
            returnRequest: dbReturnRequests.find(
              (r) => r.id === item.returnRequestId,
            ),
          }));
      }),
    },
  };

  const mockReturnExchangeService = {
    createExchangeOrder: jest.fn(async (tx, returnRequestId) => {
      const returnRequest = dbReturnRequests.find(
        (r) => r.id === returnRequestId,
      );
      const replacementTotal =
        returnRequest.returnType === ReturnType.SAME_PRODUCT_EXCHANGE
          ? 200
          : 300;
      const order = {
        id: `ord_ex_${Date.now()}`,
        orderNumber: `GF-EX-MOCK`,
        total: new Prisma.Decimal(replacementTotal),
        items: [
          {
            id: 'oi_ex',
            productId: 'prod_replacement',
            productName: 'Replacement Product',
            quantity: 1,
            unitPrice: new Prisma.Decimal(replacementTotal),
            gstPercent: new Prisma.Decimal(18),
            finalAmount: new Prisma.Decimal(replacementTotal),
            taxAmount: new Prisma.Decimal(0),
          },
        ],
      };
      dbOrders.push(order);
      returnRequest.exchangeOrderId = order.id;
      return order;
    }),
  };

  beforeEach(async () => {
    dbReturnRequests = [];
    dbInvoices = [];
    dbRefunds = [];
    dbOrders = [];
    dbRetentionSnapshots = [];
    dbLoyaltyTransactions = [];
    dbReturnItems = [];
    dbProducts = [
      {
        id: 'prod_replacement',
        name: 'Replacement Product',
        price: 100,
        variants: [],
      },
    ];

    const mockRazorpayService = {
      refundPayment: jest.fn().mockResolvedValue({ id: 'rp_refund_123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditNoteService,
        RefundExtensionService,
        ExchangeExtensionService,
        ReportingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReturnExchangeService, useValue: mockReturnExchangeService },
        { provide: RazorpayService, useValue: mockRazorpayService },
        {
          provide: UploadsService,
          useValue: {
            getObjectUrl: jest.fn(
              (file: string) => `https://cloudfront.net/${file}`,
            ),
          },
        },
      ],
    }).compile();

    creditNoteService = module.get<CreditNoteService>(CreditNoteService);
    refundService = module.get<RefundExtensionService>(RefundExtensionService);
    exchangeService = module.get<ExchangeExtensionService>(
      ExchangeExtensionService,
    );
    reportingService = module.get<ReportingService>(ReportingService);
  });

  describe('Credit Note generation', () => {
    it('should generate a credit note for a valid REFUND request in QC_PASSED state', async () => {
      const parentInvoice = {
        id: 'inv_1',
        invoiceNumber: 'GF-PAY-1',
        type: InvoiceType.PAYMENT,
        orderId: 'ord_1',
        grandTotal: new Prisma.Decimal(500),
        subtotal: new Prisma.Decimal(450),
        gst: new Prisma.Decimal(50),
        isDeleted: false,
      };
      dbInvoices.push(parentInvoice);

      const returnRequest = {
        id: 'ret_1',
        returnNumber: 'GFR-1',
        returnType: ReturnType.REFUND,
        status: ReturnStatus.QC_PASSED,
        orderId: 'ord_1',
        items: [{ productId: 'prod_1', approvedQty: 2, unitPrice: 100 }],
        order: {
          items: [
            {
              productId: 'prod_1',
              productName: 'Prod 1',
              quantity: 5,
              unitPrice: 100,
              gstPercent: 18,
            },
          ],
        },
      };
      dbReturnRequests.push(returnRequest);

      const cn = await creditNoteService.createCreditNote(
        parentInvoice.invoiceNumber,
        { returnRequestId: returnRequest.id, remarks: 'Test Credit Note' },
        mockUser,
      );

      expect(cn).toBeDefined();
      expect(cn.type).toBe(InvoiceType.CREDIT_NOTE);
      expect(Number(cn.grandTotal)).toBe(236); // 200 + 36 tax (18%)
      expect(returnRequest.status).toBe(ReturnStatus.CREDIT_NOTE_GENERATED);
    });

    it('should throw BadRequestException if returnRequest is not of type REFUND', async () => {
      const parentInvoice = {
        id: 'inv_1',
        invoiceNumber: 'GF-PAY-1',
        type: InvoiceType.PAYMENT,
        isDeleted: false,
        orderId: 'ord_ex',
      };
      dbInvoices.push(parentInvoice);

      const returnRequest = {
        id: 'ret_ex',
        returnType: ReturnType.EXCHANGE,
        status: ReturnStatus.QC_PASSED,
        orderId: 'ord_ex',
        items: [],
      };
      dbReturnRequests.push(returnRequest);

      await expect(
        creditNoteService.createCreditNote(
          parentInvoice.invoiceNumber,
          { returnRequestId: returnRequest.id },
          mockUser,
        ),
      ).rejects.toThrow(
        'Credit Notes can only be generated for REFUND return requests.',
      );
    });
  });

  describe('Refund Extension Workflow', () => {
    it('should initiate refund request if credit note is generated and is not over-refunded', async () => {
      const parentInvoice = {
        id: 'inv_pay',
        orderId: 'ord_ref',
        invoiceNumber: 'GF-PAY-1',
        type: InvoiceType.PAYMENT,
        grandTotal: new Prisma.Decimal(500),
        isDeleted: false,
      };
      dbInvoices.push(parentInvoice);

      const creditNote = {
        id: 'inv_cn',
        type: InvoiceType.CREDIT_NOTE,
        grandTotal: new Prisma.Decimal(200),
        returnRequestId: 'ret_ref',
        isDeleted: false,
      };
      dbInvoices.push(creditNote);

      const returnRequest = {
        id: 'ret_ref',
        status: ReturnStatus.CREDIT_NOTE_GENERATED,
        orderId: 'ord_ref',
        items: [{ productId: 'prod_1', approvedQty: 2 }],
        order: {
          id: 'ord_ref',
          paymentMode: PaymentModeEnum.ONLINE,
          items: [
            {
              productId: 'prod_1',
              quantity: 5,
              finalAmount: new Prisma.Decimal(500),
            },
          ],
        },
      };
      dbReturnRequests.push(returnRequest);

      const refund = await refundService.createRefund(
        { returnId: returnRequest.id, method: RefundMethod.ORIGINAL_SOURCE },
        mockUser,
      );

      expect(refund).toBeDefined();
      expect(refund!.status).toBe(RefundStatus.PENDING);
      expect(Number(refund!.amount)).toBe(200);
    });

    it('should automatically generate credit note and initiate refund request if returnRequest status is QC_PASSED', async () => {
      const parentInvoice = {
        id: 'inv_pay_auto_cn',
        orderId: 'ord_ref_auto_cn',
        invoiceNumber: 'GF-PAY-AUTO-CN',
        type: InvoiceType.PAYMENT,
        grandTotal: new Prisma.Decimal(500),
        isDeleted: false,
      };
      dbInvoices.push(parentInvoice);

      const returnRequest = {
        id: 'ret_ref_auto_cn',
        status: ReturnStatus.QC_PASSED,
        returnType: ReturnType.REFUND,
        orderId: 'ord_ref_auto_cn',
        items: [{ productId: 'prod_1', approvedQty: 2 }],
        order: {
          id: 'ord_ref_auto_cn',
          paymentMode: PaymentModeEnum.ONLINE,
          items: [
            {
              productId: 'prod_1',
              productName: 'Prod 1',
              quantity: 5,
              unitPrice: new Prisma.Decimal(100),
              gstPercent: new Prisma.Decimal(18),
              finalAmount: new Prisma.Decimal(500),
            },
          ],
        },
      };
      dbReturnRequests.push(returnRequest);

      const refund = await refundService.createRefund(
        { returnId: returnRequest.id, method: RefundMethod.ORIGINAL_SOURCE },
        mockUser,
      );

      expect(refund).toBeDefined();
      expect(refund!.status).toBe(RefundStatus.PENDING);

      const autoCN = dbInvoices.find(
        (inv) =>
          inv.returnRequestId === returnRequest.id &&
          inv.type === InvoiceType.CREDIT_NOTE,
      );
      expect(autoCN).toBeDefined();
      expect(Number(autoCN.grandTotal)).toBe(236); // 200 + 36 tax (18%)
      expect(refund!.creditNoteId).toBe(autoCN.id);
      expect(returnRequest.status).toBe(ReturnStatus.REFUND_PROCESSED);
    });

    it('should throw BadRequestException for COD orders refunded to ORIGINAL_SOURCE', async () => {
      const parentInvoice = {
        id: 'inv_pay',
        orderId: 'ord_cod',
        type: InvoiceType.PAYMENT,
        grandTotal: new Prisma.Decimal(500),
        isDeleted: false,
      };
      dbInvoices.push(parentInvoice);

      const creditNote = {
        id: 'inv_cn',
        type: InvoiceType.CREDIT_NOTE,
        grandTotal: new Prisma.Decimal(200),
        returnRequestId: 'ret_cod',
        isDeleted: false,
      };
      dbInvoices.push(creditNote);

      const returnRequest = {
        id: 'ret_cod',
        status: ReturnStatus.CREDIT_NOTE_GENERATED,
        orderId: 'ord_cod',
        items: [{ productId: 'prod_1', approvedQty: 2 }],
        order: {
          id: 'ord_cod',
          paymentMode: PaymentModeEnum.COD,
          items: [
            {
              productId: 'prod_1',
              quantity: 5,
              finalAmount: new Prisma.Decimal(500),
            },
          ],
        },
      };
      dbReturnRequests.push(returnRequest);

      await expect(
        refundService.createRefund(
          { returnId: returnRequest.id, method: RefundMethod.ORIGINAL_SOURCE },
          mockUser,
        ),
      ).rejects.toThrow('ORIGINAL_SOURCE is not selectable for COD orders.');
    });

    it('should automatically use stored refund preference from ReturnRequest if method is not specified in dto', async () => {
      const parentInvoice = {
        id: 'inv_pay',
        orderId: 'ord_pref_test',
        invoiceNumber: 'GF-PAY-PREF',
        type: InvoiceType.PAYMENT,
        grandTotal: new Prisma.Decimal(500),
        isDeleted: false,
      };
      dbInvoices.push(parentInvoice);

      const creditNote = {
        id: 'inv_cn',
        type: InvoiceType.CREDIT_NOTE,
        grandTotal: new Prisma.Decimal(200),
        returnRequestId: 'ret_pref_test',
        isDeleted: false,
      };
      dbInvoices.push(creditNote);

      const returnRequest = {
        id: 'ret_pref_test',
        status: ReturnStatus.CREDIT_NOTE_GENERATED,
        orderId: 'ord_pref_test',
        refundReceivingSource: 'UPI',
        refundPreference: { upiId: 'customer@upi' },
        items: [{ productId: 'prod_1', approvedQty: 2 }],
        order: {
          id: 'ord_pref_test',
          paymentMode: PaymentModeEnum.ONLINE,
          items: [
            {
              productId: 'prod_1',
              quantity: 5,
              finalAmount: new Prisma.Decimal(500),
            },
          ],
        },
      };
      dbReturnRequests.push(returnRequest);

      const refund = await refundService.createRefund(
        { returnId: returnRequest.id },
        mockUser,
      );

      expect(refund).toBeDefined();
      expect(refund!.method).toBe('UPI');
      expect(refund!.status).toBe(RefundStatus.PENDING);
    });

    it('should process pending refund and generate refund receipt', async () => {
      const originalInvoice = {
        id: 'inv_pay',
        orderId: 'ord_ref',
        type: InvoiceType.PAYMENT,
        grandTotal: new Prisma.Decimal(500),
        isDeleted: false,
      };
      dbInvoices.push(originalInvoice);

      const refund = {
        id: 'ref_pending',
        refundNumber: 'GFRF-MOCK',
        amount: new Prisma.Decimal(200),
        status: RefundStatus.PENDING,
        invoiceId: originalInvoice.id,
        returnId: 'ret_ref',
        method: RefundMethod.UPI,
      };
      dbRefunds.push(refund);

      const returnRequest = {
        id: 'ret_ref',
        orderId: 'ord_ref',
        status: ReturnStatus.REFUND_PROCESSED,
        order: { id: 'ord_ref' },
      };
      dbReturnRequests.push(returnRequest);

      const res = await refundService.processRefund(refund.id, {
        remarks: 'Success',
      });

      expect(res.refund!.status).toBe(RefundStatus.PROCESSED);
      expect(res.receipt).toBeDefined();
      expect(res.receipt.type).toBe(InvoiceType.REFUND_RECEIPT);
      expect(returnRequest.status).toBe(ReturnStatus.CLOSED);
    });

    it('should credit loyalty points when processRefund is called for REWARDS method', async () => {
      const originalInvoice = {
        id: 'inv_pay_rewards',
        orderId: 'ord_rewards',
        type: InvoiceType.PAYMENT,
        grandTotal: new Prisma.Decimal(500),
        isDeleted: false,
      };
      dbInvoices.push(originalInvoice);

      const refund = {
        id: 'ref_rewards_pending',
        refundNumber: 'GFRF-REWARDS',
        amount: new Prisma.Decimal(200),
        status: RefundStatus.PENDING,
        invoiceId: originalInvoice.id,
        returnId: 'ret_rewards',
        method: RefundMethod.REWARDS,
      };
      dbRefunds.push(refund);

      const returnRequest = {
        id: 'ret_rewards',
        orderId: 'ord_rewards',
        status: ReturnStatus.REFUND_PROCESSED,
        returnNumber: 'RET-REWARDS-1',
        order: {
          id: 'ord_rewards',
          customerId: 'cust_loyalty_test',
        },
      };
      dbReturnRequests.push(returnRequest);

      const res = await refundService.processRefund(
        refund.id,
        { remarks: 'Points Credited' },
        mockUser,
      );

      expect(res.refund!.status).toBe(RefundStatus.PROCESSED);
      expect(res.refund!.conversionRate).toBe(10);
      expect(res.refund!.loyaltyPointsCredited).toBe(2000); // 200 * 10 = 2000
      expect(res.refund!.processedByUserId).toBe(mockUser.sub);

      // Verify retention snapshot has points credited
      const snapshot = dbRetentionSnapshots.find(
        (s) => s.customerId === 'cust_loyalty_test',
      );
      expect(snapshot).toBeDefined();
      expect(snapshot.loyaltyPoints).toBe(2000);

      // Verify loyalty transaction created
      const txn = dbLoyaltyTransactions.find(
        (t) => t.customerId === 'cust_loyalty_test',
      );
      expect(txn).toBeDefined();
      expect(txn.points).toBe(2000);
      expect(txn.type).toBe('REFUND');
    });

    describe('Automatic Calculations and Validation Constraints', () => {
      it('should calculate expectedRefundAmount based on approvedQty and net unit price', async () => {
        const parentInvoice = {
          id: 'inv_pay_calc',
          orderId: 'ord_calc',
          invoiceNumber: 'GF-PAY-CALC',
          type: InvoiceType.PAYMENT,
          grandTotal: new Prisma.Decimal(1000),
          isDeleted: false,
        };
        dbInvoices.push(parentInvoice);

        const creditNote = {
          id: 'inv_cn_calc',
          type: InvoiceType.CREDIT_NOTE,
          grandTotal: new Prisma.Decimal(600),
          returnRequestId: 'ret_calc',
          isDeleted: false,
        };
        dbInvoices.push(creditNote);

        const returnRequest = {
          id: 'ret_calc',
          status: ReturnStatus.CREDIT_NOTE_GENERATED,
          orderId: 'ord_calc',
          items: [
            { productId: 'p1', approvedQty: 2 },
            { productId: 'p2', approvedQty: 3 },
          ],
          order: {
            id: 'ord_calc',
            paymentMode: PaymentModeEnum.ONLINE,
            items: [
              {
                productId: 'p1',
                quantity: 4,
                finalAmount: new Prisma.Decimal(400),
              }, // net unit price = 100
              {
                productId: 'p2',
                quantity: 6,
                finalAmount: new Prisma.Decimal(600),
              }, // net unit price = 100
            ],
          },
        };
        dbReturnRequests.push(returnRequest);

        const refund = await refundService.createRefund(
          { returnId: returnRequest.id, method: RefundMethod.ORIGINAL_SOURCE },
          mockUser,
        );

        expect(refund).toBeDefined();
        expect(refund!.expectedRefundAmount).toBe(500); // 2 * 100 + 3 * 100 = 500
        expect(refund!.processedRefundAmount).toBe(500);
        expect(refund!.isOverridden).toBe(false);
      });

      it('should allow SUPERADMIN to override refund amount and enforce mandatory overrideReason', async () => {
        const parentInvoice = {
          id: 'inv_pay_override',
          orderId: 'ord_override',
          invoiceNumber: 'GF-PAY-OVERRIDE',
          type: InvoiceType.PAYMENT,
          grandTotal: new Prisma.Decimal(1000),
          isDeleted: false,
        };
        dbInvoices.push(parentInvoice);

        const creditNote = {
          id: 'inv_cn_override',
          type: InvoiceType.CREDIT_NOTE,
          grandTotal: new Prisma.Decimal(600),
          returnRequestId: 'ret_override',
          isDeleted: false,
        };
        dbInvoices.push(creditNote);

        const returnRequest = {
          id: 'ret_override',
          status: ReturnStatus.CREDIT_NOTE_GENERATED,
          orderId: 'ord_override',
          items: [{ productId: 'p1', approvedQty: 2 }],
          order: {
            id: 'ord_override',
            paymentMode: PaymentModeEnum.ONLINE,
            items: [
              {
                productId: 'p1',
                quantity: 4,
                finalAmount: new Prisma.Decimal(400),
              },
            ],
          },
        };
        dbReturnRequests.push(returnRequest);

        // Standard user try override -> should fail
        await expect(
          refundService.createRefund(
            {
              returnId: returnRequest.id,
              method: RefundMethod.ORIGINAL_SOURCE,
              overrideAmount: 300,
              overrideReason: 'Cust satisfaction',
            },
            { ...mockUser, role: Role.ADMIN_STAFF },
          ),
        ).rejects.toThrow(
          'Only SUPERADMIN is allowed to override the refund amount.',
        );

        // Superadmin try override without reason -> should fail
        await expect(
          refundService.createRefund(
            {
              returnId: returnRequest.id,
              method: RefundMethod.ORIGINAL_SOURCE,
              overrideAmount: 300,
              overrideReason: '',
            },
            mockUser,
          ),
        ).rejects.toThrow(
          'overrideReason is mandatory when overrideAmount is provided.',
        );

        // Superadmin override successful
        const refund = await refundService.createRefund(
          {
            returnId: returnRequest.id,
            method: RefundMethod.ORIGINAL_SOURCE,
            overrideAmount: 300,
            overrideReason: 'Cust satisfaction',
          },
          mockUser,
        );

        expect(refund).toBeDefined();
        expect(refund!.expectedRefundAmount).toBe(200);
        expect(refund!.processedRefundAmount).toBe(300);
        expect(refund!.isOverridden).toBe(true);
        expect(refund!.overrideReason).toBe('Cust satisfaction');
      });

      it('should enforce quantity clamping constraint to prevent over-refunding across multiple return requests', async () => {
        const parentInvoice = {
          id: 'inv_pay_clamp',
          orderId: 'ord_clamp',
          invoiceNumber: 'GF-PAY-CLAMP',
          type: InvoiceType.PAYMENT,
          grandTotal: new Prisma.Decimal(1000),
          isDeleted: false,
        };
        dbInvoices.push(parentInvoice);

        const creditNote = {
          id: 'inv_cn_clamp',
          type: InvoiceType.CREDIT_NOTE,
          grandTotal: new Prisma.Decimal(600),
          returnRequestId: 'ret_clamp_current',
          isDeleted: false,
        };
        dbInvoices.push(creditNote);

        // Existing return request that was already refunded
        const oldReturnRequest = {
          id: 'ret_clamp_old',
          status: ReturnStatus.REFUND_PROCESSED,
          returnType: ReturnType.REFUND,
          orderId: 'ord_clamp',
        };
        dbReturnRequests.push(oldReturnRequest);

        // The current return request
        const currentReturnRequest = {
          id: 'ret_clamp_current',
          status: ReturnStatus.CREDIT_NOTE_GENERATED,
          orderId: 'ord_clamp',
          items: [
            { productId: 'p1', approvedQty: 3 }, // 3 units requested for return
          ],
          order: {
            id: 'ord_clamp',
            paymentMode: PaymentModeEnum.ONLINE,
            items: [
              {
                productId: 'p1',
                quantity: 4,
                finalAmount: new Prisma.Decimal(400),
              }, // originally ordered 4
            ],
          },
        };
        dbReturnRequests.push(currentReturnRequest);

        // Set up already refunded items in dbReturnItems: 2 units already refunded in the old request
        dbReturnItems.push({
          productId: 'p1',
          approvedQty: 2,
          returnRequestId: 'ret_clamp_old',
        });

        // Remaining refundable is 4 - 2 = 2.
        // Current request asks for 3, which exceeds 2 -> should throw BadRequestException.
        await expect(
          refundService.createRefund(
            {
              returnId: currentReturnRequest.id,
              method: RefundMethod.ORIGINAL_SOURCE,
            },
            mockUser,
          ),
        ).rejects.toThrow(
          'Cannot refund more units than originally ordered minus already refunded and exchanged units.',
        );
      });

      it('should trigger Razorpay refund API on processRefund for ORIGINAL_SOURCE prepaid orders', async () => {
        const originalInvoice = {
          id: 'inv_pay_prepaid',
          orderId: 'ord_prepaid',
          type: InvoiceType.PAYMENT,
          grandTotal: new Prisma.Decimal(500),
          isDeleted: false,
        };
        dbInvoices.push(originalInvoice);

        const refund = {
          id: 'ref_prepaid_pending',
          refundNumber: 'GFRF-PREPAID',
          amount: new Prisma.Decimal(200),
          status: RefundStatus.PENDING,
          invoiceId: originalInvoice.id,
          returnId: 'ret_prepaid',
          method: RefundMethod.ORIGINAL_SOURCE,
        };
        dbRefunds.push(refund);

        const returnRequest = {
          id: 'ret_prepaid',
          orderId: 'ord_prepaid',
          status: ReturnStatus.REFUND_PROCESSED,
          order: {
            id: 'ord_prepaid',
            paymentMode: PaymentModeEnum.ONLINE,
            onlinePaymentStatus: OnlinePaymentStatus.PAID,
            paymentReference: 'pay_razorpay_999',
          },
        };
        dbReturnRequests.push(returnRequest);

        const res = await refundService.processRefund(
          refund.id,
          { remarks: 'Processing prepaid' },
          mockUser,
        );

        expect(res.refund!.status).toBe(RefundStatus.PROCESSED);
        expect(res.refund!.refundReferenceId).toBe('rp_refund_123'); // from mock mockRazorpayService
      });
    });
  });

  describe('Exchange Extension Workflow', () => {
    it('should handle SAME_PRODUCT_EXCHANGE by generating an Exchange Receipt and closing return', async () => {
      const originalInvoice = {
        id: 'inv_pay',
        orderId: 'ord_same',
        type: InvoiceType.PAYMENT,
        grandTotal: new Prisma.Decimal(200),
        isDeleted: false,
      };
      dbInvoices.push(originalInvoice);

      const returnRequest = {
        id: 'ret_same',
        returnType: ReturnType.SAME_PRODUCT_EXCHANGE,
        status: ReturnStatus.QC_PASSED,
        orderId: 'ord_same',
      };
      dbReturnRequests.push(returnRequest);

      const result = await exchangeService.createExchangeMemo(
        returnRequest.id,
        {},
        mockUser,
      );

      expect(result.type).toBe('SAME_PRODUCT_EXCHANGE');
      expect(result.exchangeReceipt).toBeDefined();
      expect(result.exchangeReceipt.type).toBe(InvoiceType.EXCHANGE_RECEIPT);
      expect(returnRequest.status).toBe(ReturnStatus.CLOSED);
    });

    it('should handle DIFFERENT PRODUCT exchange of Higher Value correctly', async () => {
      const originalInvoice = {
        id: 'inv_pay',
        orderId: 'ord_pay',
        type: InvoiceType.PAYMENT,
        grandTotal: new Prisma.Decimal(200),
        isDeleted: false,
      };
      dbInvoices.push(originalInvoice);

      const returnRequest = {
        id: 'ret_diff_higher',
        returnType: ReturnType.EXCHANGE,
        status: ReturnStatus.QC_PASSED,
        orderId: 'ord_pay',
        items: [{ productId: 'prod_1', approvedQty: 2 }],
        order: {
          items: [
            { productId: 'prod_1', quantity: 2, unitPrice: 100, gstPercent: 0 },
          ],
        },
      };
      dbReturnRequests.push(returnRequest);

      // Returned value = 200, mock replacement value = 300
      const result = await exchangeService.createExchangeMemo(
        returnRequest.id,
        {},
        mockUser,
      );

      expect(result.type).toBe('DIFFERENT_PRODUCT_HIGHER_OR_EQUAL');
      expect(result.exchangeMemo).toBeDefined();
      expect(result.exchangeMemo.type).toBe(InvoiceType.EXCHANGE_MEMO);
      expect(result.paymentInvoice).toBeDefined();
      expect(result.paymentInvoice.type).toBe(InvoiceType.PAYMENT);
      expect(Number(result.paymentInvoice.grandTotal)).toBe(100); // 300 - 200 = 100 diff
      expect(returnRequest.status).toBe(ReturnStatus.CLOSED);
    });

    it('should handle DIFFERENT PRODUCT exchange of Lower Value correctly', async () => {
      const originalInvoice = {
        id: 'inv_pay',
        orderId: 'ord_pay',
        type: InvoiceType.PAYMENT,
        grandTotal: new Prisma.Decimal(500),
        isDeleted: false,
      };
      dbInvoices.push(originalInvoice);

      const returnRequest = {
        id: 'ret_diff_lower',
        returnType: ReturnType.EXCHANGE,
        status: ReturnStatus.QC_PASSED,
        orderId: 'ord_pay',
        items: [{ productId: 'prod_1', approvedQty: 4 }],
        order: {
          items: [
            { productId: 'prod_1', quantity: 4, unitPrice: 100, gstPercent: 0 },
          ],
          paymentMode: PaymentModeEnum.ONLINE,
        },
      };
      dbReturnRequests.push(returnRequest);

      // Returned value = 400, mock replacement value = 300
      const result = await exchangeService.createExchangeMemo(
        returnRequest.id,
        {},
        mockUser,
      );

      expect(result.type).toBe('DIFFERENT_PRODUCT_LOWER_VALUE');
      expect(result.exchangeMemo).toBeDefined();
      expect(result.paymentInvoice).toBeDefined();
      expect(result.paymentInvoice.paymentStatus).toBe(
        InvoicePaymentStatus.PAID,
      );
      expect(result.creditNote).toBeDefined();
      expect(Number(result.creditNote.grandTotal)).toBe(400);
      expect(result.refund).toBeDefined();
      expect(Number(result.refund.amount)).toBe(100); // 400 - 300 = 100 refund difference
      expect(result.refundReceipt).toBeDefined();
      expect(returnRequest.status).toBe(ReturnStatus.CLOSED);
    });
  });
});
