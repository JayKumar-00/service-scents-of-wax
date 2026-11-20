import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { DatabaseBackupService } from './database-backup.service';
import { BackupService } from './backup.service';
import { RestoreService } from './restore.service';
import { HistoryService } from './history.service';
import { DatabaseIntrospectorService } from './database-introspector.service';
import { SchemaDiffService } from './schema-diff.service';
import { DependencyGraphService } from './dependency-graph.service';
import { CompressionService } from './compression.service';
import { ChecksumService } from './checksum.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [BackupController],
  providers: [
    DatabaseBackupService, // Keep legacy compatibility
    BackupService,
    RestoreService,
    HistoryService,
    DatabaseIntrospectorService,
    SchemaDiffService,
    DependencyGraphService,
    CompressionService,
    ChecksumService,
    StorageService,
  ],
  exports: [BackupService, RestoreService, HistoryService],
})
export class DatabaseBackupModule {}
