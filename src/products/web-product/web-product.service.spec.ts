import { Test, TestingModule } from '@nestjs/testing';
import { WebProductService } from './web-product.service';

describe('WebProductService', () => {
  let service: WebProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebProductService],
    }).compile();

    service = module.get<WebProductService>(WebProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
