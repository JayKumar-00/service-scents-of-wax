/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import type { CategoriesService as CategoriesServiceType } from './categories.service';
import 'tsconfig-paths/register';

const mockPrisma: any = {
  category: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'c1', name: 'Cat1' }),
    update: jest.fn().mockResolvedValue({ id: 'c1', name: 'Cat1' }),
    delete: jest.fn().mockResolvedValue({}),
  },
};

const mockRedis: any = {
  get: jest.fn(),
  set: jest.fn(),
  clearCacheByPrefix: jest.fn(),
  del: jest.fn(),
};

let CategoriesServiceFactory: new (...args: any[]) => any;
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

    CategoriesServiceFactory = (await import('./categories.service'))
      .CategoriesService;
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

describe('CategoriesService', () => {
  let service: CategoriesServiceType;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesServiceFactory as any,
        { provide: PrismaServiceToken, useValue: mockPrisma },
        { provide: RedisServiceToken, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<CategoriesServiceType>(
      CategoriesServiceFactory as any,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('categoriesFlat returns cached when redis has value', async () => {
    const cached = {
      data: [{ id: 'c1', name: 'Cat1' }],
      meta: { count: 1, page: 1, limit: 10, totalPages: 1 },
    };
    (mockRedis.get as jest.Mock).mockResolvedValueOnce(cached);

    const res = await service.categoriesFlat({ page: 1, limit: 10 } as any);
    expect(mockRedis.get).toHaveBeenCalled();
    expect(res).toBe(cached);
  });

  it('createCategory invalidates caches', async () => {
    const dto = { name: 'New', slug: 'new' } as any;
    const user = { sub: '1', role: 'SUPERADMIN' } as any;
    const res = await service.createCategory(user, dto, '127.0.0.1');
    expect(mockPrisma.category.create).toHaveBeenCalled();
    expect(mockRedis.clearCacheByPrefix).toHaveBeenCalledWith('categories:');
    expect(res).toHaveProperty('id', 'c1');
  });
});
