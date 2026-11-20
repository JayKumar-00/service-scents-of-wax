import { Test, TestingModule } from '@nestjs/testing';
import { ProductReturnController } from './product-return.controller';
import { ProductReturnService } from './product-return.service';

describe('ProductReturnController', () => {
  let controller: ProductReturnController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductReturnController],
      providers: [
        {
          provide: ProductReturnService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ProductReturnController>(ProductReturnController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
