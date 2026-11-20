import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyTier } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/services/notification.service';
import { BrevoService } from 'src/notification/services/brevo.service';
import { getQueueToken } from '@nestjs/bullmq';
import { RetentionService } from './retention.service';

describe('RetentionService', () => {
  let service: RetentionService;
  const prismaMock: any = {
    customer: {
      findUnique: jest.fn(),
    },
    retentionSnapshot: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    loyaltyTransaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    newsletterSubscriber: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
  prismaMock.$transaction = jest.fn((cb) => cb(prismaMock));

  const notificationMock = {
    notify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: NotificationService,
          useValue: notificationMock,
        },
        {
          provide: BrevoService,
          useValue: { sendEmail: jest.fn() },
        },
        {
          provide: getQueueToken('retention'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateTier', () => {
    it('should assign BRONZE tier for spend < 5000', () => {
      expect(service.calculateTier(0)).toBe(LoyaltyTier.BRONZE);
      expect(service.calculateTier(4999)).toBe(LoyaltyTier.BRONZE);
    });

    it('should assign SILVER tier for spend between 5000 and 14999', () => {
      expect(service.calculateTier(5000)).toBe(LoyaltyTier.SILVER);
      expect(service.calculateTier(14999)).toBe(LoyaltyTier.SILVER);
    });

    it('should assign GOLD tier for spend between 15000 and 49999', () => {
      expect(service.calculateTier(15000)).toBe(LoyaltyTier.GOLD);
      expect(service.calculateTier(49999)).toBe(LoyaltyTier.GOLD);
    });

    it('should assign PLATINUM tier for spend >= 50000', () => {
      expect(service.calculateTier(50000)).toBe(LoyaltyTier.PLATINUM);
      expect(service.calculateTier(100000)).toBe(LoyaltyTier.PLATINUM);
    });
  });

  describe('getCategoryEngagementAnalytics', () => {
    it('should correctly sum PRODUCT_VIEW and CATEGORY_VIEW counts for totalViews', async () => {
      // Mock category queries
      prismaMock.category = {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'cat-1', name: 'Test Category', slug: 'test-category' },
          ]),
      };

      // Mock prisma.customerCategoryInterest
      prismaMock.customerCategoryInterest = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      // Mock prisma.orderItem and wishlist
      prismaMock.orderItem = {
        count: jest.fn().mockResolvedValue(0),
      };
      prismaMock.wishlist = {
        count: jest.fn().mockResolvedValue(0),
      };

      // Mock customerActivity.groupBy to return both PRODUCT_VIEW and CATEGORY_VIEW groups
      prismaMock.customerActivity = {
        groupBy: jest.fn().mockResolvedValue([
          { type: 'PRODUCT_VIEW', _count: { id: 10 } },
          { type: 'CATEGORY_VIEW', _count: { id: 5 } },
          { type: 'PRODUCT_WISHLIST', _count: { id: 2 } },
        ]),
      };

      const result = await service.getCategoryEngagementAnalytics({
        page: 1,
        limit: 10,
      });

      expect(result.data[0].totalViews).toBe(15); // 10 (PRODUCT_VIEW) + 5 (CATEGORY_VIEW)
      expect(result.data[0].totalWishlists).toBe(2);
    });
  });
});
