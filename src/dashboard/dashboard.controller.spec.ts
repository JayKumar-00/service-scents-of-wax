import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Role } from '@prisma/client';
import { JwtUser } from '../auth/types/jwt-user.type';
import { FranchiseDashboardResponseDto } from './dto/franchise-dashboard-response.dto';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockDashboardService = {
    getMetrics: jest.fn(),
    getFranchiseMetrics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    jest.clearAllMocks();
  });

  it('should call service.getFranchiseMetrics with the currentUser and query', async () => {
    const user: JwtUser = {
      sub: 'user-1',
      email: 'owner@gf.com',
      role: Role.FRANCHISE_OWNER,
      franchiseOwnerId: 'franchise-123',
    };
    const query = { period: undefined };
    const mockResponse = {
      overview: {},
      charts: {},
      inventory: {},
      reorderSuggestions: [],
      recentOrders: [],
      recentDeliveries: [],
      topCustomers: [],
      faqPreview: [],
      operationalSummary: {},
    } as any as FranchiseDashboardResponseDto;

    mockDashboardService.getFranchiseMetrics.mockResolvedValue(mockResponse);

    const result = await controller.getFranchiseMetrics(user, query);

    expect(result).toBe(mockResponse);
    expect(mockDashboardService.getFranchiseMetrics).toHaveBeenCalledWith(
      user,
      query,
    );
  });
});
