import { Test, TestingModule } from '@nestjs/testing';
import { BannerService } from './banner.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';
import { UploadsService } from 'src/uploads/uploads.service';

describe('BannerService', () => {
  let service: BannerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BannerService,
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: AuditService, useValue: {} },
        { provide: UploadsService, useValue: {} },
      ],
    }).compile();

    service = module.get<BannerService>(BannerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
