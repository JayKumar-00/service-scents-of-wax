import { Test, TestingModule } from '@nestjs/testing';
import { WebProductController } from './web-product.controller';

describe('WebProductController', () => {
  let controller: WebProductController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebProductController],
    }).compile();

    controller = module.get<WebProductController>(WebProductController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
