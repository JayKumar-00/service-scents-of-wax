import { Test, TestingModule } from '@nestjs/testing';
import { RevenueService } from './revenue.service';
import { PrismaService } from '../prisma/prisma.service';
import { RevenuePeriod } from './enums/period.enum';
import { JwtUser } from '../auth/types/jwt-user.type';
import { Role } from '@prisma/client';

describe('RevenueService', () => {
  let service: RevenueService;

  const mockPrismaService = {
    order: {
      aggregate: jest.fn().mockImplementation(({ where }) => {
        if (where?.channel === 'POS') {
          return Promise.resolve({ _sum: { total: 400 } });
        }
        if (where?.channel === 'ONLINE') {
          return Promise.resolve({ _sum: { total: 600 } });
        }
        return Promise.resolve({ _sum: { total: 1000 } });
      }),
    },
    stockRequest: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { billingTotal: 500, paidAmount: 500 },
      }),
    },
    purchaseOrder: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { totalAmount: 300 },
      }),
    },
    refund: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { processedRefundAmount: 50, expectedRefundAmount: 50 },
      }),
    },
    franchise: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve({ id: where.id, code: `CODE-${where.id}` });
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RevenueService>(RevenueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate admin revenue metrics and generate graphData matching limit', async () => {
    const res = await service.getAdminRevenue({ period: RevenuePeriod.DAY, limit: 5 });

    expect(res.period).toBe('DAY');
    expect(res.limit).toBe(5);
    expect(res.CustomerOrderRevenues).toBe(7500);
    expect(res.overAllRevanure).toBe(7500);
    expect(res.SupplierPayments).toBe(1500);
    expect(res.RefundLosses).toBe(250);
    expect(res.graphData).toBeDefined();
    expect(res.graphData?.length).toBe(5);
  });

  it('should include franchise specific fields and graphData when getFranchiseRevenue is called', async () => {
    const user: JwtUser = {
      sub: 'u1',
      email: 'owner@franchise.com',
      role: Role.FRANCHISE_OWNER,
      franchiseId: 'f-123',
    };

    const res = await service.getFranchiseRevenue(user, {
      period: RevenuePeriod.MONTHLY,
      limit: 3,
    });

    expect(res.franchiseId).toBe('f-123');
    expect(res.franchiseCode).toBe('CODE-f-123');
    expect(res.limit).toBe(3);
    expect(res.POSRevanue).toBe(1200);
    expect(res.OnlineCustomerRevanue).toBe(1800);
    expect(res.posRevenue).toBe(1200);
    expect(res.onlineCustomerRevenue).toBe(1800);
    expect(res.graphData).toBeDefined();
    expect(res.graphData?.length).toBe(3);
  });

  it('should handle custom date range filtering with fromDate and toDate', async () => {
    const res = await service.getAdminRevenue({
      fromDate: '2026-08-01',
      toDate: '2026-08-05',
    });

    expect(res.period).toBe('CUSTOM');
    expect(res.fromDate).toBe('2026-08-01');
    expect(res.toDate).toBe('2026-08-05');
    expect(res.graphData).toBeDefined();
    expect(res.graphData?.length).toBe(5);
  });
});
