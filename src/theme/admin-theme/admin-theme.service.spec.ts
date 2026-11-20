import { Test, TestingModule } from '@nestjs/testing';
import { AdminThemeService } from './admin-theme.service';

describe('AdminThemeService', () => {
  let service: AdminThemeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminThemeService],
    }).compile();

    service = module.get<AdminThemeService>(AdminThemeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
