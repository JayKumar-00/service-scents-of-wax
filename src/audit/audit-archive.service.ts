import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import * as zlib from 'zlib';
import * as crypto from 'crypto';

@Injectable()
export class AuditArchiveService {
  private readonly logger = new Logger(AuditArchiveService.name);
  private s3Client: S3Client | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.initS3();
  }

  private initS3() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'ap-south-1';

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn(
        'AWS credentials are not set in environment variables. Archiving to S3 will be bypassed.',
      );
    }
  }

  @Cron('0 2 * * *') // Runs daily at 2:00 AM
  async handleArchivalCron() {
    this.logger.log('Starting scheduled audit logs archival cron job...');
    try {
      await this.archiveOldPartitions();
    } catch (err: any) {
      this.logger.error(
        `Error during audit log archival: ${err.message}`,
        err.stack,
      );
    }
  }

  async archiveOldPartitions() {
    const candidateMonths = this.getArchivalCandidateMonths();

    for (const m of candidateMonths) {
      const partitionName = `audit_log_${m.year}_${m.monthStr}`;

      // 1. Check if partition table exists in PG database
      const tableExists = await this.checkTableExists(partitionName);
      if (!tableExists) {
        continue;
      }

      // 2. Fetch registry entry if exists
      let registry = await this.prisma.auditArchiveRegistry.findFirst({
        where: { partitionName },
      });

      if (registry?.deletedFromDb) {
        // Already archived and deleted, drop partition just in case it wasn't dropped
        await this.dropPartitionTable(partitionName);
        continue;
      }

      this.logger.log(`Archiving partition ${partitionName}...`);

      // 3. Export records from live partition
      const records = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${partitionName}" ORDER BY "createdAt" ASC`,
      );

      if (records.length === 0) {
        this.logger.log(
          `Partition ${partitionName} is empty. Dropping table directly.`,
        );
        await this.dropPartitionTable(partitionName);
        if (registry) {
          await this.prisma.auditArchiveRegistry.update({
            where: { id: registry.id },
            data: { deletedFromDb: true, verified: true },
          });
        } else {
          await this.prisma.auditArchiveRegistry.create({
            data: {
              partitionName,
              s3Key: 'empty',
              fromDate: new Date(m.year, m.month - 1, 1),
              toDate: new Date(m.year, m.month, 1),
              recordCount: 0,
              checksum: 'empty',
              verified: true,
              deletedFromDb: true,
            },
          });
        }
        continue;
      }

      // 4. Format to compressed JSONL
      const jsonlText = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
      const gzipBuffer = zlib.gzipSync(Buffer.from(jsonlText));

      // 5. Calculate Checksum
      const sha256Checksum = crypto
        .createHash('sha256')
        .update(gzipBuffer)
        .digest('hex');

      const s3Key = `year=${m.year}/month=${m.monthStr}/audit_${m.year}_${m.monthStr}.json.gz`;

      if (!registry) {
        registry = await this.prisma.auditArchiveRegistry.create({
          data: {
            partitionName,
            s3Key,
            fromDate: new Date(m.year, m.month - 1, 1),
            toDate: new Date(m.year, m.month, 1),
            recordCount: records.length,
            checksum: sha256Checksum,
            verified: false,
            deletedFromDb: false,
          },
        });
      }

      // 6. Upload to AWS S3 with retry mechanism
      if (!this.s3Client) {
        this.logger.warn(
          `Bypassing S3 upload for ${partitionName} due to missing AWS credentials.`,
        );
        continue;
      }

      const uploadSuccess = await this.uploadToS3WithRetry(
        s3Key,
        gzipBuffer,
        sha256Checksum,
      );
      if (!uploadSuccess) {
        this.logger.error(
          `S3 upload validation failed for ${partitionName}. Table will NOT be dropped.`,
        );
        continue;
      }

      // 7. Update registry to verified
      await this.prisma.auditArchiveRegistry.update({
        where: { id: registry.id },
        data: { verified: true },
      });

      // 8. Drop PG partition table safely
      const dropSuccess = await this.dropPartitionTable(partitionName);
      if (dropSuccess) {
        await this.prisma.auditArchiveRegistry.update({
          where: { id: registry.id },
          data: { deletedFromDb: true },
        });
        this.logger.log(`Dropped partition ${partitionName} successfully.`);
      }
    }
  }

  private async uploadToS3WithRetry(
    s3Key: string,
    buffer: Buffer,
    expectedChecksum: string,
    retries = 3,
    delay = 1000,
  ): Promise<boolean> {
    const bucket = process.env.AWS_S3_BUCKET || 'audit-archive';

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.s3Client!.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: buffer,
            ContentType: 'application/gzip',
            Metadata: {
              checksum: expectedChecksum,
            },
          }),
        );

        // Validation check size
        const head = await this.s3Client!.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: s3Key,
          }),
        );

        if (Number(head.ContentLength) === buffer.length) {
          this.logger.log(
            `S3 upload verified for ${s3Key} (Size: ${head.ContentLength} bytes).`,
          );
          return true;
        }

        this.logger.warn(
          `Upload verification size mismatch on attempt ${attempt}. Retrying...`,
        );
      } catch (err: any) {
        this.logger.error(
          `S3 upload failed on attempt ${attempt}: ${err.message}`,
        );
        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, attempt)),
          );
        }
      }
    }
    return false;
  }

  private async checkTableExists(tableName: string): Promise<boolean> {
    const res = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = '${tableName}'
      ) as exists`,
    );
    return !!res?.[0]?.exists;
  }

  private async dropPartitionTable(tableName: string): Promise<boolean> {
    try {
      await this.prisma.$executeRawUnsafe(`DROP TABLE "${tableName}" CASCADE;`);
      return true;
    } catch (err: any) {
      this.logger.error(
        `Failed to drop partition ${tableName}: ${err.message}`,
      );
      return false;
    }
  }

  private getArchivalCandidateMonths() {
    const candidates: { year: number; month: number; monthStr: string }[] = [];
    const now = new Date();

    // Candidates are partitions older than 6 months (looking back up to 2 years)
    for (let offset = -24; offset <= -6; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      candidates.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        monthStr: String(d.getMonth() + 1).padStart(2, '0'),
      });
    }

    return candidates;
  }
}
