import { Test, TestingModule } from '@nestjs/testing';
import { FranchiseThemeController } from './franchise-theme.controller';

describe('FranchiseThemeController', () => {
  let controller: FranchiseThemeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FranchiseThemeController],
    }).compile();

    controller = module.get<FranchiseThemeController>(FranchiseThemeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
