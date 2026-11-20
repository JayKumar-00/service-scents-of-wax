import { Test, TestingModule } from '@nestjs/testing';
import { OrderDiscountService } from './order-discount.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CatalogPromotionService } from '../../promotions/catalog-promotion.service';

describe('OrderDiscountService', () => {
  let service: OrderDiscountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderDiscountService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: CatalogPromotionService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<OrderDiscountService>(OrderDiscountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
