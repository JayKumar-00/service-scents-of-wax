/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import type { BrandsService as BrandsServiceType } from './brands.service';
import 'tsconfig-paths/register';

const mockPrisma: Partial<Record<string, any>> = {
  brand: {
    create: jest
      .fn()
      .mockResolvedValue({ id: '1', name: 'Brand', slug: 'brand' }),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest
      .fn()
      .mockResolvedValue({ id: '1', name: 'Brand', slug: 'brand' }),
    delete: jest.fn().mockResolvedValue({}),
  },
};

const mockRedis: Partial<Record<string, any>> = {
  get: jest.fn(),
  set: jest.fn(),
  clearCacheByPrefix: jest.fn(),
  del: jest.fn(),
};

let BrandsServiceFactory: new (...args: any[]) => any;
let PrismaServiceToken: any;
let RedisServiceToken: any;

beforeAll(async () => {
  jest.doMock('../../prisma/prisma.service', () => ({
    PrismaService: jest.fn(),
  }));
  jest.doMock('../../redis/redis.service', () => ({
    RedisService: jest.fn(),
  }));

  await jest.isolateModulesAsync(async () => {
    const prisma = await import('../../prisma/prisma.service');
    const redis = await import('../../redis/redis.service');

    BrandsServiceFactory = (await import('./brands.service')).BrandsService;
    PrismaServiceToken = jest.mocked(prisma.PrismaService);
    RedisServiceToken = jest.mocked(redis.RedisService);
  });

  PrismaServiceToken.mockImplementation(() => mockPrisma);
  RedisServiceToken.mockImplementation(() => mockRedis);
});

afterAll(() => {
  PrismaServiceToken.mockReset();
  RedisServiceToken.mockReset();
});

describe('BrandsService', () => {
  let service: BrandsServiceType;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsServiceFactory as any,
        { provide: PrismaServiceToken, useValue: mockPrisma },
        { provide: RedisServiceToken, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<BrandsServiceType>(BrandsServiceFactory as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should call prisma.create and invalidate brand caches', async () => {
    const dto = { name: 'Brand', slug: 'brand' } as any;
    const prismaBrandCreate = (mockPrisma.brand as any).create as jest.Mock;
    const redisClear = mockRedis.clearCacheByPrefix as any as jest.Mock;

    const user = { sub: '1', role: 'SUPERADMIN' } as any;
    const res = await service.create(user, dto, '127.0.0.1');

    expect(prismaBrandCreate).toHaveBeenCalled();
    expect(redisClear).toHaveBeenCalledWith('brands:');
    expect(res).toHaveProperty('id', '1');
  });

  it('list should return cached result when redis has value', async () => {
    const cached = {
      data: [],
      meta: { count: 0, page: 1, limit: 10, totalPages: 0 },
    };
    (mockRedis.get as jest.Mock).mockResolvedValueOnce(cached);

    const res = await service.list({ page: 1, limit: 10 } as any);
    expect(mockRedis.get).toHaveBeenCalled();
    expect(res).toBe(cached);
  });

  it('findById should return cached brand when redis has value', async () => {
    const cachedBrand = { id: '1', name: 'Brand' };
    (mockRedis.get as jest.Mock).mockResolvedValueOnce(cachedBrand);

    const res = await service.findById('1');
    expect(mockRedis.get).toHaveBeenCalled();
    expect(res).toBe(cachedBrand);
  });
});
