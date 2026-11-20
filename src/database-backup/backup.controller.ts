import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as path from 'path';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { RestoreService } from './restore.service';
import { HistoryService } from './history.service';
import { StorageService } from './storage.service';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Database Backup & Restore')
@ApiBearerAuth('access-token')
@Controller('database-backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly restoreService: RestoreService,
    private readonly historyService: HistoryService,
    private readonly storageService: StorageService,
  ) {}

  @Post('backup')
  @ApiOperation({ summary: 'Generate a dynamic PostgreSQL database backup' })
  async backup() {
    const result = await this.backupService.runBackup();
    return {
      success: true,
      message: 'Backup generated successfully',
      data: result,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Retrieve database backup history' })
  async history() {
    return this.historyService.getHistory();
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download a database backup file by filename' })
  async download(@Param('id') id: string, @Res() res: Response) {
    try {
      const filePath = this.storageService.getFilePath(id);
      return res.download(filePath);
    } catch (error: any) {
      this.logger.error(`Download failed: ${error.message}`);
      throw new BadRequestException(
        `Unable to download file: ${error.message}`,
      );
    }
  }

  @Post('restore')
  @Public()
  @UseInterceptors(
    FileInterceptor('file', {
      dest: path.resolve(process.cwd(), 'uploads'),
    }),
  )
  @ApiOperation({
    summary: 'Restore the PostgreSQL database from a backup file',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async restore(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const result = await this.restoreService.runRestore(file.path);
      return result;
    } finally {
      // Clean up the temporarily uploaded file
      try {
        if (require('fs').existsSync(file.path)) {
          require('fs').unlinkSync(file.path);
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to clean up temporary upload file: ${err.message}`,
        );
      }
    }
  }

  @Post('cleanup')
  @ApiOperation({
    summary: 'Manually trigger retention cleanup of old database backups',
  })
  async cleanup() {
    const deletedCount = await this.backupService.cleanupOldBackups();
    return {
      success: true,
      message: `Database backup cleanup completed successfully. Deleted ${deletedCount} file(s).`,
      deletedCount,
    };
  }
}
