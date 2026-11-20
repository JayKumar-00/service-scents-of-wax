import { Test, TestingModule } from '@nestjs/testing';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';
import { RevenuePeriod } from './enums/period.enum';
import { JwtUser } from '../auth/types/jwt-user.type';
import { Role } from '@prisma/client';
import { PdfGenerator } from '../common/utils/pdf-generator.util';

describe('RevenueController', () => {
  let controller: RevenueController;
  let service: RevenueService;

  const mockRevenueResponse = {
    period: 'DAY',
    startDate: new Date('2026-08-18T18:30:00Z').toISOString(),
    endDate: new Date('2026-08-19T05:55:00Z').toISOString(),
    franchiseId: 'cmqt5xidd000uipmg9601i25',
    franchiseCode: 'GF-TEST-CODE',
    limit: 7,
    overAllRevanure: 291695.91,
    SupplierPayments: 1277672,
    CustomerOrderRevenues: 30993,
    RefundLosses: 0,
    POSRevanue: 10799,
    OnlineCustomerRevanue: 20194,
    overallRevenue: 291695.91,
    supplierPayments: 1277672,
    customerOrderRevenues: 30993,
    refundLosses: 0,
    posRevenue: 10799,
    onlineCustomerRevenue: 20194,
    graphData: [
      {
        label: '2026-08-12',
        startDate: '2026-08-12T00:00:00Z',
        endDate: '2026-08-12T23:59:59Z',
        overallRevenue: 34970.91,
        supplierPayments: 1200500,
        customerOrderRevenues: 12897,
        refundLosses: 0,
        posRevenue: 2800,
        onlineCustomerRevenue: 10097,
      },
    ],
  };

  const mockRevenueService = {
    getAdminRevenue: jest.fn().mockResolvedValue(mockRevenueResponse),
    getFranchiseRevenue: jest.fn().mockResolvedValue(mockRevenueResponse),
  };

  beforeEach(async () => {
    jest.spyOn(PdfGenerator, 'generateFromHtml').mockResolvedValue(Buffer.from('PDF_DUMMY_BYTES'));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RevenueController],
      providers: [
        {
          provide: RevenueService,
          useValue: mockRevenueService,
        },
      ],
    }).compile();

    controller = module.get<RevenueController>(RevenueController);
    service = module.get<RevenueService>(RevenueService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return admin revenue metrics JSON', async () => {
    const res = await controller.getAdminRevenue({ period: RevenuePeriod.DAY });
    expect(res).toEqual(mockRevenueResponse);
    expect(service.getAdminRevenue).toHaveBeenCalledWith({
      period: RevenuePeriod.DAY,
      franchiseId: undefined,
      limit: undefined,
    });
  });

  it('should send HTML for admin revenue preview', async () => {
    const mockRes: any = {
      setHeader: jest.fn(),
      send: jest.fn((content) => content),
    };

    await controller.previewAdminRevenue({ period: RevenuePeriod.DAY }, mockRes);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(mockRes.send).toHaveBeenCalled();
    const sentHtml = mockRes.send.mock.calls[0][0];
    expect(sentHtml).toContain('ADMIN REVENUE REPORT');
    expect(sentHtml).toContain('2,91,695.91');
  });

  it('should send PDF buffer for admin revenue download', async () => {
    const mockRes: any = {
      setHeader: jest.fn(),
      send: jest.fn((content) => content),
    };

    await controller.downloadAdminRevenue({ period: RevenuePeriod.DAY }, mockRes);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="Admin-Revenue-Report-DAY.pdf"',
    );
    expect(mockRes.send).toHaveBeenCalledWith(Buffer.from('PDF_DUMMY_BYTES'));
  });

  it('should send HTML for franchise revenue preview', async () => {
    const mockUser: JwtUser = {
      sub: 'user1',
      email: 'franchise@test.com',
      role: Role.FRANCHISE_OWNER,
      franchiseId: 'cmqt5xidd000uipmg9601i25',
    };

    const mockRes: any = {
      setHeader: jest.fn(),
      send: jest.fn((content) => content),
    };

    await controller.previewFranchiseRevenue(mockUser, { period: RevenuePeriod.DAY }, mockRes);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(mockRes.send).toHaveBeenCalled();
    const sentHtml = mockRes.send.mock.calls[0][0];
    expect(sentHtml).toContain('FRANCHISE REVENUE REPORT');
  });

  it('should send PDF buffer for franchise revenue download', async () => {
    const mockUser: JwtUser = {
      sub: 'user1',
      email: 'franchise@test.com',
      role: Role.FRANCHISE_OWNER,
      franchiseId: 'cmqt5xidd000uipmg9601i25',
    };

    const mockRes: any = {
      setHeader: jest.fn(),
      send: jest.fn((content) => content),
    };

    await controller.downloadFranchiseRevenue(mockUser, { period: RevenuePeriod.DAY }, mockRes);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="Franchise-Revenue-Report-GF-TEST-CODE-DAY.pdf"',
    );
    expect(mockRes.send).toHaveBeenCalledWith(Buffer.from('PDF_DUMMY_BYTES'));
  });
});
