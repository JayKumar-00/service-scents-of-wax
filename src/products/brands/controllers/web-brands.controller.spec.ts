import { Test, TestingModule } from '@nestjs/testing';
import { WebBrandsController } from './web-brands.controller';

describe('WebBrandsController', () => {
  let controller: WebBrandsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebBrandsController],
    }).compile();

    controller = module.get<WebBrandsController>(WebBrandsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
