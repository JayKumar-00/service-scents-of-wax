import { Test, TestingModule } from '@nestjs/testing';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { RestoreService } from './restore.service';
import { HistoryService } from './history.service';
import { StorageService } from './storage.service';

describe('BackupController', () => {
  let controller: BackupController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupController],
      providers: [
        {
          provide: BackupService,
          useValue: {
            runBackup: jest.fn(),
          },
        },
        {
          provide: RestoreService,
          useValue: {
            runRestore: jest.fn(),
          },
        },
        {
          provide: HistoryService,
          useValue: {
            getHistory: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getFilePath: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BackupController>(BackupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
