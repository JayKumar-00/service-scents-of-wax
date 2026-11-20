import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

@Injectable()
export class DatabaseBackupService {
  async createBackup(): Promise<string> {
    const backupDir = path.resolve(process.cwd(), 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const fileName = `backup-${Date.now()}.dump`;
    const filePath = path.join(backupDir, fileName);

    try {
      const databaseUrl = process.env.WRITER_DB_URL;

      if (!databaseUrl) {
        throw new Error('WRITER_DB_URL is not configured');
      }

      await execFileAsync('pg_dump', [
        `--dbname=${databaseUrl}`,
        '--format=custom',
        `--file=${filePath}`,
      ]);

      await fs.promises.access(filePath, fs.constants.F_OK);

      return filePath;
    } catch (error: any) {
      throw new InternalServerErrorException(`Backup failed: ${error.message}`);
    }
  }

  async restoreDatabase(filePath: string) {
    try {
      const databaseUrl = process.env.WRITER_DB_URL;

      if (!databaseUrl) {
        throw new Error('WRITER_DB_URL is not configured');
      }

      await execFileAsync('pg_restore', [
        '--clean',
        '--if-exists',
        `--dbname=${databaseUrl}`,
        filePath,
      ]);

      return {
        success: true,
        message: 'Database restored successfully',
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Restore failed: ${error.message}`,
      );
    }
  }
}
