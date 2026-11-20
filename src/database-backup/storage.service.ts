import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly storageDir = path.resolve(
    process.cwd(),
    'src',
    'database-backup',
    'storage',
  );

  constructor() {
    this.ensureStorageDirExists();
  }

  private ensureStorageDirExists() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  getStorageDir(): string {
    return this.storageDir;
  }

  getFilePath(fileName: string): string {
    const resolvedPath = path.join(this.storageDir, fileName);
    // Secure check: prevent directory traversal attacks
    if (!resolvedPath.startsWith(this.storageDir)) {
      throw new Error('Access denied: Invalid file path');
    }
    return resolvedPath;
  }

  createWriteStream(fileName: string): fs.WriteStream {
    const filePath = this.getFilePath(fileName);
    return fs.createWriteStream(filePath);
  }

  createReadStream(fileName: string): fs.ReadStream {
    const filePath = this.getFilePath(fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Backup file ${fileName} not found`);
    }
    return fs.createReadStream(filePath);
  }

  deleteFile(fileName: string): void {
    const filePath = this.getFilePath(fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getFileStats(fileName: string): fs.Stats {
    const filePath = this.getFilePath(fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Backup file ${fileName} not found`);
    }
    return fs.statSync(filePath);
  }

  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
