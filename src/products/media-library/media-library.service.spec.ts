import { Test, TestingModule } from '@nestjs/testing';
import { MediaLibraryService } from './media-library.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from 'src/uploads/uploads.service';
import { AuditService } from 'src/audit/audit.service';
import { NotFoundException } from '@nestjs/common';
import { CreateMediaItemDto } from './dto/create-media.dto';
import { UpdateMediaItemDto } from './dto/update-media.dto';
import { MediaQueryDto, MediaSortBy } from './dto/media-query.dto';
import { OrderType } from 'src/common/dto/query.dto';
import { Role } from '@prisma/client';

const mockPrisma = {
  mediaLibrary: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  clearCacheByPrefix: jest.fn(),
  del: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

const mockUploadsService = {
  adminDeleteProductFile: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

describe('MediaLibraryService', () => {
  let service: MediaLibraryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaLibraryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UploadsService, useValue: mockUploadsService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<MediaLibraryService>(MediaLibraryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateMediaItemDto = {
      url: '/uploads/test.jpg',
      key: 'products/og-1234__test.jpg',
      mimeType: 'image/jpeg',
      size: '1024',
      tag: 'test',
    };

    const mockUser = {
      sub: 'user-id',
      email: 'admin@test.com',
      role: Role.SUPERADMIN,
    };

    it('should create a new media item in DB and log audit event', async () => {
      const createdItem = {
        id: 'media-1',
        ...dto,
        orientation: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.mediaLibrary.create.mockResolvedValue(createdItem);

      const result = await service.create(mockUser, dto, '127.0.0.1');

      expect(mockPrisma.mediaLibrary.create).toHaveBeenCalledWith({
        data: {
          url: dto.url,
          key: dto.key,
          mimeType: dto.mimeType,
          tag: dto.tag,
          size: dto.size,
        },
      });
      expect(result).toEqual(createdItem);
      expect(mockRedisService.clearCacheByPrefix).toHaveBeenCalled();
    });

    it('should create a new media item when user is not provided (e.g. direct call)', async () => {
      const createdItem = {
        id: 'media-2',
        ...dto,
        orientation: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.mediaLibrary.create.mockResolvedValue(createdItem);

      const result = await service.create(dto);

      expect(mockPrisma.mediaLibrary.create).toHaveBeenCalled();
      expect(result).toEqual(createdItem);
    });
  });

  describe('listAcutal', () => {
    it('should return cached data if available', async () => {
      const mockCached = {
        data: [{ id: 'cached-1', url: '/uploads/test.jpg', key: 'test.jpg' }],
        meta: { count: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockRedisService.get.mockResolvedValue(mockCached);

      const result = await service.listAcutal();

      expect(mockRedisService.get).toHaveBeenCalled();
      expect(result).toEqual(mockCached);
      expect(mockPrisma.mediaLibrary.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from DB, cache it and return if cache misses', async () => {
      mockRedisService.get.mockResolvedValue(null);
      const mockDbItems = [
        {
          id: 'db-1',
          url: '/uploads/test.jpg',
          key: 'test.jpg',
          mimeType: 'image/jpeg',
          size: '1024',
        },
      ];
      mockPrisma.mediaLibrary.findMany.mockResolvedValue(mockDbItems);
      mockPrisma.mediaLibrary.count.mockResolvedValue(1);

      const result = await service.listAcutal();

      expect(mockPrisma.mediaLibrary.findMany).toHaveBeenCalled();
      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe('db-1');
      expect(mockRedisService.set).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return item from cache if present', async () => {
      const mockItem = {
        id: 'item-1',
        url: '/uploads/test.jpg',
        key: 'test.jpg',
      };
      mockRedisService.get.mockResolvedValue(mockItem);

      const result = await service.findById('item-1');

      expect(mockRedisService.get).toHaveBeenCalled();
      expect(result).toEqual(mockItem);
      expect(mockPrisma.mediaLibrary.findUnique).not.toHaveBeenCalled();
    });

    it('should return item from DB and throw NotFoundException if not exists', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.mediaLibrary.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update media item in DB and invalidate caches', async () => {
      const existing = {
        id: 'media-1',
        key: 'products/og-1234__test.jpg',
        url: '/uploads/test.jpg',
      };
      const dto: UpdateMediaItemDto = { tag: 'new-tag' };
      const updated = { ...existing, tag: 'new-tag' };

      mockPrisma.mediaLibrary.findUnique.mockResolvedValue(existing);
      mockPrisma.mediaLibrary.update.mockResolvedValue(updated);

      const result = await service.update('media-1', dto);

      expect(mockPrisma.mediaLibrary.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: dto,
      });
      expect(result.tag).toBe('new-tag');
      expect(mockRedisService.clearCacheByPrefix).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    const mockUser = {
      sub: 'user-id',
      email: 'admin@test.com',
      role: Role.SUPERADMIN,
    };

    it('should delete media item and call adminDeleteProductFile if key points to a product file', async () => {
      const existing = {
        id: 'media-1',
        key: 'products/og-1234__test.jpg',
        url: '/uploads/test.jpg',
      };
      mockPrisma.mediaLibrary.findUnique.mockResolvedValue(existing);
      mockPrisma.mediaLibrary.delete.mockResolvedValue(existing);

      const result = await service.delete(
        mockUser as any,
        'media-1',
        '127.0.0.1',
      );

      expect(mockPrisma.mediaLibrary.delete).toHaveBeenCalledWith({
        where: { id: 'media-1' },
      });
      expect(mockUploadsService.adminDeleteProductFile).toHaveBeenCalledWith(
        existing.key,
      );
      expect(result).toEqual({ success: true });
    });
  });
});
