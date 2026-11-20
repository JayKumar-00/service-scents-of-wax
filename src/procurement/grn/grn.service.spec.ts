import { Test, TestingModule } from '@nestjs/testing';
import { GrnService } from './grn.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

describe('GrnService', () => {
  let service: GrnService;

  const prisma: any = {
    goodsReceiptNote: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    grnLine: {
      createMany: jest.fn(),
    },
    purchaseOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrderLine: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    productVariant: {
      update: jest.fn(),
      findMany: jest.fn(),
    },
    warehouseStock: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryLedgerEntry: {
      create: jest.fn(),
    },
    inventoryValuationSnapshot: {
      create: jest.fn(),
    },
    stockingNode: {
      findFirst: jest.fn().mockResolvedValue({ id: 'central_dc_1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'wh_1' }),
    },
    qualityInspection: {
      create: jest.fn().mockResolvedValue({ id: 'qi_1' }),
    },
    asn: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  // mock $transaction to execute the passed callback with the prisma mock
  prisma.$transaction = jest.fn().mockImplementation(async (cb: any) => {
    return cb(prisma);
  });

  const audit = {
    log: jest.fn(),
    saveToDb: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrnService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<GrnService>(GrnService);
  });

  it('creates the GRN header and its lines from the line-level payload', async () => {
    prisma.goodsReceiptNote.create.mockResolvedValue({ id: 'grn_1', grnNumber: 'GRN-001' });
    prisma.goodsReceiptNote.findUnique.mockResolvedValue({
      id: 'grn_1',
      grnNumber: 'GRN-001',
      lines: [{ id: 'line_1' }],
    });

    const result = await service.create({
      grnNumber: 'GRN-001',
      purchaseOrderId: 'po_1',
      supplierId: 'sup_1',
      lines: [
        {
          purchaseOrderLineId: 'pol_1',
          productId: 'prod_1',
          receivedQty: 10,
          acceptedQty: 8,
          damagedQty: 1,
          rejectedQty: 1,
        },
      ],
    });

    expect(prisma.goodsReceiptNote.create).toHaveBeenCalled();
    expect(prisma.grnLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          grnId: 'grn_1',
          purchaseOrderLineId: 'pol_1',
          productId: 'prod_1',
          variantId: null,
          receivedQty: 10,
          acceptedQty: 8,
          damagedQty: 1,
          rejectedQty: 1,
        },
      ],
    });
    expect(result.lines).toHaveLength(1);
  });

  it('posts a GRN and updates product and variant stock and PO status', async () => {
    const grnMock = {
      id: 'grn_1',
      grnNumber: 'GRN-001',
      status: 'DRAFT',
      purchaseOrderId: 'po_1',
      warehouseNodeId: 'wh_1',
      lines: [
        {
          id: 'grnl_1',
          purchaseOrderLineId: 'pol_1',
          productId: 'prod_1',
          variantId: 'var_1',
          receivedQty: 10,
          acceptedQty: 8,
          damagedQty: 1,
          rejectedQty: 1,
        },
      ],
    };

    const poMock = {
      id: 'po_1',
      status: 'APPROVED',
      lines: [
        {
          id: 'pol_1',
          productId: 'prod_1',
          variantId: 'var_1',
          orderedQty: 10,
          receivedQty: 0,
        },
      ],
    };

    prisma.goodsReceiptNote.findUnique.mockResolvedValue(grnMock);
    prisma.warehouseStock.findUnique.mockResolvedValue({ productId: 'prod_1', quantity: 5 });
    prisma.productVariant.findMany.mockResolvedValue([{ id: 'var_1', stock: 5 }]);
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      ...poMock,
      lines: [
        {
          id: 'pol_1',
          productId: 'prod_1',
          variantId: 'var_1',
          orderedQty: 10,
          receivedQty: 10, // Simulated update inside tx
        },
      ],
    });
    prisma.goodsReceiptNote.update.mockResolvedValue({ ...grnMock, status: 'POSTED' });

    const result = await service.post('grn_1', { reference: 'REF-123' });

    expect(prisma.goodsReceiptNote.findUnique).toHaveBeenCalledWith({
      where: { id: 'grn_1' },
      include: {
        lines: {
          include: {
            purchaseOrderLine: true,
          },
        },
        purchaseOrder: true,
      },
    });
    expect(prisma.purchaseOrderLine.update).toHaveBeenCalledWith({
      where: { id: 'pol_1' },
      data: { receivedQty: { increment: 10 } },
    });
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'var_1' },
      data: { stock: { increment: 8 } },
    });
    expect(prisma.product.update).toHaveBeenCalled();
    expect(prisma.warehouseStock.update).toHaveBeenCalledWith({
      where: { productId: 'prod_1' },
      data: { quantity: { increment: 8 } },
    });
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: 'po_1' },
      data: { status: 'RECEIVED' },
    });
    expect(prisma.qualityInspection.create).toHaveBeenCalledWith({
      data: {
        grnId: 'grn_1',
        grnLineId: 'grnl_1',
        status: 'PENDING',
        notes: expect.any(String),
      },
    });
    expect(prisma.goodsReceiptNote.update).toHaveBeenCalledWith({
      where: { id: 'grn_1' },
      data: {
        status: 'POSTED',
        postedAt: expect.any(Date),
        postedByUserId: 'system',
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'POST_GRN',
        metadata: expect.objectContaining({
          reference: 'REF-123',
        }),
      }),
    );
    expect(result.status).toBe('POSTED');
  });

  it('updates GRN status to CANCELLED and logs audit event', async () => {
    prisma.goodsReceiptNote.findUnique.mockResolvedValue({ id: 'grn_1', status: 'DRAFT' });
    prisma.goodsReceiptNote.update.mockResolvedValue({ id: 'grn_1', status: 'CANCELLED' });

    const result = await service.updateStatus('grn_1', 'CANCELLED');

    expect(prisma.goodsReceiptNote.update).toHaveBeenCalledWith({
      where: { id: 'grn_1' },
      data: { status: 'CANCELLED' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_GRN_STATUS',
        resource: 'GoodsReceiptNote',
        resourceId: 'grn_1',
      }),
    );
    expect(result.status).toBe('CANCELLED');
  });
});

