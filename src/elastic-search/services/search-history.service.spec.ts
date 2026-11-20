import { Test, TestingModule } from '@nestjs/testing';
import { SearchHistoryService } from './search-history.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('SearchHistoryService', () => {
  let service: SearchHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchHistoryService,
        {
          provide: PrismaService,
          useValue: {
            searchHistory: {
              create: jest.fn(),
              count: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              deleteMany: jest.fn(),
            },
            product: {
              findFirst: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            orderItem: {
              groupBy: jest.fn(),
            },
            $transaction: jest.fn(async (callback: any) =>
              callback({
                searchHistory: {
                  create: jest.fn(),
                },
                product: {
                  update: jest.fn(),
                },
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<SearchHistoryService>(SearchHistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
