import { Test, TestingModule } from '@nestjs/testing';
import { BundleProvisionService } from './bundle-provision.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/audit/audit.service';
import { DomainEventsService } from 'src/supply-chain/domain-events.service';
import { RedisService } from 'src/redis/redis.service';
import { BundleAssignmentStatus, StarterBundleStatus } from '@prisma/client';

describe('BundleProvisionService', () => {
  let service: BundleProvisionService;

  const mockPrismaService = {
    franchiseBundleAssignment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    warehouseStock: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stockRequest: {
      create: jest.fn(),
    },
    inventoryReservation: {
      create: jest.fn(),
    },
    inboundDelivery: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockDomainEventsService = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedisService = {
    del: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BundleProvisionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DomainEventsService, useValue: mockDomainEventsService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<BundleProvisionService>(BundleProvisionService);
    jest.clearAllMocks();
  });

  it('should exit early if assignment is already fully provisioned and not partial', async () => {
    mockPrismaService.franchiseBundleAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      status: BundleAssignmentStatus.PROVISIONED,
      isPartial: false,
      bundle: { code: 'SB-01' },
      franchise: { code: 'FR-01' },
    });

    await service.provisionBundle('assignment-1');

    expect(mockPrismaService.franchiseBundleAssignment.update).not.toHaveBeenCalled();
  });

  it('should provision successfully if stock is available', async () => {
    mockPrismaService.franchiseBundleAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      status: BundleAssignmentStatus.PENDING,
      isPartial: false,
      franchiseId: 'fran-1',
      bundleId: 'bundle-1',
      stockRequestId: null,
      inboundDeliveryId: null,
      provisionedItems: null,
      bundle: {
        id: 'bundle-1',
        name: 'Starter Bundle',
        code: 'SB-01',
        items: [
          {
            productId: 'prod-1',
            variantId: 'var-1',
            quantity: 10,
          },
        ],
      },
      franchise: { id: 'fran-1', code: 'FR-01' },
    });

    mockPrismaService.warehouseStock.findUnique.mockResolvedValue({
      productId: 'prod-1',
      quantity: 100,
      reserved: 10,
    });

    mockPrismaService.productVariant.findUnique.mockResolvedValue({
      id: 'var-1',
      stock: 50,
      wholesalePrice: 120,
      price: 180,
      gstTax: 18,
    });

    mockPrismaService.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      wholesalePrice: 100,
      price: 150,
      defaultGstRatePercent: 18,
      gstTax: 18,
    });

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return callback(mockPrismaService);
    });

    mockPrismaService.stockRequest.create.mockResolvedValue({ id: 'sr-1' });
    mockPrismaService.inboundDelivery.create.mockResolvedValue({ id: 'del-1' });

    await service.provisionBundle('assignment-1', 'admin-1', '127.0.0.1');

    expect(mockPrismaService.stockRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'UNPAID',
        }),
      }),
    );

    expect(mockPrismaService.franchiseBundleAssignment.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'assignment-1' },
        data: {
          status: BundleAssignmentStatus.PROCESSING,
          failureReason: null,
        },
      }),
    );

    expect(mockPrismaService.franchiseBundleAssignment.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'assignment-1' },
        data: expect.objectContaining({
          status: BundleAssignmentStatus.PROVISIONED,
          isPartial: false,
          stockRequestId: 'sr-1',
          inboundDeliveryId: 'del-1',
        }),
      }),
    );
  });

  it('should set paymentStatus to WAIVED if bundle is default or autoAssignOnCreate', async () => {
    mockPrismaService.franchiseBundleAssignment.findUnique.mockResolvedValue({
      id: 'assignment-2',
      status: BundleAssignmentStatus.PENDING,
      isPartial: false,
      franchiseId: 'fran-1',
      bundleId: 'bundle-default',
      stockRequestId: null,
      inboundDeliveryId: null,
      provisionedItems: null,
      bundle: {
        id: 'bundle-default',
        name: 'Default Starter Bundle',
        code: 'SB-DEFAULT',
        isDefault: true,
        autoAssignOnCreate: true,
        items: [
          {
            productId: 'prod-1',
            variantId: 'var-1',
            quantity: 5,
          },
        ],
      },
      franchise: { id: 'fran-1', code: 'FR-01' },
    });

    mockPrismaService.warehouseStock.findUnique.mockResolvedValue({
      productId: 'prod-1',
      quantity: 100,
      reserved: 10,
    });

    mockPrismaService.productVariant.findUnique.mockResolvedValue({
      id: 'var-1',
      stock: 50,
      wholesalePrice: 120,
      price: 180,
      gstTax: 18,
    });

    mockPrismaService.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      wholesalePrice: 100,
      price: 150,
      defaultGstRatePercent: 18,
      gstTax: 18,
    });

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return callback(mockPrismaService);
    });

    mockPrismaService.stockRequest.create.mockResolvedValue({ id: 'sr-2' });
    mockPrismaService.inboundDelivery.create.mockResolvedValue({ id: 'del-2' });

    await service.provisionBundle('assignment-2', 'admin-1', '127.0.0.1');

    expect(mockPrismaService.stockRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'WAIVED',
        }),
      }),
    );
  });
});
