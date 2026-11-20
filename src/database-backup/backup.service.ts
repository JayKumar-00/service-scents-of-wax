import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseIntrospectorService } from './database-introspector.service';
import { DependencyGraphService } from './dependency-graph.service';
import { CompressionService } from './compression.service';
import { ChecksumService } from './checksum.service';
import { StorageService } from './storage.service';
import { HistoryService } from './history.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly chunkSize = 5000;

  constructor(
    private readonly config: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly introspector: DatabaseIntrospectorService,
    private readonly dependencyGraph: DependencyGraphService,
    private readonly compression: CompressionService,
    private readonly checksum: ChecksumService,
    private readonly storage: StorageService,
    private readonly history: HistoryService,
  ) {}

  private async getClient(): Promise<PrismaClient> {
    return this.prismaService as any;
  }

  private async releaseClient(client: PrismaClient) {
    // No-op
  }

  async runBackup(): Promise<{
    fileName: string;
    size: string;
    checksum: string;
  }> {
    const client = await this.getClient();

    // Introspect database schema
    const schema = await this.introspector.introspectSchema();
    const sortedTables = this.dependencyGraph.sortTables(schema);

    // Get database name
    const dbUrl =
      this.config.get<string>('DATABASE_URL') ||
      this.config.get<string>('WRITER_DB_URL') ||
      '';
    let dbName = 'giftfactory';
    try {
      if (dbUrl) {
        // Handle postgresql URIs or connection strings
        const parsed = new URL(dbUrl);
        dbName = parsed.pathname.replace('/', '') || 'giftfactory';
      }
    } catch {
      // Ignored fallback
    }

    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `${dbName}-backup-${dateStr}-${Date.now()}.gfdb.gz`;
    const filePath = this.storage.getFilePath(fileName);

    const fileWriteStream = this.storage.createWriteStream(fileName);
    const gzipStream = this.compression.createGzipStream();

    // Pipe the gzip stream directly into the file stream
    gzipStream.pipe(fileWriteStream);

    try {
      this.logger.log(`Starting backup generation: ${fileName}`);

      // 1. Write metadata and schema header
      const header = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        database: dbName,
        schema,
      };

      // We serialize the header and write it, followed by opening the "data" tag
      gzipStream.write(JSON.stringify(header).slice(0, -1)); // slices the closing '}' from header JSON object
      gzipStream.write(`,"data":{\n`);

      // 2. Stream table data chunk-by-chunk in sorted topological order
      let firstTable = true;
      let tableIdx = 0;
      for (const tableName of sortedTables) {
        tableIdx++;
        this.logger.log(
          `[${tableIdx}/${sortedTables.length}] Backing up data for table: ${tableName}...`,
        );
        if (firstTable) {
          gzipStream.write(`"${tableName}": [\n`);
          firstTable = false;
        } else {
          gzipStream.write(`,\n"${tableName}": [\n`);
        }

        let offset = 0;
        let hasMore = true;
        let firstRow = true;

        while (hasMore) {
          const chunk = await client.$queryRawUnsafe<any[]>(
            `SELECT * FROM "${tableName}" LIMIT ${this.chunkSize} OFFSET ${offset}`,
          );

          if (chunk.length === 0) {
            break;
          }

          for (const row of chunk) {
            if (firstRow) {
              gzipStream.write(`    ${JSON.stringify(row)}`);
              firstRow = false;
            } else {
              gzipStream.write(`,\n    ${JSON.stringify(row)}`);
            }
          }

          offset += this.chunkSize;
          if (chunk.length < this.chunkSize) {
            hasMore = false;
          }
        }

        gzipStream.write(`\n]`);
      }

      // Close the data object and root object
      gzipStream.write(`\n}\n}`);

      // Finish writing and wait for completion
      await new Promise<void>((resolve, reject) => {
        gzipStream.on('error', (err) => reject(err));
        fileWriteStream.on('error', (err) => reject(err));
        fileWriteStream.on('finish', () => resolve());
        gzipStream.end();
      });

      // Calculate file size and checksum
      const stats = this.storage.getFileStats(fileName);
      const sizeStr = this.storage.formatBytes(stats.size);
      const checksumVal = await this.checksum.calculateFileChecksum(filePath);

      // Record in history log
      const record = {
        fileName,
        size: sizeStr,
        createdAt: new Date().toISOString(),
        checksum: checksumVal,
      };
      this.history.saveHistory(record);

      this.logger.log(
        `Backup generated successfully: ${fileName} (${sizeStr})`,
      );

      // Automatically trigger old backup cleanup
      try {
        await this.cleanupOldBackups();
      } catch (cleanupErr: any) {
        this.logger.error(
          `Automatic backup cleanup failed after backup generation: ${cleanupErr.message}`,
        );
      }

      return record;
    } catch (error: any) {
      this.logger.error(`Backup process failed: ${error.message}`);
      // Clean up failed backup file if it exists
      this.storage.deleteFile(fileName);
      throw new InternalServerErrorException(
        `Backup generation failed: ${error.message}`,
      );
    } finally {
      await this.releaseClient(client);
    }
  }

  /**
   * Automatically run backup cleanup hourly
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleAutomaticCleanup() {
    this.logger.log(
      'Scheduled hourly cron: Cleaning up old database backups...',
    );
    await this.cleanupOldBackups();
  }

  /**
   * Cleans up backups older than the retention threshold.
   * Default retention is 1 hour.
   */
  async cleanupOldBackups(): Promise<number> {
    this.logger.log('Starting cleanup of old database backups...');
    try {
      const retentionHours = parseInt(
        this.config.get<string>('BACKUP_RETENTION_HOURS', '1'),
        10,
      );

      // If retention is set to 0 or negative, disable cleanup
      if (retentionHours <= 0) {
        this.logger.log(
          'Backup retention is disabled (retention period <= 0).',
        );
        return 0;
      }

      const cutoffTime = Date.now() - retentionHours * 60 * 60 * 1000;
      this.logger.log(
        `Retention threshold: ${retentionHours} hour(s). Deleting backups older than ${new Date(cutoffTime).toISOString()}`,
      );

      const storageDir = this.storage.getStorageDir();
      if (!fs.existsSync(storageDir)) {
        this.logger.warn(`Storage directory does not exist: ${storageDir}`);
        return 0;
      }

      const files = fs.readdirSync(storageDir);
      let deletedCount = 0;

      for (const file of files) {
        // Only target backup files (ending with .gfdb.gz)
        if (file.endsWith('.gfdb.gz')) {
          const filePath = path.join(storageDir, file);
          try {
            const stats = fs.statSync(filePath);
            // We check mtime (modified time) to determine the age
            if (stats.mtime.getTime() < cutoffTime) {
              this.logger.log(
                `Deleting old backup file: ${file} (Last modified: ${stats.mtime.toISOString()})`,
              );
              this.storage.deleteFile(file);
              this.history.deleteHistoryRecord(file);
              deletedCount++;
            }
          } catch (fileErr: any) {
            this.logger.error(
              `Error reading stats or deleting file ${file}: ${fileErr.message}`,
            );
          }
        }
      }

      // Also clean up stale history records where files no longer exist on disk
      try {
        const historyList = this.history.getHistory();
        for (const record of historyList) {
          const filePath = path.join(storageDir, record.fileName);
          if (!fs.existsSync(filePath)) {
            this.logger.warn(
              `Cleaning up stale history record for non-existent file: ${record.fileName}`,
            );
            this.history.deleteHistoryRecord(record.fileName);
          }
        }
      } catch (histErr: any) {
        this.logger.error(
          `Error cleaning up stale history records: ${histErr.message}`,
        );
      }

      this.logger.log(`Cleanup completed. Deleted ${deletedCount} file(s).`);
      return deletedCount;
    } catch (error: any) {
      this.logger.error(`Failed to execute backup cleanup: ${error.message}`);
      return 0;
    }
  }
}
