import { Test, TestingModule } from '@nestjs/testing';
import { QcService } from './qc.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

describe('QcService', () => {
  let service: QcService;

  const prisma: any = {
    qualityInspection: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    asn: {
      update: jest.fn(),
    },
    grnLine: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  prisma.$transaction = jest.fn().mockImplementation(async (cb: any) => cb(prisma));

  const audit = { log: jest.fn(), saveToDb: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QcService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<QcService>(QcService);
  });

  it('creates quality inspection', async () => {
    prisma.qualityInspection.create.mockResolvedValue({ id: 'qi_1', status: 'PENDING' });

    const result = await service.create({ grnId: 'grn_1', notes: 'some notes' } as any);

    expect(prisma.qualityInspection.create).toHaveBeenCalled();
    expect(result.status).toBe('PENDING');
  });

  it('updates inspection status to PASSED and updates related ASN status to ARRIVED', async () => {
    const inspectionMock = {
      id: 'qi_1',
      grnId: 'grn_1',
      grn: { id: 'grn_1', asnId: 'asn_1' },
    };
    prisma.qualityInspection.findUnique.mockResolvedValue(inspectionMock);
    prisma.qualityInspection.update.mockResolvedValue({ id: 'qi_1', status: 'PASSED' });

    const result = await service.updateStatus('qi_1', 'PASSED');

    expect(prisma.qualityInspection.update).toHaveBeenCalledWith({
      where: { id: 'qi_1' },
      data: { status: 'PASSED', approvedAt: expect.any(Date) },
    });
    expect(prisma.asn.update).toHaveBeenCalledWith({
      where: { id: 'asn_1' },
      data: { status: 'ARRIVED' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_QC_INSPECTION_STATUS',
        resource: 'QualityInspection',
        resourceId: 'qi_1',
      }),
    );
    expect(result.status).toBe('PASSED');
  });

  it('updates inspection status to FAILED and does not update related ASN status', async () => {
    const inspectionMock = {
      id: 'qi_1',
      grnId: 'grn_1',
      grn: { id: 'grn_1', asnId: 'asn_1' },
    };
    prisma.qualityInspection.findUnique.mockResolvedValue(inspectionMock);
    prisma.qualityInspection.update.mockResolvedValue({ id: 'qi_1', status: 'FAILED' });

    const result = await service.updateStatus('qi_1', 'FAILED');

    expect(prisma.qualityInspection.update).toHaveBeenCalledWith({
      where: { id: 'qi_1' },
      data: { status: 'FAILED' },
    });
    expect(prisma.asn.update).not.toHaveBeenCalled();
    expect(result.status).toBe('FAILED');
  });

  it('generates BASIC report HTML for purchase order', async () => {
    prisma.purchaseOrder = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'po_1',
        poNumber: 'PO-001',
        status: 'APPROVED',
        createdAt: new Date('2026-08-16T10:00:00Z'),
        supplier: { name: 'Test Supplier', phone: '1234567890' },
      }),
    };
    prisma.goodsReceiptNote = {
      findMany: jest.fn().mockResolvedValue([
        {
          grnNumber: 'GRN-001',
          lines: [],
          qualityInspections: [],
        },
      ]),
    };

    const html = await service.generateReport('PO-001', 'BASIC');
    expect(html).toContain('QC REPORT');
    expect(html).toContain('PO-001');
    expect(html).toContain('Test Supplier');
  });

  it('generates COMPLETE report HTML for purchase order with PO, ASN, GRN, and QC sections', async () => {
    prisma.purchaseOrder = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'po_1',
        poNumber: 'PO-001',
        status: 'APPROVED',
        createdAt: new Date('2026-08-16T10:00:00Z'),
        expectedDeliveryDate: new Date('2026-08-20T10:00:00Z'),
        currency: 'INR',
        totalAmount: '5000.00',
        supplier: { name: 'Test Supplier', phone: '1234567890' },
        lines: [
          {
            product: { name: 'Sample Item' },
            orderedQty: 10,
            unitCost: '500.00',
            lineTotal: '5000.00',
          },
        ],
      }),
    };
    prisma.asn = {
      findMany: jest.fn().mockResolvedValue([
        {
          asnNumber: 'ASN-001',
          status: 'ARRIVED',
          createdAt: new Date('2026-08-16T10:30:00Z'),
          lines: [{ product: { name: 'Sample Item' }, expectedQty: 10 }],
        },
      ]),
    };
    prisma.goodsReceiptNote = {
      findMany: jest.fn().mockResolvedValue([
        {
          grnNumber: 'GRN-001',
          status: 'POSTED',
          createdAt: new Date('2026-08-16T11:00:00Z'),
          lines: [
            {
              product: { name: 'Sample Item' },
              receivedQty: 10,
              acceptedQty: 10,
              damagedQty: 0,
              rejectedQty: 0,
              qualityInspection: { status: 'PASSED', notes: 'Checked fine' },
            },
          ],
          qualityInspections: [],
        },
      ]),
    };

    const html = await service.generateReport('PO-001', 'COMPLETE');
    expect(html).toContain('PROCUREMENT REPORT');
    expect(html).toContain('1. PURCHASE ORDER DETAILS & ORDERED ITEMS');
    expect(html).toContain('2. ADVANCED SHIPPING NOTICES (ASN)');
    expect(html).toContain('3. GOODS RECEIPT NOTES (GRN)');
    expect(html).toContain('4. QUALITY CONTROL (QC) INSPECTION DETAILS');
  });
});
