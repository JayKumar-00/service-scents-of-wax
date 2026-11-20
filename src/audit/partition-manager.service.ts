import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PartitionManagerService implements OnModuleInit {
  private readonly logger = new Logger(PartitionManagerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensurePartitionedTable();
      await this.ensurePartitions();
    } catch (err: any) {
      this.logger.error(
        `Failed to initialize audit partitions: ${err.message}`,
        err.stack,
      );
    }
  }

  async ensurePartitionedTable() {
    // Check if table relkind is partitioned ('p')
    const result = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT relkind FROM pg_class WHERE relname = 'PartitionedAuditLog'`,
    );

    const relkind = result?.[0]?.relkind;

    if (relkind !== 'p') {
      this.logger.log(
        `Table PartitionedAuditLog relkind is not 'p' (got: ${relkind ?? 'none'}). Recreating partitioned table...`,
      );

      if (relkind === 'r') {
        await this.prisma.$executeRawUnsafe(
          `DROP TABLE "PartitionedAuditLog" CASCADE;`,
        );
      }

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PartitionedAuditLog" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "resource" TEXT NOT NULL,
          "resourceId" TEXT,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PartitionedAuditLog_pkey" PRIMARY KEY ("id", "createdAt")
        ) PARTITION BY RANGE ("createdAt");
      `);

      this.logger.log('Recreated PartitionedAuditLog as a partitioned table.');
    }
  }

  async ensurePartitions() {
    const dates = this.getPartitionDates();

    for (const d of dates) {
      const tableName = `audit_log_${d.year}_${d.monthStr}`;

      const fromStr = `${d.year}-${d.monthStr}-01 00:00:00`;
      const toStr = `${d.nextYear}-${d.nextMonthStr}-01 00:00:00`;

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${tableName}" PARTITION OF "PartitionedAuditLog"
        FOR VALUES FROM ('${fromStr}') TO ('${toStr}');
      `);
    }
    this.logger.log('Pre-created monthly partitions successfully.');
  }

  private getPartitionDates() {
    const now = new Date();

    // We create partitions for: previous, current, next, and next-next month
    const offsets = [-1, 0, 1, 2];

    return offsets.map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);

      return {
        year: d.getFullYear(),
        monthStr: String(d.getMonth() + 1).padStart(2, '0'),
        nextYear: nextD.getFullYear(),
        nextMonthStr: String(nextD.getMonth() + 1).padStart(2, '0'),
      };
    });
  }
}
