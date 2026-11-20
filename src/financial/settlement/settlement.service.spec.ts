import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService } from './settlement.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderSettlementService } from 'src/orders/services/order-settlement.service';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';

describe('SettlementService', () => {
  let service: SettlementService;
  let prismaMock: any;
  let orderSettlementMock: any;
  let redisMock: any;
  let auditMock: any;

  beforeEach(async () => {
    prismaMock = {};
    orderSettlementMock = {};
    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
    };
    auditMock = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: OrderSettlementService,
          useValue: orderSettlementMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
        {
          provide: AuditService,
          useValue: auditMock,
        },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
