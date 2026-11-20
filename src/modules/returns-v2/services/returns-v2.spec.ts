import { Test, TestingModule } from '@nestjs/testing';
import { ReturnRequestService } from './return-request.service';
import { ReturnWorkflowService } from './return-workflow.service';
import { ReturnInventoryService } from './return-inventory.service';
import { RazorpayService } from 'src/financial/payment/razorpay.service';
import { ReturnInspectionService } from './return-inspection.service';
import { ReturnRefundService } from './return-refund.service';
import { ReturnExchangeService } from './return-exchange.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { UploadsService } from 'src/uploads/uploads.service';
import { JwtUser } from '../../../auth/types/jwt-user.type';
import {
  ReturnStatus,
  ReturnSourceType,
  ReturnType,
  ReturnCondition,
  Role,
  DefectiveSource,
  ReturnMovementType,
  WarehouseDisposition,
  PaymentModeEnum,
  OnlinePaymentStatus,
  RefundReceivingSource,
} from '@prisma/client';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { ReturnReasonEnum } from '../enums/return-reason.enum';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { NotificationType } from 'src/notification/enums/notification-type.enum';

describe('Returns V2 Enterprise Workflows', () => {
  let requestService: ReturnRequestService;
  let workflowService: ReturnWorkflowService;
  let notificationServiceMock: any;
  let reqId: string;

  // In-memory db state
  let dbReturnRequests: any[] = [];
  let dbReturnItems: any[] = [];
  let dbExchangeItems: any[] = [];
  let dbReturnMedia: any[] = [];
  let dbReturnInventory: any[] = [];
  let dbDefectiveInventory: any[] = [];
  let dbBlockedInventory: any[] = [];
  let dbInventoryMovements: any[] = [];
  let dbReturnInventoryMovements: any[] = [];
  let dbFranchiseStock: any[] = [];
  let dbWarehouseStock: any[] = [];
  let dbProducts: any[] = [];
  let dbProductVariants: any[] = [];
  let dbOrders: any[] = [];
  let dbOrderItems: any[] = [];
  let dbStockRequests: any[] = [];
  let dbUsers: any[] = [];
  let dbAuditLogs: any[] = [];

  const mockUser: JwtUser = {
    sub: 'user_123',
    email: 'admin@giftfactory.com',
    role: Role.SUPERADMIN,
  };

  beforeEach(async () => {
    // Reset db state
    dbReturnRequests = [];
    dbUsers = [];
    dbAuditLogs = [];
    dbReturnItems = [];
    dbExchangeItems = [];
    dbReturnMedia = [];
    dbReturnInventory = [];
    dbDefectiveInventory = [];
    dbBlockedInventory = [];
    dbInventoryMovements = [];
    dbReturnInventoryMovements = [];
    dbFranchiseStock = [];
    dbWarehouseStock = [];
    dbProducts = [
      { id: 'prod_1', name: 'Product 1', stock: 10, price: 100, variants: [] },
      {
        id: 'prod_2',
        name: 'Product 2',
        stock: 5,
        price: 150,
        variants: [{ id: 'var_2', price: 120 }],
      },
    ];
    dbProductVariants = [{ id: 'var_2', sku: 'SKU-2', stock: 5, price: 120 }];
    dbOrders = [
      {
        id: 'ord_1',
        orderNumber: 'ORD-123',
        channel: 'ONLINE',
        franchiseId: 'fran_1',
        customerId: 'cust_1',
        paymentMode: PaymentModeEnum.ONLINE,
        onlinePaymentStatus: OnlinePaymentStatus.PAID,
      },
      {
        id: 'ord_2',
        orderNumber: 'ORD-456',
        channel: 'POS',
        franchiseId: 'fran_1',
        customerId: 'cust_2',
        paymentMode: PaymentModeEnum.CASH,
        onlinePaymentStatus: null,
      },
    ];
    dbOrderItems = [
      {
        id: 'oi_1',
        orderId: 'ord_1',
        productId: 'prod_1',
        variantId: null,
        quantity: 5,
        unitPrice: 100,
      },
      {
        id: 'oi_2',
        orderId: 'ord_2',
        productId: 'prod_1',
        variantId: null,
        quantity: 2,
        unitPrice: 100,
      },
    ];
    dbStockRequests = [
      {
        id: 'sr_1',
        franchiseId: 'fran_1',
        productId: 'prod_1',
        variantId: null,
        quantity: 10,
      },
    ];

    // Seed mock stock
    dbFranchiseStock = [
      { franchiseId: 'fran_1', productId: 'prod_1', quantity: 10, reserved: 0 },
    ];

    // Seed mock users
    dbUsers = [
      {
        id: 'user_123',
        email: 'admin@giftfactory.com',
        role: Role.SUPERADMIN,
        adminProfile: { name: 'Admin User' },
      },
      {
        id: 'cust_1',
        email: 'customer@gmail.com',
        role: Role.CUSTOMER,
        customer: { name: 'John Doe' },
      },
      {
        id: 'owner_1',
        email: 'owner@giftfactory.com',
        role: Role.FRANCHISE_OWNER,
        franchiseOwner: { ownerFullName: 'Franchise Owner Jane' },
      },
    ];

    const mockPrisma: any = {
      $transaction: jest.fn((cb) => cb(mockPrisma)),
      franchise: {
        findFirst: jest.fn(({ where }) => {
          if (where?.code === 'CENTRAL_WAREHOUSE') {
            return {
              id: 'fran_central_warehouse',
              name: 'Central Warehouse',
              code: 'CENTRAL_WAREHOUSE',
            };
          }
          return null;
        }),
      },
      returnRequest: {
        create: jest.fn(({ data }) => {
          const newRequest = {
            id: `ret_${Date.now()}_${Math.random()}`,
            returnNumber: data.returnNumber,
            sourceType: data.sourceType,
            orderId: data.orderId,
            stockRequestId: data.stockRequestId,
            returnType: data.returnType,
            status: data.status,
            requestedById: data.requestedById,
            franchiseId: data.franchiseId,
            reason: data.reason,
            remarks: data.remarks,
            images: data.images,
            parentReturnId: data.parentReturnId,
            warehouseReturnRequestId: data.warehouseReturnRequestId,
            disposition: data.disposition,
            warehouseDisposition: data.warehouseDisposition,
            warehouseId: data.warehouseId,
            courierName: data.courierName,
            awbNumber: data.awbNumber,
            trackingNumber: data.trackingNumber,
            shipmentStatus: data.shipmentStatus,
            trackingEvents: data.trackingEvents,
            requestedByUserId: data.requestedByUserId,
            approvedByUserId: data.approvedByUserId,
            inspectedByUserId: data.inspectedByUserId,
            closedByUserId: data.closedByUserId,
            refundReceivingSource: data.refundReceivingSource,
            refundPreference: data.refundPreference,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          dbReturnRequests.push(newRequest);

          // Handle nested items creation
          if (data.items?.create) {
            data.items.create.forEach((item: any) => {
              dbReturnItems.push({
                id: `item_${Date.now()}_${Math.random()}`,
                returnRequestId: newRequest.id,
                productId: item.productId,
                variantId: item.variantId,
                requestedQty: item.requestedQty,
                remarks: item.remarks,
              });
            });
          }

          // Handle nested exchangeItems creation
          if (data.exchangeItems?.create) {
            data.exchangeItems.create.forEach((exItem: any) => {
              dbExchangeItems.push({
                id: `ex_${Date.now()}_${Math.random()}`,
                returnRequestId: newRequest.id,
                productId: exItem.productId,
                variantId: exItem.variantId,
                quantity: exItem.quantity,
              });
            });
          }

          // Handle nested media creation
          if (data.media?.create) {
            data.media.create.forEach((media: any) => {
              dbReturnMedia.push({
                id: `med_${Date.now()}_${Math.random()}`,
                returnRequestId: newRequest.id,
                uploadedById: media.uploadedById,
                type: media.type,
                files: media.files,
                createdAt: new Date(),
              });
            });
          }

          return {
            ...newRequest,
            items: dbReturnItems.filter(
              (i) => i.returnRequestId === newRequest.id,
            ),
            exchangeItems: dbExchangeItems.filter(
              (i) => i.returnRequestId === newRequest.id,
            ),
          };
        }),
        findUnique: jest.fn(({ where, include }) => {
          const req = dbReturnRequests.find((r) =>
            where.id
              ? r.id === where.id
              : r.returnNumber === where.returnNumber,
          );
          if (!req) return null;
          return {
            ...req,
            items: dbReturnItems.filter((i) => i.returnRequestId === req.id),
            exchangeItems: dbExchangeItems.filter(
              (i) => i.returnRequestId === req.id,
            ),
            order: dbOrders.find((o) => o.id === req.orderId),
            inspections: [],
            refunds: [],
            ...(include?.media
              ? {
                  media: dbReturnMedia.filter(
                    (m) => m.returnRequestId === req.id,
                  ),
                }
              : {}),
          };
        }),
        update: jest.fn(({ where, data }) => {
          const req = dbReturnRequests.find((r) => r.id === where.id);
          if (!req) return null;
          Object.assign(req, data);
          return {
            ...req,
            items: dbReturnItems.filter((i) => i.returnRequestId === req.id),
            exchangeItems: dbExchangeItems.filter(
              (i) => i.returnRequestId === req.id,
            ),
            order: dbOrders.find((o) => o.id === req.orderId),
            inspections: [],
            refunds: [],
          };
        }),
      },
      returnItem: {
        findMany: jest.fn(({ where, include }) => {
          const filtered = dbReturnItems.filter((item) => {
            const req = dbReturnRequests.find(
              (r) => r.id === item.returnRequestId,
            );
            if (
              where.returnRequest?.orderId &&
              req?.orderId !== where.returnRequest.orderId
            )
              return false;
            if (where.productId && item.productId !== where.productId)
              return false;
            if (where.variantId && item.variantId !== where.variantId)
              return false;
            return true;
          });
          if (include?.returnRequest) {
            return filtered.map((item) => ({
              ...item,
              returnRequest: dbReturnRequests.find(
                (r) => r.id === item.returnRequestId,
              ),
            }));
          }
          return filtered;
        }),
        update: jest.fn(({ where, data }) => {
          const item = dbReturnItems.find((i) => i.id === where.id);
          if (!item) return null;
          Object.assign(item, data);
          return item;
        }),
      },
      returnInspection: {
        create: jest.fn(({ data }) => {
          return { id: `insp_${Date.now()}`, ...data };
        }),
      },
      returnMedia: {
        create: jest.fn(({ data }) => {
          const item = {
            id: `med_${Date.now()}_${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          dbReturnMedia.push(item);
          return item;
        }),
      },
      returnInventory: {
        create: jest.fn(({ data }) => {
          const item = {
            id: `ri_${Date.now()}_${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          dbReturnInventory.push(item);
          return item;
        }),
        findFirst: jest.fn(({ where }) => {
          return dbReturnInventory.find(
            (ri) =>
              ri.sourceId === where.sourceId &&
              ri.productId === where.productId &&
              ri.variantId === where.variantId &&
              ri.kind === where.kind &&
              ri.status === where.status,
          );
        }),
        delete: jest.fn(({ where }) => {
          const idx = dbReturnInventory.findIndex((ri) => ri.id === where.id);
          if (idx !== -1) {
            dbReturnInventory.splice(idx, 1);
          }
          return {};
        }),
        update: jest.fn(({ where, data }) => {
          const ri = dbReturnInventory.find((r) => r.id === where.id);
          if (!ri) return null;
          if (data.quantity?.decrement) {
            ri.quantity -= data.quantity.decrement;
          }
          return ri;
        }),
      },
      defectiveInventory: {
        findFirst: jest.fn(({ where }) => {
          return dbDefectiveInventory.find(
            (di) =>
              di.franchiseId === where.franchiseId &&
              di.productId === where.productId &&
              di.variantId === (where.variantId ?? null) &&
              (where.source === undefined || di.source === where.source),
          );
        }),
        update: jest.fn(({ where, data }) => {
          const di = dbDefectiveInventory.find((d) => d.id === where.id);
          if (!di) return null;
          if (data.quantity?.increment) {
            di.quantity += data.quantity.increment;
          }
          if (data.quantity?.decrement) {
            di.quantity -= data.quantity.decrement;
          }
          return di;
        }),
        create: jest.fn(({ data }) => {
          const item = {
            id: `di_${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          dbDefectiveInventory.push(item);
          return item;
        }),
        delete: jest.fn(({ where }) => {
          const idx = dbDefectiveInventory.findIndex(
            (di) => di.id === where.id,
          );
          if (idx !== -1) {
            dbDefectiveInventory.splice(idx, 1);
          }
          return {};
        }),
        count: jest.fn(({ where }) => {
          let items = dbDefectiveInventory;
          if (where?.AND) {
            for (const cond of where.AND) {
              if (cond.franchiseId)
                items = items.filter((i) => i.franchiseId === cond.franchiseId);
              if (cond.productId)
                items = items.filter((i) => i.productId === cond.productId);
              if (cond.variantId)
                items = items.filter((i) => i.variantId === cond.variantId);
              if (cond.source)
                items = items.filter((i) => i.source === cond.source);
            }
          }
          return items.length;
        }),
        findMany: jest.fn(({ where, skip, take }) => {
          let items = dbDefectiveInventory;
          if (where?.AND) {
            for (const cond of where.AND) {
              if (cond.franchiseId)
                items = items.filter((i) => i.franchiseId === cond.franchiseId);
              if (cond.productId)
                items = items.filter((i) => i.productId === cond.productId);
              if (cond.variantId)
                items = items.filter((i) => i.variantId === cond.variantId);
              if (cond.source)
                items = items.filter((i) => i.source === cond.source);
            }
          }
          return items.slice(skip ?? 0, (skip ?? 0) + (take ?? 10));
        }),
      },
      blockedInventory: {
        findFirst: jest.fn(({ where }) => {
          return dbBlockedInventory.find(
            (bi) =>
              bi.franchiseId === where.franchiseId &&
              bi.productId === where.productId &&
              bi.variantId === where.variantId,
          );
        }),
        update: jest.fn(({ where, data }) => {
          const bi = dbBlockedInventory.find((b) => b.id === where.id);
          if (!bi) return null;
          if (data.quantity?.increment) {
            bi.quantity += data.quantity.increment;
          }
          return bi;
        }),
        create: jest.fn(({ data }) => {
          const item = {
            id: `bi_${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          dbBlockedInventory.push(item);
          return item;
        }),
        count: jest.fn(({ where }) => {
          let items = dbBlockedInventory;
          if (where?.AND) {
            for (const cond of where.AND) {
              if (cond.franchiseId)
                items = items.filter((i) => i.franchiseId === cond.franchiseId);
              if (cond.productId)
                items = items.filter((i) => i.productId === cond.productId);
              if (cond.variantId)
                items = items.filter((i) => i.variantId === cond.variantId);
            }
          }
          return items.length;
        }),
        findMany: jest.fn(({ where, skip, take }) => {
          let items = dbBlockedInventory;
          if (where?.AND) {
            for (const cond of where.AND) {
              if (cond.franchiseId)
                items = items.filter((i) => i.franchiseId === cond.franchiseId);
              if (cond.productId)
                items = items.filter((i) => i.productId === cond.productId);
              if (cond.variantId)
                items = items.filter((i) => i.variantId === cond.variantId);
            }
          }
          return items.slice(skip ?? 0, (skip ?? 0) + (take ?? 10));
        }),
      },
      inventoryMovement: {
        create: jest.fn(({ data }) => {
          const move = {
            id: `im_${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          dbInventoryMovements.push(move);
          return move;
        }),
      },
      returnInventoryMovement: {
        create: jest.fn(({ data }) => {
          const move = {
            id: `rim_${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          dbReturnInventoryMovements.push(move);
          return move;
        }),
      },
      franchiseStock: {
        findUnique: jest.fn(({ where }) => {
          const w = where.franchiseId_productId_variantId || where.franchiseId_productId;
          return dbFranchiseStock.find(
            (fs) =>
              fs.franchiseId === w.franchiseId &&
              fs.productId === w.productId,
          );
        }),
        update: jest.fn(({ where, data }) => {
          const w = where.franchiseId_productId_variantId || where.franchiseId_productId;
          const fs = dbFranchiseStock.find(
            (f) =>
              f.franchiseId === w.franchiseId &&
              f.productId === w.productId,
          );
          if (!fs) return null;
          if (data.quantity?.decrement) {
            fs.quantity -= data.quantity.decrement;
          }
          if (data.quantity?.increment) {
            fs.quantity += data.quantity.increment;
          }
          return fs;
        }),
        upsert: jest.fn(({ where, create, update }) => {
          const w = where.franchiseId_productId_variantId || where.franchiseId_productId;
          let fs = dbFranchiseStock.find(
            (f) =>
              f.franchiseId === w.franchiseId &&
              f.productId === w.productId,
          );
          if (fs) {
            if (update.quantity?.increment) {
              fs.quantity += update.quantity.increment;
            }
          } else {
            fs = {
              franchiseId: w.franchiseId,
              productId: w.productId,
              quantity: create.quantity,
              reserved: 0,
            };
            dbFranchiseStock.push(fs);
          }
          return fs;
        }),
      },
      warehouseStock: {
        upsert: jest.fn(({ where, create, update }) => {
          let ws = dbWarehouseStock.find(
            (w) => w.productId === where.productId,
          );
          if (ws) {
            if (update.quantity?.increment) {
              ws.quantity += update.quantity.increment;
            }
          } else {
            ws = { productId: where.productId, quantity: create.quantity };
            dbWarehouseStock.push(ws);
          }
          return ws;
        }),
      },
      product: {
        findUnique: jest.fn(({ where }) => {
          return dbProducts.find((p) => p.id === where.id);
        }),
        update: jest.fn(({ where, data }) => {
          const p = dbProducts.find((pr) => pr.id === where.id);
          if (p && data.stock?.increment) {
            p.stock += data.stock.increment;
          }
          return p;
        }),
      },
      productVariant: {
        update: jest.fn(({ where, data }) => {
          const v = dbProductVariants.find((va) => va.id === where.id);
          if (v && data.stock?.increment) {
            v.stock += data.stock.increment;
          }
          return v;
        }),
      },
      order: {
        findUnique: jest.fn(({ where }) => {
          const o = dbOrders.find((o) => o.orderNumber === where.orderNumber);
          if (!o) return null;
          return {
            ...o,
            items: dbOrderItems.filter((oi) => oi.orderId === o.id),
          };
        }),
      },
      orderItem: {
        findUnique: jest.fn(({ where }) => {
          return dbOrderItems.find((oi) => oi.id === where.id);
        }),
        findFirst: jest.fn(({ where }) => {
          return dbOrderItems.find(
            (oi) =>
              oi.orderId === where.orderId &&
              oi.productId === where.productId &&
              oi.variantId === where.variantId,
          );
        }),
      },
      stockRequest: {
        findUnique: jest.fn(({ where }) => {
          return dbStockRequests.find((s) => s.id === where.id);
        }),
      },
      user: {
        findMany: jest.fn(({ where }) => {
          const ids = where?.id?.in || [];
          return dbUsers.filter((u) => ids.includes(u.id));
        }),
      },
      auditLog: {
        findMany: jest.fn(({ where }) => {
          if (where?.resource === 'ReturnRequest' && where?.resourceId) {
            return dbAuditLogs.filter(
              (log) =>
                log.resource === 'ReturnRequest' &&
                log.resourceId === where.resourceId,
            );
          }
          return dbAuditLogs;
        }),
        create: jest.fn(({ data }) => {
          const newLog = {
            id: `log_${Date.now()}_${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          dbAuditLogs.push(newLog);
          return newLog;
        }),
      },
    };

    const mockAudit = {
      log: jest.fn(({ userId, action, resource, resourceId, metadata, ip }) => {
        const log = {
          id: `log_${Date.now()}_${Math.random()}`,
          userId,
          action,
          resource,
          resourceId,
          metadata,
          ip,
          createdAt: new Date(),
        };
        dbAuditLogs.push(log);
        return log;
      }),
    };

    const mockUploads = {
      getObjectUrl: jest.fn((file: string) => `https://cloudfront.net/${file}`),
    };

    const mockRoleBasedNotificationService = {
      notifySuperAdmins: jest.fn().mockResolvedValue(1),
      notifyFranchiseAll: jest.fn().mockResolvedValue(1),
      notifyCustomer: jest.fn().mockResolvedValue(1),
    };

    const mockRazorpayService = {
      refundPayment: jest.fn().mockResolvedValue({ id: 'rp_refund_mock' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnRequestService,
        ReturnWorkflowService,
        ReturnInventoryService,
        ReturnInspectionService,
        ReturnRefundService,
        ReturnExchangeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: UploadsService, useValue: mockUploads },
        { provide: RazorpayService, useValue: mockRazorpayService },
        {
          provide: RoleBasedNotificationService,
          useValue: mockRoleBasedNotificationService,
        },
      ],
    }).compile();

    requestService = module.get<ReturnRequestService>(ReturnRequestService);
    workflowService = module.get<ReturnWorkflowService>(ReturnWorkflowService);
    notificationServiceMock = mockRoleBasedNotificationService;
    jest.clearAllMocks();
  });

  describe('1. Return Request Creation & Customer Proof Media', () => {
    it('should create an online return and automatically log CUSTOMER_PROOF media', async () => {
      const dto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.OTHER,
        remarks: 'Fits too large',
        images: ['https://example.com/customer_proof1.jpg'],
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [
          {
            productId: 'prod_1',
            variantId: undefined,
            requestedQty: 2,
            remarks: 'Returning 2 units',
          },
        ],
      };

      const result = await requestService.createOnlineReturn(
        dto,
        mockUser,
        '127.0.0.1',
      );
      expect(result).toBeDefined();
      expect(dbReturnRequests.length).toBe(1);
      expect(dbReturnRequests[0].status).toBe(ReturnStatus.REQUESTED);

      // Verify that media is created and mapped to CUSTOMER_PROOF
      expect(dbReturnMedia.length).toBe(1);
      expect(dbReturnMedia[0].type).toBe('CUSTOMER_PROOF');
      expect(dbReturnMedia[0].files).toContain(
        'https://example.com/customer_proof1.jpg',
      );
    });

    it('should reject return requests if requested quantity exceeds available quantity', async () => {
      const dto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.DAMAGE,
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [
          {
            productId: 'prod_1',
            variantId: undefined,
            requestedQty: 10, // Only 5 were ordered
          },
        ],
      };

      await expect(
        requestService.createOnlineReturn(dto, mockUser, '127.0.0.1'),
      ).rejects.toThrow('exceeds the available return quantity');
    });

    it('should notify franchise owner/staff if franchise is involved and reason is not DAMAGE', async () => {
      const dto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.OTHER,
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };

      await requestService.createOnlineReturn(dto, mockUser, '127.0.0.1');
      expect(notificationServiceMock.notifyFranchiseAll).toHaveBeenCalledWith(
        'fran_1',
        'New Return Request',
        expect.any(String),
        NotificationType.ORDER,
        expect.any(Object),
      );
      expect(notificationServiceMock.notifySuperAdmins).not.toHaveBeenCalled();
    });

    it('should notify SUPERADMIN if franchise is not involved and reason is not DAMAGE', async () => {
      const order = dbOrders.find((o) => o.id === 'ord_1');
      const originalFranchiseId = order.franchiseId;
      order.franchiseId = null;

      try {
        const dto = {
          orderNumber: 'ORD-123',
          returnType: ReturnType.REFUND,
          reason: ReturnReasonEnum.OTHER,
          refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
          items: [
            { productId: 'prod_1', variantId: undefined, requestedQty: 1 },
          ],
        };

        await requestService.createOnlineReturn(dto, mockUser, '127.0.0.1');
        expect(notificationServiceMock.notifySuperAdmins).toHaveBeenCalledWith(
          'New Return Request',
          expect.any(String),
          expect.any(Object),
        );
        expect(
          notificationServiceMock.notifyFranchiseAll,
        ).not.toHaveBeenCalled();
      } finally {
        order.franchiseId = originalFranchiseId;
      }
    });

    it('should notify SUPERADMIN directly if reason is DAMAGE even if franchise is involved', async () => {
      const dto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.DAMAGE,
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };

      await requestService.createOnlineReturn(dto, mockUser, '127.0.0.1');
      expect(notificationServiceMock.notifySuperAdmins).toHaveBeenCalledWith(
        'New Damage Return Request',
        expect.any(String),
        expect.any(Object),
      );
      expect(notificationServiceMock.notifyFranchiseAll).not.toHaveBeenCalled();
    });
  });

  describe('2. State Transitions, Staging, and Proof Uploads', () => {
    let reqId: string;

    beforeEach(async () => {
      // Create request first
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.DAMAGE,
        images: ['https://example.com/cust1.jpg'],
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };
      const req = await requestService.createOnlineReturn(
        createDto,
        mockUser,
        '127.0.0.1',
      );
      reqId = req.id;
    });

    it('should complete transition APPROVED -> PICKUP_SCHEDULED -> PICKUP_COMPLETED and save PICKUP_PROOF as RECEIVING_PROOF', async () => {
      // 1. Approve
      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.APPROVED },
        mockUser,
      );
      expect(dbReturnRequests[0].status).toBe(ReturnStatus.APPROVED);

      // 2. Schedule Pickup
      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.PICKUP_SCHEDULED },
        mockUser,
      );
      expect(dbReturnRequests[0].status).toBe(ReturnStatus.PICKUP_SCHEDULED);

      // 3. Complete Pickup with images
      const updateDto: UpdateStatusDto = {
        status: ReturnStatus.PICKUP_COMPLETED,
        images: ['https://example.com/pickup_proof.jpg'],
      };
      await workflowService.handleStatusTransition(reqId, updateDto, mockUser);
      expect(dbReturnRequests[0].status).toBe(ReturnStatus.PICKUP_COMPLETED);

      // Check media log
      const pickupMedia = dbReturnMedia.find(
        (m) => m.type === 'RECEIVING_PROOF',
      );
      expect(pickupMedia).toBeDefined();
      expect(pickupMedia.files).toContain(
        'https://example.com/pickup_proof.jpg',
      );
    });

    it('should complete transition to RECEIVED_AT_FRANCHISE, upload RECEIVING_PROOF, and stage as PENDING_QC', async () => {
      // Approve return first
      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.APPROVED },
        mockUser,
      );

      const updateDto: UpdateStatusDto = {
        status: ReturnStatus.RECEIVED_AT_FRANCHISE,
        images: ['https://example.com/receiving_proof.jpg'],
      };

      await workflowService.handleStatusTransition(reqId, updateDto, mockUser);
      expect(dbReturnRequests[0].status).toBe(
        ReturnStatus.RECEIVED_AT_FRANCHISE,
      );

      // Check media log
      const receivingMedia = dbReturnMedia.find(
        (m) => m.type === 'RECEIVING_PROOF',
      );
      expect(receivingMedia).toBeDefined();
      expect(receivingMedia.files).toContain(
        'https://example.com/receiving_proof.jpg',
      );

      // Check ReturnInventory staging (must be PENDING_QC status)
      expect(dbReturnInventory.length).toBe(1);
      expect(dbReturnInventory[0].status).toBe('PENDING_QC');
      expect(dbReturnInventory[0].quantity).toBe(1);

      // Check transaction ledger log
      const ledgerMove = dbReturnInventoryMovements.find(
        (m) => m.movementType === 'CUSTOMER_TO_RETURN',
      );
      expect(ledgerMove).toBeDefined();
      expect(ledgerMove.quantity).toBe(1);
    });
  });

  describe('3. QC Inspection Outcomes and Defect/Blocked Isolation', () => {
    let reqId: string;

    beforeEach(async () => {
      // Setup order return at stage UNDER_INSPECTION
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 2 }],
      };
      const req = await requestService.createOnlineReturn(
        createDto,
        mockUser,
        '127.0.0.1',
      );
      reqId = req.id;

      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.APPROVED },
        mockUser,
      );
      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.RECEIVED_AT_FRANCHISE, images: ['img.jpg'] },
        mockUser,
      );
      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.UNDER_INSPECTION },
        mockUser,
      );
    });

    it('should route GOOD condition items to FranchiseStock and log RETURN_TO_FRANCHISE movement', async () => {
      const completeInspectionDto = {
        status: ReturnStatus.QC_PASSED,
        remarks: 'Item is in good condition',
        images: ['https://example.com/qc_passed.jpg'],
        items: [
          {
            id: dbReturnItems[0].id,
            approvedQty: 2,
            condition: ReturnCondition.GOOD,
          },
        ],
      };

      await workflowService.handleStatusTransition(
        reqId,
        completeInspectionDto as any,
        mockUser,
      );
      expect(dbReturnRequests[0].status).toBe(ReturnStatus.QC_PASSED);

      expect(notificationServiceMock.notifyCustomer).toHaveBeenCalledWith(
        'cust_1',
        'Return QC Passed',
        expect.any(String),
        NotificationType.ORDER,
        expect.any(Object),
      );

      // Check ReturnInventory is cleared out
      expect(dbReturnInventory.length).toBe(0);

      // Check FranchiseStock incremented
      const stock = dbFranchiseStock.find(
        (s) => s.franchiseId === 'fran_1' && s.productId === 'prod_1',
      );
      expect(stock.quantity).toBe(12); // Initial 10 + 2 returned

      // Check ReturnInventoryMovement log
      const qcMove = dbReturnInventoryMovements.find(
        (m) => m.movementType === ReturnMovementType.RETURN_TO_FRANCHISE,
      );
      expect(qcMove).toBeDefined();
      expect(qcMove.quantity).toBe(2);

      // Check QC_PROOF media
      const qcMedia = dbReturnMedia.find((m) => m.type === 'QC_PROOF');
      expect(qcMedia).toBeDefined();
      expect(qcMedia.files).toContain('https://example.com/qc_passed.jpg');
    });

    it('should isolate DEFECTIVE condition items into DefectiveInventory table and log RETURN_TO_DEFECTIVE movement', async () => {
      const completeInspectionDto = {
        status: ReturnStatus.QC_FAILED,
        remarks: 'Item is cracked',
        images: ['https://example.com/qc_failed.jpg'],
        items: [
          {
            id: dbReturnItems[0].id,
            approvedQty: 2,
            condition: ReturnCondition.DEFECTIVE,
          },
        ],
      };

      await workflowService.handleStatusTransition(
        reqId,
        completeInspectionDto as any,
        mockUser,
      );
      expect(dbReturnRequests[0].status).toBe(ReturnStatus.QC_FAILED);

      // Check DefectiveInventory isolated table
      expect(dbDefectiveInventory.length).toBe(1);
      expect(dbDefectiveInventory[0].franchiseId).toBe('fran_1');
      expect(dbDefectiveInventory[0].productId).toBe('prod_1');
      expect(dbDefectiveInventory[0].quantity).toBe(2);
      expect(dbDefectiveInventory[0].source).toBe(
        DefectiveSource.CUSTOMER_RETURN,
      );

      // Check ReturnInventoryMovement log
      const defectiveMove = dbReturnInventoryMovements.find(
        (m) => m.movementType === ReturnMovementType.RETURN_TO_DEFECTIVE,
      );
      expect(defectiveMove).toBeDefined();
    });

    it('should isolate CONFLICT condition items into BlockedInventory table and log RETURN_TO_BLOCKED movement', async () => {
      const completeInspectionDto = {
        status: ReturnStatus.QC_CONFLICT,
        remarks: 'Serial number mismatch',
        images: ['https://example.com/qc_conflict.jpg'],
        items: [
          {
            id: dbReturnItems[0].id,
            approvedQty: 2,
            condition: ReturnCondition.CONFLICT,
          },
        ],
      };

      await workflowService.handleStatusTransition(
        reqId,
        completeInspectionDto as any,
        mockUser,
      );
      expect(dbReturnRequests[0].status).toBe(ReturnStatus.QC_CONFLICT);

      // Check BlockedInventory isolated table
      expect(dbBlockedInventory.length).toBe(1);
      expect(dbBlockedInventory[0].franchiseId).toBe('fran_1');
      expect(dbBlockedInventory[0].productId).toBe('prod_1');
      expect(dbBlockedInventory[0].quantity).toBe(2);

      // Check ReturnInventoryMovement log
      const blockedMove = dbReturnInventoryMovements.find(
        (m) => m.movementType === ReturnMovementType.RETURN_TO_BLOCKED,
      );
      expect(blockedMove).toBeDefined();
    });
  });

  describe('4. Exchange Value & Variant Validation', () => {
    it('should reject exchange creation if replacement value < returned value', async () => {
      const dto = {
        orderNumber: 'ORD-456',
        returnType: ReturnType.EXCHANGE,
        reason: ReturnReasonEnum.OTHER,
        items: [
          {
            productId: 'prod_1',
            variantId: undefined,
            requestedQty: 2,
          },
        ],
        exchangeItems: [
          {
            productId: 'prod_1',
            variantId: undefined,
            quantity: 1,
          },
        ],
      };

      await expect(
        requestService.createPosReturn(dto as any, mockUser, '127.0.0.1'),
      ).rejects.toThrow(
        'Replacement order value (100) must be greater than or equal to the returned items value (200)',
      );
    });

    it('should accept exchange creation if replacement value >= returned value', async () => {
      const dto = {
        orderNumber: 'ORD-456',
        returnType: ReturnType.EXCHANGE,
        reason: ReturnReasonEnum.OTHER,
        items: [
          {
            productId: 'prod_1',
            variantId: undefined,
            requestedQty: 1,
          },
        ],
        exchangeItems: [
          {
            productId: 'prod_1',
            variantId: undefined,
            quantity: 2,
          },
        ],
      };

      const result = await requestService.createPosReturn(
        dto as any,
        mockUser,
        '127.0.0.1',
      );
      expect(result).toBeDefined();
      expect(dbReturnRequests[0].requestedByUserId).toBe(mockUser.sub);
    });

    it('should fail exchange creation if replacement product has variants but no variantId is provided', async () => {
      const dto = {
        orderNumber: 'ORD-456',
        returnType: ReturnType.EXCHANGE,
        reason: ReturnReasonEnum.OTHER,
        items: [
          {
            productId: 'prod_1',
            variantId: undefined,
            requestedQty: 1,
          },
        ],
        exchangeItems: [
          {
            productId: 'prod_2',
            variantId: undefined,
            quantity: 1,
          },
        ],
      };

      await expect(
        requestService.createPosReturn(dto as any, mockUser, '127.0.0.1'),
      ).rejects.toThrow(
        'variantId is required for product "Product 2" because it has variants.',
      );
    });
  });

  describe('5. Mandatory Proof Image Validation', () => {
    it('should throw BadRequestException if transition to receiving or QC status is made without images', async () => {
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.DAMAGE,
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };
      const req = await requestService.createOnlineReturn(
        createDto,
        mockUser,
        '127.0.0.1',
      );
      reqId = req.id;

      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.APPROVED },
        mockUser,
      );

      await expect(
        workflowService.handleStatusTransition(
          reqId,
          { status: ReturnStatus.RECEIVED_AT_FRANCHISE },
          mockUser,
        ),
      ).rejects.toThrow('Image evidence is mandatory');
    });

    it('should throw BadRequestException if transition is made with only placeholder image', async () => {
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.DAMAGE,
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };
      const req = await requestService.createOnlineReturn(
        createDto,
        mockUser,
        '127.0.0.1',
      );
      reqId = req.id;

      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.APPROVED },
        mockUser,
      );

      await expect(
        workflowService.handleStatusTransition(
          reqId,
          {
            status: ReturnStatus.RECEIVED_AT_FRANCHISE,
            images: ['proof_image_placeholder.png'],
          },
          mockUser,
        ),
      ).rejects.toThrow('Image evidence is mandatory');
    });

    it('should filter out placeholder images during creation', async () => {
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.DAMAGE,
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
        images: [
          'https://example.com/proof_image_placeholder.png',
          'https://example.com/actual_proof.jpg',
        ],
      };
      const req = await requestService.createOnlineReturn(
        createDto,
        mockUser,
        '127.0.0.1',
      );

      expect(req.images).toEqual(['https://example.com/actual_proof.jpg']);

      const dbMedia = dbReturnMedia.filter((m) => m.returnRequestId === req.id);
      expect(dbMedia.length).toBe(1);
      expect(dbMedia[0].files).toEqual([
        'https://example.com/actual_proof.jpg',
      ]);
    });
  });

  describe('6. Auto Warehouse Return & Processing Defective Items at Warehouse', () => {
    it('should auto-create a child stock return request when customer return inspection fails with DEFECTIVE', async () => {
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };
      const req = await requestService.createOnlineReturn(
        createDto,
        mockUser,
        '127.0.0.1',
      );
      reqId = req.id;

      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.APPROVED },
        mockUser,
      );
      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.RECEIVED_AT_FRANCHISE, images: ['img.jpg'] },
        mockUser,
      );
      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.UNDER_INSPECTION },
        mockUser,
      );

      const qcDto = {
        status: ReturnStatus.QC_FAILED,
        remarks: 'Item is defective',
        images: ['img.jpg'],
        items: [
          {
            id: dbReturnItems.find((i) => i.returnRequestId === reqId).id,
            approvedQty: 1,
            condition: ReturnCondition.DEFECTIVE,
          },
        ],
      };

      await workflowService.handleStatusTransition(
        reqId,
        qcDto as any,
        mockUser,
      );

      const parentRequest = dbReturnRequests.find((r) => r.id === reqId);
      expect(parentRequest.status).toBe(ReturnStatus.QC_FAILED);
      expect(parentRequest.disposition).toBe('RETURN_TO_WAREHOUSE');
      expect(parentRequest.warehouseReturnRequestId).toBeDefined();

      const childId = parentRequest.warehouseReturnRequestId;
      const childRequest = dbReturnRequests.find((r) => r.id === childId);
      expect(childRequest).toBeDefined();
      expect(childRequest.sourceType).toBe(ReturnSourceType.STOCK_REQUEST);
      expect(childRequest.status).toBe(ReturnStatus.APPROVED);
      expect(childRequest.parentReturnId).toBe(reqId);
      expect(childRequest.warehouseId).toBe('CENTRAL_WAREHOUSE');

      const childItems = dbReturnItems.filter(
        (i) => i.returnRequestId === childId,
      );
      expect(childItems.length).toBe(1);
      expect(childItems[0].productId).toBe('prod_1');

      const franchiseDefective = dbDefectiveInventory.find(
        (di) => di.franchiseId === 'fran_1' && di.productId === 'prod_1',
      );
      expect(franchiseDefective).toBeDefined();
      expect(franchiseDefective.quantity).toBe(1);

      await workflowService.handleStatusTransition(
        childId,
        {
          status: ReturnStatus.RECEIVED_AT_WAREHOUSE,
          images: ['warehouse_receiving.jpg'],
          courierName: 'Shiprocket',
          awbNumber: 'AWB789',
          trackingNumber: 'TRK789',
          shipmentStatus: 'Delivered',
        },
        mockUser,
      );

      const franchiseDefectiveAfter = dbDefectiveInventory.find(
        (di) => di.franchiseId === 'fran_1' && di.productId === 'prod_1',
      );
      expect(franchiseDefectiveAfter).toBeUndefined();

      const stagedReturn = dbReturnInventory.find(
        (ri) => ri.sourceId === childId && ri.status === 'PENDING_QC',
      );
      expect(stagedReturn).toBeDefined();
      expect(stagedReturn.quantity).toBe(1);

      const updatedChild = dbReturnRequests.find((r) => r.id === childId);
      expect(updatedChild.courierName).toBe('Shiprocket');
      expect(updatedChild.awbNumber).toBe('AWB789');

      await workflowService.handleStatusTransition(
        childId,
        { status: ReturnStatus.UNDER_INSPECTION },
        mockUser,
      );

      const warehouseQcDto = {
        status: ReturnStatus.WAREHOUSE_QC,
        images: ['warehouse_qc.jpg'],
        items: [
          {
            id: childItems[0].id,
            approvedQty: 1,
            condition: ReturnCondition.GOOD,
            warehouseDisposition: WarehouseDisposition.RESTOCK,
          },
        ],
      };

      await workflowService.handleStatusTransition(
        childId,
        warehouseQcDto as any,
        mockUser,
      );
      expect(dbReturnRequests.find((r) => r.id === childId).status).toBe(
        ReturnStatus.WAREHOUSE_QC,
      );
      expect(
        dbReturnRequests.find((r) => r.id === childId).warehouseDisposition,
      ).toBe(WarehouseDisposition.RESTOCK);

      const whStock = dbWarehouseStock.find((w) => w.productId === 'prod_1');
      expect(whStock).toBeDefined();
      expect(whStock.quantity).toBe(1);
    });
  });

  describe('7. Damage-Related Returns Restriction', () => {
    it('should allow status transition for damage-related requests only by SUPERADMIN or ADMIN_STAFF in ONLINE flow, but standard roles in franchise/POS flow', async () => {
      // 1. Create a request with DAMAGE reason
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.DAMAGE,
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };
      const req = await requestService.createOnlineReturn(
        createDto,
        mockUser,
        '127.0.0.1',
      );
      reqId = req.id;

      // 2. Attempt to approve using a FRANCHISE_OWNER role (should fail)
      const franchiseUser: JwtUser = {
        sub: 'fran_user_1',
        email: 'owner@fran.com',
        role: Role.FRANCHISE_OWNER,
      };

      await expect(
        workflowService.handleStatusTransition(
          reqId,
          { status: ReturnStatus.APPROVED },
          franchiseUser,
        ),
      ).rejects.toThrow(
        'Only SUPERADMIN or ADMIN_STAFF can handle damage-related online return requests',
      );

      // 3. Approve using SUPERADMIN (should succeed)
      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.APPROVED },
        mockUser,
      );
      expect(dbReturnRequests.find((r) => r.id === reqId).status).toBe(
        ReturnStatus.APPROVED,
      );

      // 4. Create a POS request with DAMAGE reason
      const posCreateDto = {
        orderNumber: 'ORD-456',
        returnType: ReturnType.EXCHANGE,
        reason: ReturnReasonEnum.DAMAGE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
        exchangeItems: [
          { productId: 'prod_1', variantId: undefined, quantity: 1 },
        ],
      };
      const posReq = await requestService.createPosReturn(
        posCreateDto as any,
        mockUser,
        '127.0.0.1',
      );
      const posReqId = posReq.id;

      // Franchise owner should be allowed to approve POS damaged return request
      await workflowService.handleStatusTransition(
        posReqId,
        { status: ReturnStatus.APPROVED },
        franchiseUser,
      );
      expect(dbReturnRequests.find((r) => r.id === posReqId).status).toBe(
        ReturnStatus.APPROVED,
      );
    });
  });

  describe('8. Same Product Exchange Workflow', () => {
    it('should auto-populate exchange items and process SAME_PRODUCT_EXCHANGE return request creation and status transitions', async () => {
      const dto = {
        orderNumber: 'ORD-456',
        returnType: ReturnType.SAME_PRODUCT_EXCHANGE,
        reason: ReturnReasonEnum.DAMAGE,
        items: [
          {
            productId: 'prod_1',
            variantId: undefined,
            requestedQty: 1,
          },
        ],
      };

      const result = await requestService.createPosReturn(
        dto as any,
        mockUser,
        '127.0.0.1',
      );
      expect(result).toBeDefined();
      expect(result.exchangeItems.length).toBe(1);
      expect(result.exchangeItems[0].productId).toBe('prod_1');
      expect(result.exchangeItems[0].quantity).toBe(1);

      const reqId = result.id;

      const franchiseUser: JwtUser = {
        sub: 'fran_user_1',
        email: 'owner@fran.com',
        role: Role.FRANCHISE_OWNER,
      };

      await workflowService.handleStatusTransition(
        reqId,
        { status: ReturnStatus.APPROVED },
        franchiseUser,
      );
      expect(dbReturnRequests.find((r) => r.id === reqId).status).toBe(
        ReturnStatus.APPROVED,
      );
    });
  });

  describe('9. Defective and Blocked Inventory Listing', () => {
    beforeEach(() => {
      dbDefectiveInventory = [
        {
          id: 'di_1',
          franchiseId: 'fran_1',
          productId: 'prod_1',
          variantId: null,
          quantity: 5,
          source: DefectiveSource.CUSTOMER_RETURN,
          createdAt: new Date('2026-06-01'),
          updatedAt: new Date('2026-06-01'),
        },
        {
          id: 'di_2',
          franchiseId: 'fran_2',
          productId: 'prod_1',
          variantId: null,
          quantity: 10,
          source: DefectiveSource.FRANCHISE_STOCK,
          createdAt: new Date('2026-06-02'),
          updatedAt: new Date('2026-06-02'),
        },
      ];

      dbBlockedInventory = [
        {
          id: 'bi_1',
          franchiseId: 'fran_1',
          productId: 'prod_1',
          variantId: null,
          quantity: 2,
          createdAt: new Date('2026-06-03'),
          updatedAt: new Date('2026-06-03'),
        },
      ];
    });

    it('should list defective inventory for admin with no filters', async () => {
      const query = {
        type: 'DEFECTIVE' as any,
        page: 1,
        limit: 10,
      };

      const result = await requestService.listInventory(query, mockUser);
      expect(result.data.length).toBe(2);
      expect(result.meta.total).toBe(2);
      expect(result.data[0].type).toBe('DEFECTIVE');
      expect(result.data[1].type).toBe('DEFECTIVE');
    });

    it('should list defective inventory and apply franchise isolation for FRANCHISE_OWNER', async () => {
      const franchiseUser: JwtUser = {
        sub: 'user_fran_1',
        email: 'owner@fran.com',
        role: Role.FRANCHISE_OWNER,
        franchiseId: 'fran_1',
      };

      const query = {
        type: 'DEFECTIVE' as any,
        page: 1,
        limit: 10,
      };

      const result = await requestService.listInventory(query, franchiseUser);
      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe('di_1');
      expect(result.data[0].type).toBe('DEFECTIVE');
    });

    it('should list blocked inventory and apply franchise isolation for FRANCHISE_STAFF', async () => {
      const staffUser: JwtUser = {
        sub: 'user_staff_1',
        email: 'staff1@giftfactory.com',
        role: Role.FRANCHISE_STAFF,
        franchiseOwnerId: 'fran_1',
      };

      const query = {
        type: 'BLOCKED' as any,
        page: 1,
        limit: 10,
      };

      const result = await requestService.listInventory(query, staffUser);
      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe('bi_1');
      expect(result.data[0].type).toBe('BLOCKED');
    });
  });

  describe('5. Return Detail API Response Actor & Timeline Enrichment', () => {
    it('should retrieve return request detail with enriched actor objects and timeline', async () => {
      // 1. Create a customer return
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.DAMAGE,
        remarks: 'Customer reported flicker',
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };

      const customerUser: JwtUser = {
        sub: 'cust_1',
        email: 'customer@gmail.com',
        role: Role.CUSTOMER,
        customerId: 'cust_1',
      };

      const request = await requestService.createOnlineReturn(
        createDto,
        customerUser,
        '127.0.0.1',
      );

      // 2. Perform transition to APPROVED by admin user
      await workflowService.handleStatusTransition(
        request.id,
        { status: ReturnStatus.APPROVED },
        mockUser,
        '127.0.0.1',
      );

      // 3. Fetch return request details
      const detail = await requestService.findOne(request.id, mockUser);

      // Verify enriched actor sections exist alongside ID fields
      expect(detail.requestedByUserId).toBe('cust_1');
      expect(detail.requestedBy).toBeDefined();
      expect(detail.requestedBy!.id).toBe('cust_1');
      expect(detail.requestedBy!.name).toBe('John Doe');
      expect(detail.requestedBy!.role).toBe('CUSTOMER');

      expect(detail.approvedByUserId).toBe('user_123');
      expect(detail.approvedBy).toBeDefined();
      expect(detail.approvedBy!.id).toBe('user_123');
      expect(detail.approvedBy!.name).toBe('Admin User');
      expect(detail.approvedBy!.role).toBe('SUPERADMIN');

      // Check for expected timeline structure and events
      expect(detail.timeline).toBeDefined();
      expect(Array.isArray(detail.timeline)).toBe(true);
      expect(detail.timeline.length).toBeGreaterThanOrEqual(2);

      // Check first timeline event (creation / REQUESTED)
      const requestedEvent = detail.timeline.find(
        (t: any) => t.status === 'REQUESTED',
      );
      expect(requestedEvent).toBeDefined();
      expect(requestedEvent!.performedBy!.id).toBe('cust_1');
      expect(requestedEvent!.remarks).toBe('Customer reported flicker');

      // Check second timeline event (approval / APPROVED)
      const approvedEvent = detail.timeline.find(
        (t: any) => t.status === 'APPROVED',
      );
      expect(approvedEvent).toBeDefined();
      expect(approvedEvent!.performedBy!.id).toBe('user_123');
    });

    it('should retrieve return request detail by returnNumber', async () => {
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.OTHER,
        remarks: 'Customer reported flicker',
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };

      const customerUser: JwtUser = {
        sub: 'cust_1',
        email: 'customer@gmail.com',
        role: Role.CUSTOMER,
        customerId: 'cust_1',
      };

      const request = await requestService.createOnlineReturn(
        createDto,
        customerUser,
        '127.0.0.1',
      );

      // Fetch by returnNumber instead of ID
      const detail = await requestService.findOne(
        request.returnNumber,
        mockUser,
      );

      expect(detail.id).toBe(request.id);
      expect(detail.returnNumber).toBe(request.returnNumber);
      expect(detail.requestedByUserId).toBe('cust_1');
    });

    it('should include return media when fetched by admin or franchise owner/staff', async () => {
      const createDto = {
        orderNumber: 'ORD-123',
        returnType: ReturnType.REFUND,
        reason: ReturnReasonEnum.OTHER,
        remarks: 'Customer reported flicker',
        images: ['https://example.com/cust1.jpg'],
        refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
        items: [{ productId: 'prod_1', variantId: undefined, requestedQty: 1 }],
      };

      const customerUser: JwtUser = {
        sub: 'cust_1',
        email: 'customer@gmail.com',
        role: Role.CUSTOMER,
        customerId: 'cust_1',
      };

      const request = await requestService.createOnlineReturn(
        createDto,
        customerUser,
        '127.0.0.1',
      );

      // Fetch by admin
      const adminDetail: any = await requestService.findOne(
        request.id,
        mockUser,
      );
      expect(adminDetail.media).toBeDefined();
      expect(adminDetail.media.length).toBe(1);

      // Fetch by customer (should omit refund preference fields)
      const customerDetail: any = await requestService.findOne(
        request.id,
        customerUser,
      );
      expect(customerDetail.media).toBeUndefined();
      expect(customerDetail.refundReceivingSource).toBeUndefined();
      expect(customerDetail.refundPreference).toBeUndefined();
    });

    it('should validate refund preference capture rules during creation and post-creation update', async () => {
      // Setup extra orders for COD and Online tests
      const codOrder = {
        id: 'ord_cod_test',
        orderNumber: 'ORD-COD-1',
        channel: 'ONLINE',
        franchiseId: 'fran_1',
        customerId: 'cust_1',
        paymentMode: PaymentModeEnum.COD,
        onlinePaymentStatus: null,
      };
      dbOrders.push(codOrder);
      dbOrderItems.push({
        id: 'oi_cod',
        orderId: 'ord_cod_test',
        productId: 'prod_1',
        variantId: null,
        quantity: 2,
        unitPrice: 100,
      });

      // 1. Validation: refundReceivingSource mandatory when returnType = REFUND
      await expect(
        requestService.createOnlineReturn(
          {
            orderNumber: 'ORD-123',
            returnType: ReturnType.REFUND,
            items: [
              { productId: 'prod_1', variantId: undefined, requestedQty: 1 },
            ],
          } as any,
          mockUser,
        ),
      ).rejects.toThrow(
        'refundReceivingSource is required when returnType is REFUND.',
      );

      // 2. Validation: COD orders cannot be refunded to ORIGINAL_SOURCE
      await expect(
        requestService.createOnlineReturn(
          {
            orderNumber: 'ORD-COD-1',
            returnType: ReturnType.REFUND,
            refundReceivingSource: RefundReceivingSource.ORIGINAL_SOURCE,
            items: [
              { productId: 'prod_1', variantId: undefined, requestedQty: 1 },
            ],
          } as any,
          mockUser,
        ),
      ).rejects.toThrow('ORIGINAL_SOURCE is not selectable for COD orders.');

      // 2b. Validation: ONLINE prepaid orders cannot be refunded to UPI or BANK_TRANSFER
      await expect(
        requestService.createOnlineReturn(
          {
            orderNumber: 'ORD-123',
            returnType: ReturnType.REFUND,
            refundReceivingSource: RefundReceivingSource.UPI,
            upiId: 'test@upi',
            items: [
              { productId: 'prod_1', variantId: undefined, requestedQty: 1 },
            ],
          } as any,
          mockUser,
        ),
      ).rejects.toThrow(
        'Direct UPI or bank-transfer refunds for prepaid orders are not currently supported. Please select ORIGINAL_SOURCE or REWARDS.',
      );

      // 3. Validation: UPI requires upiId
      await expect(
        requestService.createOnlineReturn(
          {
            orderNumber: 'ORD-COD-1',
            returnType: ReturnType.REFUND,
            refundReceivingSource: RefundReceivingSource.UPI,
            items: [
              { productId: 'prod_1', variantId: undefined, requestedQty: 1 },
            ],
          } as any,
          mockUser,
        ),
      ).rejects.toThrow('UPI refunds require a valid upiId.');

      // 4. Validation: BANK_TRANSFER requires all fields
      await expect(
        requestService.createOnlineReturn(
          {
            orderNumber: 'ORD-COD-1',
            returnType: ReturnType.REFUND,
            refundReceivingSource: RefundReceivingSource.BANK_TRANSFER,
            accountHolderName: 'John',
            items: [
              { productId: 'prod_1', variantId: undefined, requestedQty: 1 },
            ],
          } as any,
          mockUser,
        ),
      ).rejects.toThrow('Bank transfer refunds require bankName.');

      // 5. Update refund preference via admin
      const req = await requestService.createOnlineReturn(
        {
          orderNumber: 'ORD-COD-1',
          returnType: ReturnType.REFUND,
          refundReceivingSource: RefundReceivingSource.UPI,
          upiId: 'test@upi',
          items: [
            { productId: 'prod_1', variantId: undefined, requestedQty: 1 },
          ],
        },
        mockUser,
      );

      // Verify initial preference is saved
      const initialDetail = await requestService.findOne(req.id, mockUser);
      expect(initialDetail.refundReceivingSource).toBe(
        RefundReceivingSource.UPI,
      );
      expect(initialDetail.refundPreference).toEqual({ upiId: 'test@upi' });

      // Update preference
      const updated = await requestService.updateRefundPreference(
        req.id,
        {
          refundReceivingSource: RefundReceivingSource.BANK_TRANSFER,
          accountHolderName: 'Admin Updated',
          bankName: 'HDFC',
          accountNumber: '987654321',
          ifscCode: 'HDFC0004567',
        },
        mockUser,
      );

      expect(updated.refundReceivingSource).toBe(
        RefundReceivingSource.BANK_TRANSFER,
      );
      expect(updated.refundPreference).toEqual({
        accountHolderName: 'Admin Updated',
        bankName: 'HDFC',
        accountNumber: '987654321',
        ifscCode: 'HDFC0004567',
      });
    });
  });
});
