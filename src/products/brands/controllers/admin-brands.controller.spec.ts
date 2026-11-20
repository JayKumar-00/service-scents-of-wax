import { Test, TestingModule } from '@nestjs/testing';
import { AdminBrandsController } from './admin-brands.controller';
import { BrandsService } from '../brands.service';

describe('AdminBrandsController', () => {
  let controller: AdminBrandsController;
  const mockBrandsService = {
    list: jest.fn().mockResolvedValue({
      data: [],
      meta: { count: 0, page: 1, limit: 10, totalPages: 0 },
    }),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBrandsController],
      providers: [
        { provide: BrandsService, useValue: mockBrandsService } as any,
      ],
    })
      .overrideProvider(BrandsService)
      .useValue(mockBrandsService)
      .compile();

    controller = module.get<AdminBrandsController>(AdminBrandsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('list should return paginated result', async () => {
    const res = await controller.list({ page: 1, limit: 10, sortBy: 'createdAt', order: 'desc' } as any);
    expect(mockBrandsService.list).toHaveBeenCalled();
    expect(res).toEqual({
      data: [],
      meta: { count: 0, page: 1, limit: 10, totalPages: 0 },
    });
  });
});
