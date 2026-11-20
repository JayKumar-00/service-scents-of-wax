import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CouponService } from './coupon.service';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';

describe('CouponService', () => {
  let service: CouponService;
  const prismaMock = {
    discount: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    discountUsage: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const redisServiceMock = {
    get: jest.fn(),
    set: jest.fn(),
    clearCacheByPrefix: jest.fn(),
  };

  const auditServiceMock = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: RedisService,
          useValue: redisServiceMock,
        },
        {
          provide: AuditService,
          useValue: auditServiceMock,
        },
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      redisServiceMock.get.mockResolvedValue(null);
      prismaMock.discount.findMany.mockResolvedValue([]);
      prismaMock.discount.count.mockResolvedValue(1);
    });

    it('should query coupons without excluding expired by default', async () => {
      await service.list({ page: 1, limit: 10 });

      expect(prismaMock.discount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('should query coupons and exclude expired when excludeExpired is true', async () => {
      await service.list({ page: 1, limit: 10 }, { excludeExpired: true });

      expect(prismaMock.discount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { endsAt: null },
                  { endsAt: { gte: expect.any(Date) } },
                ],
              },
            ],
          },
        }),
      );
    });
  });
});
