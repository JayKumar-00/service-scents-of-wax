import { Test, TestingModule } from '@nestjs/testing';
import { WebCategoriesController } from './web-categories.controller';

describe('WebCategoriesController', () => {
  let controller: WebCategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebCategoriesController],
    }).compile();

    controller = module.get<WebCategoriesController>(WebCategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
