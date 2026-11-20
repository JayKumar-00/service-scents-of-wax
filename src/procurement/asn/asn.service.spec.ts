import { Test, TestingModule } from '@nestjs/testing';
import { AsnService } from './asn.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

describe('AsnService', () => {
  let service: AsnService;

  const prisma: any = {
    asn: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    asnLine: { createMany: jest.fn() },
  };

  prisma.$transaction = jest.fn().mockImplementation(async (cb: any) => cb(prisma));

  const audit = { log: jest.fn(), saveToDb: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsnService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AsnService>(AsnService);
  });

  it('creates ASN header and lines transactionally', async () => {
    prisma.asn.create.mockResolvedValue({ id: 'asn_1', asnNumber: 'ASN-001' });
    prisma.asn.findUnique.mockResolvedValue({ id: 'asn_1', asnNumber: 'ASN-001', lines: [{ id: 'al_1' }] });

    const result = await service.create({ asnNumber: 'ASN-001', supplierId: 'sup_1', lines: [{ productId: 'prod_1' }] } as any);

    expect(prisma.asn.create).toHaveBeenCalled();
    expect(prisma.asnLine.createMany).toHaveBeenCalled();
    expect(result.lines).toHaveLength(1);
  });

  it('updates ASN status and logs audit event', async () => {
    prisma.asn.update.mockResolvedValue({ id: 'asn_1', status: 'ARRIVED', asnNumber: 'ASN-001' });

    const result = await service.updateStatus('asn_1', 'ARRIVED');

    expect(prisma.asn.update).toHaveBeenCalledWith({
      where: { id: 'asn_1' },
      data: { status: 'ARRIVED' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_ASN_STATUS',
        resource: 'Asn',
        resourceId: 'asn_1',
      }),
    );
    expect(result.status).toBe('ARRIVED');
  });
});

