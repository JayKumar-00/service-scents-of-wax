import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionService } from './suggestion.service';

describe('SuggestionService', () => {
  let service: SuggestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionService,
        {
          provide: 'SUGGESTION_PROVIDER',
          useValue: {
            fetchSuggestions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SuggestionService>(SuggestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
