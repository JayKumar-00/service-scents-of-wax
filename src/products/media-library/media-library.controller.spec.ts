import { Test, TestingModule } from '@nestjs/testing';
import { MediaLibraryController } from './media-library.controller';
import { MediaLibraryService } from './media-library.service';
import { CreateMediaItemDto } from './dto/create-media.dto';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { Role } from '@prisma/client';

const mockMediaService = {
  listAcutal: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const mockUser: JwtUser = {
  sub: 'user-123',
  email: 'admin@test.com',
  role: Role.SUPERADMIN,
};

const mockIp = '127.0.0.1';

describe('MediaLibraryController', () => {
  let controller: MediaLibraryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaLibraryController],
      providers: [
        {
          provide: MediaLibraryService,
          useValue: mockMediaService,
        },
      ],
    }).compile();

    controller = module.get<MediaLibraryController>(MediaLibraryController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should return paginated list', async () => {
      const mockResult = {
        data: [],
        meta: { count: 0, page: 1, limit: 10, totalPages: 0 },
      };
      mockMediaService.listAcutal.mockResolvedValue(mockResult);

      const query = { order: 'desc', sortBy: 'createdAt' };
      const result = await controller.list(query as any);

      expect(mockMediaService.listAcutal).toHaveBeenCalledWith(query);
      expect(result).toBe(mockResult);
    });
  });

  describe('create', () => {
    it('should create a new media item', async () => {
      const dto: CreateMediaItemDto = {
        url: '/uploads/test.jpg',
        key: 'test.jpg',
        mimeType: 'image/jpeg',
        size: '1024',
      };
      const mockItem = { id: 'media-1', ...dto };
      mockMediaService.create.mockResolvedValue(mockItem);

      const result = await controller.create(mockUser, dto, mockIp);

      expect(mockMediaService.create).toHaveBeenCalledWith(
        mockUser,
        dto,
        mockIp,
      );
      expect(result).toBe(mockItem);
    });
  });

  describe('delete', () => {
    it('should delete media item', async () => {
      mockMediaService.delete.mockResolvedValue({ success: true });

      const result = await controller.delete(mockUser, 'media-1', mockIp);

      expect(mockMediaService.delete).toHaveBeenCalledWith(
        mockUser,
        'media-1',
        mockIp,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('uploadFile', () => {
    it('should construct DTO and call service create method', async () => {
      const mockFile = {
        filename: 'uploaded-file.jpg',
        originalname: 'original-name.jpg',
        mimetype: 'image/jpeg',
        size: 2048,
      } as Express.Multer.File;

      const mockItem = {
        id: 'media-2',
        url: '/uploads/uploaded-file.jpg',
        key: 'original-name.jpg',
      };
      mockMediaService.create.mockResolvedValue(mockItem);

      const result = await controller.uploadFile(mockUser, mockFile, mockIp);

      expect(mockMediaService.create).toHaveBeenCalledWith(
        mockUser,
        {
          url: '/uploads/uploaded-file.jpg',
          key: 'original-name.jpg',
          mimeType: 'image/jpeg',
          size: '2048',
        },
        mockIp,
      );
      expect(result).toBe(mockItem);
    });
  });
});
