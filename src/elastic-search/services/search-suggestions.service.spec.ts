import { Test, TestingModule } from '@nestjs/testing';
import { SearchSuggestionsService } from './search-suggestions.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('SearchSuggestionsService', () => {
  let service: SearchSuggestionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchSuggestionsService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findMany: jest.fn(),
            },
            brand: {
              findMany: jest.fn(),
            },
            category: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SearchSuggestionsService>(SearchSuggestionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
