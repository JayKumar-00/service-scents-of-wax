import { Test, TestingModule } from '@nestjs/testing';
import { AdminFranchiseController } from './admin-franchise.controller';
import { AdminFranchiseService } from './admin-franchise.service';

describe('AdminFranchiseController', () => {
  let controller: AdminFranchiseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminFranchiseController],
      providers: [{ provide: AdminFranchiseService, useValue: {} }],
    }).compile();

    controller = module.get<AdminFranchiseController>(AdminFranchiseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
