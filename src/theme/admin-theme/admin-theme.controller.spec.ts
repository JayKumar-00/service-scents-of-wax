import { Test, TestingModule } from '@nestjs/testing';
import { AdminThemeController } from './admin-theme.controller';

describe('AdminThemeController', () => {
  let controller: AdminThemeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminThemeController],
    }).compile();

    controller = module.get<AdminThemeController>(AdminThemeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
