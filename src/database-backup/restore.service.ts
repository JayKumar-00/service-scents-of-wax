import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseIntrospectorService } from './database-introspector.service';
import { SchemaDiffService } from './schema-diff.service';
import { DependencyGraphService } from './dependency-graph.service';
import { CompressionService } from './compression.service';
import { ChecksumService } from './checksum.service';
import { StorageService } from './storage.service';
import {
  DatabaseSchema,
  BackupMetadata,
} from './interfaces/backup-format.interface';
import * as fs from 'fs';
import * as readline from 'readline';

@Injectable()
export class RestoreService {
  private readonly logger = new Logger(RestoreService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly introspector: DatabaseIntrospectorService,
    private readonly schemaDiff: SchemaDiffService,
    private readonly dependencyGraph: DependencyGraphService,
    private readonly compression: CompressionService,
    private readonly checksum: ChecksumService,
    private readonly storage: StorageService,
  ) {}

  private async getClient(): Promise<PrismaClient> {
    return this.prismaService as any;
  }

  private async releaseClient(client: PrismaClient) {
    // No-op
  }

  async runRestore(
    filePath: string,
    expectedChecksum?: string,
  ): Promise<{ success: boolean; message: string }> {
    // 1. Verify integrity/checksum if provided
    if (expectedChecksum) {
      const isValid = await this.checksum.verifyChecksum(
        filePath,
        expectedChecksum,
      );
      if (!isValid) {
        throw new Error('Integrity validation failed: Checksum does not match');
      }
    }

    // 2. Parse backup header to retrieve metadata and schema
    this.logger.log(`Parsing backup header: ${filePath}`);
    const backupMetadata = await this.parseHeaderStream(filePath);
    if (!backupMetadata || backupMetadata.version !== '1.0') {
      throw new Error('Invalid or unsupported backup file version');
    }

    const backupSchema: DatabaseSchema = backupMetadata.schema;
    const client = await this.getClient();

    try {
      // 3. Introspect current database schema
      const currentSchema = await this.introspector.introspectSchema();

      // 4. Align schemas by generating and executing required SQL
      const diffSqlCommands = this.schemaDiff.generateDiffSql(
        backupSchema,
        currentSchema,
      );
      if (diffSqlCommands.length > 0) {
        this.logger.log(
          `Applying ${diffSqlCommands.length} DDL schema alignment commands`,
        );
        for (const sql of diffSqlCommands) {
          try {
            await client.$executeRawUnsafe(sql);
          } catch (err: any) {
            this.logger.error(
              `Failed to apply schema change SQL [${sql}]: ${err.message}`,
            );
            throw new Error(`Schema alignment failed: ${err.message}`);
          }
        }
      }

      // 5. Temporarily disable foreign key validation by dropping constraints
      this.logger.log('Temporarily dropping foreign keys and indexes...');
      const dropFkCommands =
        this.schemaDiff.generateDropForeignKeysSql(currentSchema);
      for (const sql of dropFkCommands) {
        await client.$executeRawUnsafe(sql);
      }

      // Drop non-primary indexes to accelerate insertion
      for (const [tableName, tableSchema] of Object.entries(
        currentSchema.tables,
      )) {
        for (const idx of tableSchema.indexes) {
          if (!idx.is_primary) {
            await client.$executeRawUnsafe(
              `DROP INDEX IF EXISTS "${idx.index_name}";`,
            );
          }
        }
      }

      // 6. Truncate all tables
      this.logger.log('Truncating tables...');
      for (const tableName of Object.keys(backupSchema.tables)) {
        await client.$executeRawUnsafe(
          `TRUNCATE TABLE "${tableName}" CASCADE;`,
        );
      }

      // 7. Stream restore data dynamically from backup file
      this.logger.log('Streaming and inserting rows...');
      await this.streamDataRestore(client, filePath, backupSchema);

      // 8. Rebuild: indexes and foreign keys
      this.logger.log('Rebuilding indexes...');
      for (const tableName of Object.keys(backupSchema.tables)) {
        const tableSchema = backupSchema.tables[tableName];
        for (const idx of tableSchema.indexes) {
          if (!idx.is_primary && idx.index_def) {
            await client.$executeRawUnsafe(idx.index_def);
          }
        }
      }

      this.logger.log('Rebuilding foreign keys...');
      const rebuildFkCommands =
        this.schemaDiff.generateRebuildForeignKeysSql(backupSchema);
      for (const sql of rebuildFkCommands) {
        await client.$executeRawUnsafe(sql);
      }

      this.logger.log('Database restored successfully');
      return {
        success: true,
        message: 'Database restored successfully',
      };
    } catch (error: any) {
      this.logger.error(`Restore process failed: ${error.message}`);
      throw new InternalServerErrorException(
        `Restore execution failed: ${error.message}`,
      );
    } finally {
      await this.releaseClient(client);
    }
  }

  private async parseHeaderStream(filePath: string): Promise<BackupMetadata> {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath);
      const gunzip = this.compression.createGunzipStream();
      readStream.pipe(gunzip);

      let buffer = '';
      let resolved = false;

