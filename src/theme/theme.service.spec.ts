import { Test, TestingModule } from '@nestjs/testing';
import { AdminThemeService } from './admin-theme/admin-theme.service';

describe('ThemeService', () => {
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
