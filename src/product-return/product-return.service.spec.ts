import { Test, TestingModule } from '@nestjs/testing';
import { ProductReturnService } from './product-return.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductReturnService', () => {
  let service: ProductReturnService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductReturnService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ProductReturnService>(ProductReturnService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