      gunzip.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        const dataIndex = buffer.indexOf(',"data":');
        if (dataIndex !== -1 && !resolved) {
          resolved = true;
          const headerJsonStr = buffer.substring(0, dataIndex) + '}';
          try {
            const header = JSON.parse(headerJsonStr);
            resolve(header as BackupMetadata);
            readStream.destroy();
            gunzip.destroy();
          } catch (err: any) {
            reject(
              new Error(`Failed to parse backup header JSON: ${err.message}`),
            );
          }
        }
      });

      gunzip.on('end', () => {
        if (!resolved) {
          reject(
            new Error('Reached end of file without finding the "data" tag'),
          );
        }
      });

      gunzip.on('error', (err) => reject(err));
      readStream.on('error', (err) => reject(err));
    });
  }

  private async streamDataRestore(
    client: PrismaClient,
    filePath: string,
    schema: DatabaseSchema,
  ): Promise<void> {
    const readStream = fs.createReadStream(filePath);
    const gunzip = this.compression.createGunzipStream();
    readStream.pipe(gunzip);

    const rl = readline.createInterface({
      input: gunzip,
      crlfDelay: Infinity,
    });

    let currentTable: string | null = null;
    let currentRowsBatch: any[] = [];
    let firstRow = true;

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.endsWith(': [')) {
        const match = trimmed.match(/"([^"]+)":\s*\[/);
        if (match) {
          if (currentTable && currentRowsBatch.length > 0) {
            await this.insertBatch(
              client,
              currentTable,
              currentRowsBatch,
              schema,
            );
            currentRowsBatch = [];
          }
          currentTable = match[1];
          firstRow = true;
        }
      } else if (trimmed === ']' || trimmed === '],' || trimmed === '}') {
        if (currentTable && currentRowsBatch.length > 0) {
          await this.insertBatch(
            client,
            currentTable,
            currentRowsBatch,
            schema,
          );
          currentRowsBatch = [];
        }
        currentTable = null;
      } else if (currentTable) {
        let rowStr = trimmed;
        if (rowStr.endsWith(',')) {
          rowStr = rowStr.slice(0, -1);
        }
        try {
          const row = JSON.parse(rowStr);
          currentRowsBatch.push(row);

          // Calculate batch size dynamically to not exceed Postgres max parameter count (65,535)
          const colsCount = Object.keys(row).length;
          const maxBatch = colsCount > 0 ? Math.floor(60000 / colsCount) : 1000;
          const batchLimit = Math.max(1, Math.min(1000, maxBatch));

          if (currentRowsBatch.length >= batchLimit) {
            await this.insertBatch(
              client,
              currentTable,
              currentRowsBatch,
              schema,
            );
            currentRowsBatch = [];
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to parse row JSON in table ${currentTable}: ${trimmed}`,
          );
        }
      }
    }
  }

  private async insertBatch(
    client: PrismaClient,
    tableName: string,
    rows: any[],
    schema: DatabaseSchema,
  ): Promise<void> {
    if (rows.length === 0) return;

    const columns = Object.keys(rows[0]);
    const tableSchema = schema.tables[tableName];

    const values: any[] = [];
    const valueGroups: string[] = [];
    let paramCounter = 1;

    for (const row of rows) {
      const rowPlaceholders: string[] = [];
      for (const col of columns) {
        let val = row[col];
        let placeholder = `$${paramCounter++}`;
        let isArray = false;

        // Format dates correctly from string JSON formats to postgres compatible formats
        if (tableSchema) {
          const colMeta = tableSchema.columns.find(
            (c) => c.column_name === col,
          );
          if (colMeta) {
            if (
              (colMeta.data_type.includes('timestamp') ||
                colMeta.data_type.includes('date')) &&
              val
            ) {
              val = new Date(val);
            }
            if (colMeta.data_type === 'USER-DEFINED') {
              placeholder += `::"${colMeta.udt_name}"`;
            }
            if (colMeta.data_type === 'json' || colMeta.data_type === 'jsonb') {
              placeholder += `::${colMeta.data_type}`;
            }
            if (colMeta.data_type === 'uuid') {
              placeholder += '::uuid';
            }
            if (
              colMeta.data_type === 'numeric' ||
              colMeta.data_type === 'decimal'
            ) {
              placeholder += `::${colMeta.data_type}`;
            }
            if (colMeta.data_type === 'ARRAY') {
              isArray = true;
              const standardTypes = new Set([
                'text',
                'varchar',
                'bpchar',
                'int2',
                'int4',
                'int8',
                'float4',
                'float8',
                'numeric',
                'bool',
                'json',
                'jsonb',
                'uuid',
                'date',
                'time',
                'timetz',
                'timestamp',
                'timestamptz',
                'interval',
                'bytea',
                'oid',
                'xml',
              ]);
              const elementUdt = colMeta.udt_name.startsWith('_')
                ? colMeta.udt_name.slice(1)
                : colMeta.udt_name;
              let castType = `"${elementUdt}"[]`;
              if (standardTypes.has(elementUdt)) {
                let sqlTypeName = elementUdt;
                if (elementUdt === 'bool') sqlTypeName = 'boolean';
                else if (elementUdt === 'int4') sqlTypeName = 'integer';
                else if (elementUdt === 'int8') sqlTypeName = 'bigint';
                else if (elementUdt === 'int2') sqlTypeName = 'smallint';
                else if (elementUdt === 'float8')
                  sqlTypeName = 'double precision';
                else if (elementUdt === 'float4') sqlTypeName = 'real';
                castType = `${sqlTypeName}[]`;
              }
              placeholder += `::${castType}`;
            }
          }
        }

        // Format raw objects (JSON types in PostgreSQL)
        if (
          val !== null &&
          typeof val === 'object' &&
          !(val instanceof Date) &&
          !isArray
        ) {
          val = JSON.stringify(val);
        }

        values.push(val);
        rowPlaceholders.push(placeholder);
      }
      valueGroups.push(`(${rowPlaceholders.join(', ')})`);
    }

    const colsEscaped = columns.map((c) => `"${c}"`).join(', ');
    const query = `INSERT INTO "${tableName}" (${colsEscaped}) VALUES ${valueGroups.join(', ')};`;

    await client.$executeRawUnsafe(query, ...values);
  }
}
