import { Test, TestingModule } from '@nestjs/testing';
import { WebController } from './web.controller';
import { CouponService } from './coupon.service';

describe('WebController', () => {
  let controller: WebController;
  const couponServiceMock = {
    list: jest.fn(),
    getById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebController],
      providers: [
        {
          provide: CouponService,
          useValue: couponServiceMock,
        },
      ],
    }).compile();

    controller = module.get<WebController>(WebController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
