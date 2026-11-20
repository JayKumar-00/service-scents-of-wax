import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { PurchaseOrderStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;

  const prisma: any = {
    purchaseOrder: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    purchaseOrderLine: { createMany: jest.fn(), update: jest.fn() },
    productVariant: { update: jest.fn(), findMany: jest.fn() },
    product: { update: jest.fn(), findUnique: jest.fn() },
    warehouseStock: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    inventoryLedgerEntry: { create: jest.fn() },
    inventoryValuationSnapshot: { create: jest.fn() },
    stockingNode: {
      findFirst: jest.fn().mockResolvedValue({ id: 'central_dc_1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'wh_1' }),
    },
  };

  prisma.$transaction = jest.fn().mockImplementation(async (cb: any) => cb(prisma));

  const audit = { log: jest.fn(), saveToDb: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  it('creates PO header and lines transactionally', async () => {
    prisma.purchaseOrder.create.mockResolvedValue({ id: 'po_1', poNumber: 'PO-001' });
    prisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po_1', poNumber: 'PO-001', lines: [{ id: 'pol_1' }] });

    const result = await service.create({
      poNumber: 'PO-001',
      supplierId: 'sup_1',
      lines: [
        { productId: 'prod_1', orderedQty: 2, unitCost: '100' },
      ],
    } as any);

    expect(prisma.purchaseOrder.create).toHaveBeenCalled();
    expect(prisma.purchaseOrderLine.createMany).toHaveBeenCalled();
    expect(result.lines).toHaveLength(1);
  });

  it('delivers a purchase order and updates variant and product stocks', async () => {
    const poMock = {
      id: 'po_1',
      poNumber: 'PO-001',
      status: 'APPROVED',
      warehouseNodeId: 'wh_1',
      lines: [
        {
          id: 'pol_1',
          productId: 'prod_1',
          variantId: 'var_1',
          orderedQty: 10,
          receivedQty: 0,
          unitCost: '150.00',
        },
      ],
    };

    prisma.purchaseOrder.findUnique.mockResolvedValue(poMock);
    prisma.productVariant.findMany.mockResolvedValue([{ id: 'var_1', stock: 10 }]);
    prisma.warehouseStock.findUnique.mockResolvedValue({ productId: 'prod_1', quantity: 5 });
    prisma.purchaseOrder.update.mockResolvedValue({ ...poMock, status: 'RECEIVED' });

    const result = await service.deliver('po_1');

    expect(prisma.purchaseOrder.findUnique).toHaveBeenCalledWith({
      where: { id: 'po_1' },
      include: { lines: true },
    });
    expect(prisma.purchaseOrderLine.update).toHaveBeenCalledWith({
      where: { id: 'pol_1' },
      data: { receivedQty: 10 },
    });
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'var_1' },
      data: {
        stock: { increment: 10 },
        basePrice: expect.any(Object),
      },
    });
    expect(prisma.product.update).toHaveBeenCalled();
    expect(prisma.warehouseStock.update).toHaveBeenCalledWith({
      where: { productId: 'prod_1' },
      data: { quantity: { increment: 10 } },
    });
    expect(prisma.inventoryLedgerEntry.create).toHaveBeenCalled();
    expect(prisma.inventoryValuationSnapshot.create).toHaveBeenCalled();
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: 'po_1' },
      data: { status: 'RECEIVED' },
    });
    expect(result.status).toBe('RECEIVED');
  });

  describe('updateStatus', () => {
    it('delegates to approve if status is APPROVED', async () => {
      const poMock = { id: 'po_1', poNumber: 'PO-001', status: 'DRAFT' };
      prisma.purchaseOrder.update.mockResolvedValue({ ...poMock, status: 'APPROVED', approvedAt: new Date() });

      const result = await service.updateStatus('po_1', 'APPROVED');

      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po_1' },
        data: {
          status: 'APPROVED',
          approvedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe('APPROVED');
    });

    it('delegates to deliver if status is RECEIVED', async () => {
      const poMock = {
        id: 'po_1',
        poNumber: 'PO-001',
        status: 'APPROVED',
        warehouseNodeId: 'wh_1',
        lines: [],
      };
      prisma.purchaseOrder.findUnique.mockResolvedValue(poMock);
      prisma.purchaseOrder.update.mockResolvedValue({ ...poMock, status: 'RECEIVED' });

      const result = await service.updateStatus('po_1', 'RECEIVED');

      expect(prisma.purchaseOrder.findUnique).toHaveBeenCalledWith({
        where: { id: 'po_1' },
        include: { lines: true },
      });
      expect(result.status).toBe('RECEIVED');
    });

    it('updates status and sets sentAt if status is SENT', async () => {
      const poMock = { id: 'po_1', poNumber: 'PO-001', status: 'APPROVED' };
      prisma.purchaseOrder.findUnique.mockResolvedValue(poMock);
      prisma.purchaseOrder.update.mockResolvedValue({ ...poMock, status: 'SENT', sentAt: new Date() });

      const result = await service.updateStatus('po_1', 'SENT');

      expect(prisma.purchaseOrder.findUnique).toHaveBeenCalledWith({ where: { id: 'po_1' } });
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po_1' },
        data: { status: 'SENT', sentAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith({
        userId: 'system',
        action: 'UPDATE_PURCHASE_ORDER_STATUS',
        resource: 'PurchaseOrder',
        resourceId: 'po_1',
        metadata: { poNumber: 'PO-001', status: 'SENT' },
      });
      expect(result.status).toBe('SENT');
    });

    it('throws NotFoundException if purchase order does not exist', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('po_none', 'SENT')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates the custom userId to the audit log', async () => {
      const poMock = { id: 'po_1', poNumber: 'PO-001', status: 'APPROVED' };
      prisma.purchaseOrder.findUnique.mockResolvedValue(poMock);
      prisma.purchaseOrder.update.mockResolvedValue({ ...poMock, status: 'SENT' });

      await service.updateStatus('po_1', 'SENT', 'user_123');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_123',
        }),
      );
    });
  });
});
