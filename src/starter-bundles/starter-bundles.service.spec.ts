import { Test, TestingModule } from '@nestjs/testing';
import { StarterBundlesService } from './starter-bundles.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/audit/audit.service';
import { DomainEventsService } from 'src/supply-chain/domain-events.service';
import { StarterBundleStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';
import { getQueueToken } from '@nestjs/bullmq';
import { RedisService } from 'src/redis/redis.service';

describe('StarterBundlesService', () => {
  let service: StarterBundlesService;

  const mockPrismaService = {
    starterBundle: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    starterBundleItem: {
      create: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    franchiseBundleAssignment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    franchise: {
      findUnique: jest.fn(),
    },
    stockingNode: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
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
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    clearCacheByPrefix: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StarterBundlesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DomainEventsService, useValue: mockDomainEventsService },
        { provide: RedisService, useValue: mockRedisService },
        {
          provide: getQueueToken('starter-bundle'),
          useValue: {
            add: jest.fn().mockResolvedValue({ id: 'job-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<StarterBundlesService>(StarterBundlesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should reset other default bundles if the new bundle is default', async () => {
      const dto = {
        name: 'Test Bundle',
        isDefault: BooleanEnum.TRUE,
        status: StarterBundleStatus.ACTIVE,
      };

      mockPrismaService.starterBundle.create.mockResolvedValue({
        id: 'bundle-1',
        ...dto,
      });

      const result = await service.create(dto, 'user-1', '127.0.0.1');

      expect(mockPrismaService.starterBundle.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      expect(mockPrismaService.starterBundle.create).toHaveBeenCalled();
      expect(result.id).toBe('bundle-1');
    });

    it('should throw BadRequestException if setting isDefault on an inactive bundle', async () => {
      const dto = {
        name: 'Test Bundle',
        isDefault: BooleanEnum.TRUE,
        status: StarterBundleStatus.INACTIVE,
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should generate a unique code if code is not provided', async () => {
      const dto = {
        name: 'Test Automatic Code Bundle',
        isDefault: BooleanEnum.FALSE,
        status: StarterBundleStatus.ACTIVE,
      };

      mockPrismaService.starterBundle.create.mockImplementation((args) => {
        return Promise.resolve({
          id: 'bundle-2',
          code: args.data.code,
          ...dto,
        });
      });

      const result = await service.create(dto as any, 'user-1');

      expect(result.code).toContain('SB_TEST_AUTOMATIC_CODE_BUNDLE_');
      expect(mockPrismaService.starterBundle.create).toHaveBeenCalled();
    });

    it('should set default paymentStatus to PAID and generate unique txtId if not provided', async () => {
      const dto = {
        name: 'Test Payment Bundle',
        isDefault: BooleanEnum.FALSE,
        status: StarterBundleStatus.ACTIVE,
      };

      mockPrismaService.starterBundle.create.mockImplementation((args) => {
        return Promise.resolve({
          id: 'bundle-3',
          ...dto,
          paymentStatus: args.data.paymentStatus,
          txtId: args.data.txtId,
        });
      });

      const result = await service.create(dto as any, 'user-1');

      expect(result.paymentStatus).toBe('PAID');
      expect(result.txtId).toContain('TXN_SB_');
      expect(mockPrismaService.starterBundle.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if bundle does not exist', async () => {
      mockPrismaService.starterBundle.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', {}, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if updating default bundle to inactive', async () => {
      mockPrismaService.starterBundle.findUnique.mockResolvedValue({
        id: 'bundle-1',
        isDefault: true,
      });

      await expect(
        service.update('bundle-1', { status: StarterBundleStatus.INACTIVE }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
    it('should successfully set isDefault to true on update', async () => {
      mockPrismaService.starterBundle.findUnique.mockResolvedValue({
        id: 'bundle-1',
        status: StarterBundleStatus.ACTIVE,
      });

      mockPrismaService.starterBundle.update.mockResolvedValue({
        id: 'bundle-1',
        isDefault: true,
      });

      const result = await service.update(
        'bundle-1',
        { isDefault: BooleanEnum.TRUE },
        'user-1',
      );

      expect(mockPrismaService.starterBundle.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      expect(result.isDefault).toBe(true);
    });

    it('should throw BadRequestException if setting isDefault on an inactive bundle on update', async () => {
      mockPrismaService.starterBundle.findUnique.mockResolvedValue({
        id: 'bundle-1',
        status: StarterBundleStatus.INACTIVE,
      });

      await expect(
        service.update('bundle-1', { isDefault: BooleanEnum.TRUE }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update paymentStatus and txtId successfully', async () => {
      mockPrismaService.starterBundle.findUnique.mockResolvedValue({
        id: 'bundle-1',
        status: StarterBundleStatus.ACTIVE,
        paymentStatus: 'PAID',
        txtId: 'old-txn-id',
      });

      mockPrismaService.starterBundle.update.mockResolvedValue({
        id: 'bundle-1',
        paymentStatus: 'FAILED',
        txtId: 'new-txn-id',
      });

      const result = await service.update(
        'bundle-1',
        { paymentStatus: 'FAILED' as any, txtId: 'new-txn-id' },
        'user-1',
      );

      expect(mockPrismaService.starterBundle.update).toHaveBeenCalledWith({
        where: { id: 'bundle-1' },
        data: expect.objectContaining({
          paymentStatus: 'FAILED',
          txtId: 'new-txn-id',
        }),
      });
      expect(result.paymentStatus).toBe('FAILED');
      expect(result.txtId).toBe('new-txn-id');
    });
  });

  describe('findAll', () => {
    it('should paginate and filter bundles successfully', async () => {
      mockPrismaService.starterBundle.count.mockResolvedValue(1);
      mockPrismaService.starterBundle.findMany.mockResolvedValue([
        { id: 'bundle-1', name: 'Starter Bundle', code: 'SB-01', items: [] },
      ]);

      const result = await service.findAll({
        search: 'starter',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.count).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('assignBundle', () => {
    it('should assign bundle and queue job if bundle and franchise exist', async () => {
      mockPrismaService.starterBundle.findUnique.mockResolvedValue({
        id: 'bundle-1',
        status: StarterBundleStatus.ACTIVE,
        code: 'SB-01',
      });
      mockPrismaService.franchise.findUnique.mockResolvedValue({
        id: 'fran-1',
        name: 'Franchise 1',
        code: 'FR-01',
      });
      mockPrismaService.stockingNode.findUnique.mockResolvedValue({
        id: 'node-1',
      });
      mockPrismaService.franchiseBundleAssignment.findUnique.mockResolvedValue(null);
      mockPrismaService.franchiseBundleAssignment.create.mockResolvedValue({
        id: 'assignment-1',
        franchiseId: 'fran-1',
        bundleId: 'bundle-1',
        status: 'PENDING',
      });

      const result = await service.assignBundle('bundle-1', 'fran-1', 'user-1');

      expect(result.id).toBe('assignment-1');
      expect(mockPrismaService.franchiseBundleAssignment.create).toHaveBeenCalled();
    });
  });

  describe('getAssignments', () => {
    it('should return all assignments for a bundle', async () => {
      mockPrismaService.starterBundle.findUnique.mockResolvedValue({ id: 'bundle-1' });
      mockPrismaService.franchiseBundleAssignment.findMany.mockResolvedValue([
        { id: 'assignment-1', franchiseId: 'fran-1' },
      ]);

      const result = await service.getAssignments('bundle-1');
      expect(result).toHaveLength(1);
      expect(mockPrismaService.franchiseBundleAssignment.findMany).toHaveBeenCalled();
    });
  });

  describe('getFranchiseBundles', () => {
    it('should return all bundles for a franchise', async () => {
      mockPrismaService.franchise.findUnique.mockResolvedValue({ id: 'fran-1' });
      mockPrismaService.franchiseBundleAssignment.findMany.mockResolvedValue([
        { id: 'assignment-1', bundleId: 'bundle-1' },
      ]);

      const result = await service.getFranchiseBundles('fran-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getFranchiseInitialInventory', () => {
    it('should return the latest initial inventory assignment details', async () => {
      mockPrismaService.franchise.findUnique.mockResolvedValue({ id: 'fran-1' });
      mockPrismaService.franchiseBundleAssignment.findFirst.mockResolvedValue({
        id: 'assignment-1',
        status: 'PROVISIONED',
      });

      const result = await service.getFranchiseInitialInventory('fran-1');
      expect(result.id).toBe('assignment-1');
    });
  });
});
