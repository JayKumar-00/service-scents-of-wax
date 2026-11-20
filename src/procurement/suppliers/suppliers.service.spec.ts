import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SupplierStatusDto } from './dto/create-supplier.dto';

describe('SuppliersService', () => {
  let service: SuppliersService;

  const prisma = {
    supplier: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const audit = {
    log: jest.fn(),
    saveToDb: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  it('creates a supplier and persists it', async () => {
    prisma.supplier.create.mockResolvedValue({ id: 'sup_1', code: 'SUP-001', name: 'Test Supplier' });

    const result = await service.create({
      code: 'SUP-001',
      name: 'Test Supplier',
      email: 'supplier@example.com',
      phone: '9999999999',
      status: SupplierStatusDto.ACTIVE,
    });

    expect(prisma.supplier.create).toHaveBeenCalled();
    expect(result.code).toBe('SUP-001');
  });
});
