import { Test, TestingModule } from '@nestjs/testing';
import { OrderSettlementService } from './order-settlement.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SettlementType, OrderSettlementStatus, Prisma, PaymentModeEnum } from '@prisma/client';
import { RedisService } from 'src/redis/redis.service';

describe('OrderSettlementService', () => {
  let service: OrderSettlementService;
  let prismaMock: any;
  let configMock: any;
  let redisMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      orderSettlement: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
      creditAccount: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      creditTransaction: {
        create: jest.fn(),
      },
      customer: {
        findFirst: jest.fn(),
      },
      referral: {
        findUnique: jest.fn(),
      },
    };

    configMock = {
      get: jest.fn((key, defaultValue) => {
        if (key === 'AFFILIATE_COMMISSION_PERCENT') return 10;
        return defaultValue;
      }),
    };

    redisMock = {
      clearCacheByPrefix: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderSettlementService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ConfigService,
          useValue: configMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<OrderSettlementService>(OrderSettlementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('settleFranchise', () => {
    it('should skip if franchise settlement already exists', async () => {
      const existingSettlement = {
        id: 'settlement_123',
        status: OrderSettlementStatus.SETTLED,
      };
      prismaMock.orderSettlement.findUnique.mockResolvedValue(
        existingSettlement,
      );

      const result = await service.settleFranchise('order_123');

      expect(result).toEqual(existingSettlement);
      expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
    });

    it('should create a pending settlement and then mark it as settled after updating wallet', async () => {
      prismaMock.orderSettlement.findUnique.mockResolvedValue(null);

      const mockOrder = {
        id: 'order_123',
        orderNumber: 'GF-12345',
        franchiseId: 'fran_123',
        franchisePaybleAmount: 150.0,
        total: 1000.0,
        paymentMode: PaymentModeEnum.ONLINE,
      };
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      const pendingSettlement = {
        id: 'settlement_123',
        status: OrderSettlementStatus.PENDING,
      };
      prismaMock.orderSettlement.create.mockResolvedValue(pendingSettlement);

      const mockCreditAccount = {
        id: 'account_123',
        franchiseId: 'fran_123',
        walletBalance: 500.0,
      };
      prismaMock.creditAccount.findUnique.mockResolvedValue(mockCreditAccount);

      const mockCreditTx = { id: 'tx_123' };
      prismaMock.creditTransaction.create.mockResolvedValue(mockCreditTx);

      const finalizedSettlement = {
        id: 'settlement_123',
        status: OrderSettlementStatus.SETTLED,
      };
      prismaMock.orderSettlement.update.mockResolvedValue(finalizedSettlement);

      const result = await service.settleFranchise('order_123');

      expect(prismaMock.orderSettlement.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order_123',
          type: SettlementType.FRANCHISE,
          amount: new Prisma.Decimal(150.0),
          status: OrderSettlementStatus.PENDING,
        },
      });

      expect(prismaMock.creditTransaction.create).toHaveBeenCalled();
      expect(prismaMock.creditAccount.update).toHaveBeenCalledWith({
        where: { id: 'account_123' },
        data: { walletBalance: 650.0 },
      });

      expect(prismaMock.orderSettlement.update).toHaveBeenCalledWith({
        where: { id: 'settlement_123' },
        data: {
          status: OrderSettlementStatus.SETTLED,
          creditTransactionId: 'tx_123',
          processedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(finalizedSettlement);
    });

    it('should settle franchise with 0 amount and no wallet update for COD Pickup orders', async () => {
      prismaMock.orderSettlement.findUnique.mockResolvedValue(null);

      const mockOrder = {
        id: 'order_cod',
        orderNumber: 'GF-54321',
        franchiseId: 'fran_123',
        franchisePaybleAmount: 150.0,
        total: 1000.0,
        paymentMode: PaymentModeEnum.COD,
        saleType: 'Pickup',
      };
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      const pendingSettlement = {
        id: 'settlement_cod',
        status: OrderSettlementStatus.PENDING,
      };
      prismaMock.orderSettlement.create.mockResolvedValue(pendingSettlement);

      const finalizedSettlement = {
        id: 'settlement_cod',
        status: OrderSettlementStatus.SETTLED,
      };
      prismaMock.orderSettlement.update.mockResolvedValue(finalizedSettlement);

      const result = await service.settleFranchise('order_cod');

      expect(prismaMock.orderSettlement.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order_cod',
          type: SettlementType.FRANCHISE,
          amount: new Prisma.Decimal(0),
          status: OrderSettlementStatus.PENDING,
        },
      });

      expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled();
      expect(prismaMock.creditAccount.update).not.toHaveBeenCalled();

      expect(prismaMock.orderSettlement.update).toHaveBeenCalledWith({
        where: { id: 'settlement_cod' },
        data: {
          status: OrderSettlementStatus.SETTLED,
          creditTransactionId: null,
          processedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(finalizedSettlement);
    });

    it('should settle franchise with franchisePaybleAmount for COD Delivery orders', async () => {
      prismaMock.orderSettlement.findUnique.mockResolvedValue(null);

      const mockOrder = {
        id: 'order_cod_delivery',
        orderNumber: 'GF-54321-D',
        franchiseId: 'fran_123',
        franchisePaybleAmount: 150.0,
        total: 1000.0,
        paymentMode: PaymentModeEnum.COD,
        saleType: 'Delivery',
      };
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      const pendingSettlement = {
        id: 'settlement_cod_del',
        status: OrderSettlementStatus.PENDING,
      };
      prismaMock.orderSettlement.create.mockResolvedValue(pendingSettlement);

      const mockCreditAccount = {
        id: 'account_123',
        franchiseId: 'fran_123',
        walletBalance: 500.0,
      };
      prismaMock.creditAccount.findUnique.mockResolvedValue(mockCreditAccount);

      const mockCreditTx = { id: 'tx_cod_del' };
      prismaMock.creditTransaction.create.mockResolvedValue(mockCreditTx);

      const finalizedSettlement = {
        id: 'settlement_cod_del',
        status: OrderSettlementStatus.SETTLED,
      };
      prismaMock.orderSettlement.update.mockResolvedValue(finalizedSettlement);

      const result = await service.settleFranchise('order_cod_delivery');

      expect(prismaMock.orderSettlement.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order_cod_delivery',
          type: SettlementType.FRANCHISE,
          amount: new Prisma.Decimal(150.0),
          status: OrderSettlementStatus.PENDING,
        },
      });

      expect(prismaMock.creditTransaction.create).toHaveBeenCalled();
      expect(prismaMock.creditAccount.update).toHaveBeenCalledWith({
        where: { id: 'account_123' },
        data: { walletBalance: 650.0 },
      });

      expect(prismaMock.orderSettlement.update).toHaveBeenCalledWith({
        where: { id: 'settlement_cod_del' },
        data: {
          status: OrderSettlementStatus.SETTLED,
          creditTransactionId: 'tx_cod_del',
          processedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(finalizedSettlement);
    });
  });

  describe('settleAffiliate', () => {
    it('should settle affiliate with 10% commission when referralCode matches customer', async () => {
      prismaMock.orderSettlement.findUnique.mockResolvedValue(null);

      const mockOrder = {
        id: 'order_123',
        total: 1000.0,
        referralCode: 'REF100',
        customerId: 'customer_123',
      };
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      const mockReferrerCustomer = { id: 'referrer_123' };
      prismaMock.customer.findFirst.mockResolvedValue(mockReferrerCustomer);

      const pendingSettlement = {
        id: 'settlement_456',
        status: OrderSettlementStatus.PENDING,
      };
      prismaMock.orderSettlement.create.mockResolvedValue(pendingSettlement);

      const settledResult = {
        id: 'settlement_456',
        status: OrderSettlementStatus.SETTLED,
      };
      prismaMock.orderSettlement.update.mockResolvedValue(settledResult);

      const result = await service.settleAffiliate('order_123');

      expect(prismaMock.orderSettlement.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order_123',
          type: SettlementType.AFFILIATE,
          amount: new Prisma.Decimal(100.0),
          status: OrderSettlementStatus.PENDING,
          affiliateCustomerId: 'referrer_123',
        },
      });

      expect(prismaMock.orderSettlement.update).toHaveBeenCalledWith({
        where: { id: 'settlement_456' },
        data: {
          status: OrderSettlementStatus.SETTLED,
          processedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(settledResult);
    });
  });
});
