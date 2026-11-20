import { Test, TestingModule } from '@nestjs/testing';
import { TranslateService } from './translate.service';
import { ConfigService } from '@nestjs/config';

describe('TranslateService', () => {
  let service: TranslateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranslateService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TranslateService>(TranslateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
