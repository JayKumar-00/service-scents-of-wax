import { Test, TestingModule } from '@nestjs/testing';
import { SmartSearchService } from './smart-search.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchSuggestionsService } from './search-suggestions.service';
import { TranslateService } from './translate.service';
import { ConfigService } from '@nestjs/config';
import { WarehouseService } from 'src/warehouse/warehouse.service';

describe('SmartSearchService', () => {
  let service: SmartSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartSearchService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findMany: jest.fn(),
            },
            category: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: SearchSuggestionsService,
          useValue: {
            suggest: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: TranslateService,
          useValue: {
            translateToEnglish: jest.fn().mockResolvedValue(''),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: WarehouseService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SmartSearchService>(SmartSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
