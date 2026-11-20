import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from './storage.service';
import { HistoryRecord } from './interfaces/backup-format.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);
  private readonly historyFilePath: string;

  constructor(private readonly storageService: StorageService) {
    this.historyFilePath = path.join(
      this.storageService.getStorageDir(),
      'history.json',
    );
  }

  getHistory(): HistoryRecord[] {
    try {
      if (!fs.existsSync(this.historyFilePath)) {
        return [];
      }
      const data = fs.readFileSync(this.historyFilePath, 'utf-8');
      return JSON.parse(data) as HistoryRecord[];
    } catch (err: any) {
      this.logger.error(`Failed to read backup history: ${err.message}`);
      return [];
    }
  }

  saveHistory(record: HistoryRecord): void {
    try {
      const history = this.getHistory();
      // Remove any existing record with same file name to avoid duplicate listing
      const filtered = history.filter((h) => h.fileName !== record.fileName);
      filtered.unshift(record); // Add new record to the top

      fs.writeFileSync(
        this.historyFilePath,
        JSON.stringify(filtered, null, 2),
        'utf-8',
      );
    } catch (err: any) {
      this.logger.error(`Failed to write backup history: ${err.message}`);
    }
  }

  deleteHistoryRecord(fileName: string): void {
    try {
      const history = this.getHistory();
      const filtered = history.filter((h) => h.fileName !== fileName);
      fs.writeFileSync(
        this.historyFilePath,
        JSON.stringify(filtered, null, 2),
        'utf-8',
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to update backup history after deletion: ${err.message}`,
      );
    }
  }
}
