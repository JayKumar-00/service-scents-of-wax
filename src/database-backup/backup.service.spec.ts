import { Test, TestingModule } from '@nestjs/testing';
import { BackupService } from './backup.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseIntrospectorService } from './database-introspector.service';
import { DependencyGraphService } from './dependency-graph.service';
import { CompressionService } from './compression.service';
import { ChecksumService } from './checksum.service';
import { StorageService } from './storage.service';
import { HistoryService } from './history.service';
import * as fs from 'fs';

jest.mock('fs');

describe('BackupService Cleanup', () => {
  let service: BackupService;
  let mockConfigService: any;
  let mockStorageService: any;
  let mockHistoryService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'BACKUP_RETENTION_HOURS') return '1';
        return defaultValue;
      }),
    };

    mockStorageService = {
      getStorageDir: jest.fn().mockReturnValue('/mock/storage'),
      deleteFile: jest.fn(),
    };

    mockHistoryService = {
      getHistory: jest.fn().mockReturnValue([]),
      deleteHistoryRecord: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: {} },
        { provide: DatabaseIntrospectorService, useValue: {} },
        { provide: DependencyGraphService, useValue: {} },
        { provide: CompressionService, useValue: {} },
        { provide: ChecksumService, useValue: {} },
        { provide: StorageService, useValue: mockStorageService },
        { provide: HistoryService, useValue: mockHistoryService },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should delete files older than 1 hour and update history', async () => {
    const mockStorageDir = '/mock/storage';
    const now = Date.now();

    // Mock fs.existsSync to return true for the storage directory
    (fs.existsSync as jest.Mock).mockImplementation(
      (p: string) => p === mockStorageDir,
    );

    // Mock fs.readdirSync to return some backup files
    const fileOld = 'giftfactory-backup-20260614-old.gfdb.gz';
    const fileNew = 'giftfactory-backup-20260614-new.gfdb.gz';
    (fs.readdirSync as jest.Mock).mockReturnValue([fileOld, fileNew]);

    // Mock fs.statSync to return old mtime for fileOld, new mtime for fileNew
    (fs.statSync as jest.Mock).mockImplementation((p: string) => {
      if (p.endsWith(fileOld)) {
        return { mtime: new Date(now - 2 * 60 * 60 * 1000) }; // 2 hours old
      }
      if (p.endsWith(fileNew)) {
        return { mtime: new Date(now - 10 * 60 * 1000) }; // 10 mins old
      }
      throw new Error('File not found');
    });

    const deletedCount = await service.cleanupOldBackups();

    expect(deletedCount).toBe(1);
    expect(mockStorageService.deleteFile).toHaveBeenCalledWith(fileOld);
    expect(mockStorageService.deleteFile).not.toHaveBeenCalledWith(fileNew);
    expect(mockHistoryService.deleteHistoryRecord).toHaveBeenCalledWith(
      fileOld,
    );
    expect(mockHistoryService.deleteHistoryRecord).not.toHaveBeenCalledWith(
      fileNew,
    );
  });

  it('should clean up stale history records for files that do not exist', async () => {
    const mockStorageDir = '/mock/storage';
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
      // Storage directory exists, but the file doesn't exist
      if (p === mockStorageDir) return true;
      return false;
    });

    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    mockHistoryService.getHistory.mockReturnValue([
      {
        fileName: 'stale-backup.gfdb.gz',
        size: '10MB',
        createdAt: new Date().toISOString(),
        checksum: '123',
      },
    ]);

    const deletedCount = await service.cleanupOldBackups();

    expect(deletedCount).toBe(0); // no physical files deleted
    expect(mockHistoryService.deleteHistoryRecord).toHaveBeenCalledWith(
      'stale-backup.gfdb.gz',
    );
  });
});
