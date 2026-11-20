import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Configure dotenv to load local.env which has the active Neon DB connection
const localEnvPath = path.resolve(process.cwd(), 'local.env');
if (fs.existsSync(localEnvPath)) {
  console.log('Loading environment from local.env');
  dotenv.config({ path: localEnvPath });
} else {
  console.log('local.env not found, using default environment');
  dotenv.config();
}

import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseIntrospectorService } from './database-introspector.service';
import { DependencyGraphService } from './dependency-graph.service';
import { CompressionService } from './compression.service';
import { ChecksumService } from './checksum.service';
import { StorageService } from './storage.service';
import { HistoryService } from './history.service';
import { SchemaDiffService } from './schema-diff.service';
import { BackupService } from './backup.service';
import { RestoreService } from './restore.service';

async function main() {
  console.log('Instantiating services manually...');

  // Use connection_limit=3 to tolerate zombie connections from previous crashed processes
  let writerUrl = process.env.WRITER_DB_URL || '';
  if (writerUrl && !writerUrl.includes('connection_limit')) {
    writerUrl += (writerUrl.includes('?') ? '&' : '?') + 'connection_limit=3';
  }
  let readerUrl = process.env.READER_DB_URL || '';
  if (readerUrl && !readerUrl.includes('connection_limit')) {
    readerUrl += (readerUrl.includes('?') ? '&' : '?') + 'connection_limit=3';
  }
  let databaseUrl = process.env.DATABASE_URL || writerUrl;
  if (databaseUrl && !databaseUrl.includes('connection_limit')) {
    databaseUrl +=
      (databaseUrl.includes('?') ? '&' : '?') + 'connection_limit=3';
  }

  console.log('Configured database URLs with connection_limit=3:');
  console.log('- WRITER:', writerUrl);

  const configService = new ConfigService({
    WRITER_DB_URL: writerUrl,
    READER_DB_URL: readerUrl,
    DATABASE_URL: databaseUrl,
  });

  const prismaService = new PrismaService(configService);

  // Note: We bypass prismaService.onModuleInit() to prevent reader client from opening a connection
  console.log('Initialized PrismaService without eager onModuleInit.');

  const introspector = new DatabaseIntrospectorService(
    configService,
    prismaService,
  );
  const dependencyGraph = new DependencyGraphService();
  const compression = new CompressionService();
  const checksum = new ChecksumService();
  const storage = new StorageService();
  const history = new HistoryService(storage);
  const schemaDiff = new SchemaDiffService();

  const backupService = new BackupService(
    configService,
    prismaService,
    introspector,
    dependencyGraph,
    compression,
    checksum,
    storage,
    history,
  );

  const restoreService = new RestoreService(
    configService,
    prismaService,
    introspector,
    schemaDiff,
    dependencyGraph,
    compression,
    checksum,
    storage,
  );

  try {
    // 1. Run database backup
    console.log('\n--- 1. Testing Backup ---');
    const backupResult = await backupService.runBackup();
    console.log('Backup generated:', backupResult);

    // 2. Read history
    console.log('\n--- 2. Testing History ---');
    const historyList = history.getHistory();
    console.log('Backup history list:', historyList);

    // 3. Verify physical file
    console.log('\n--- 3. Testing Storage ---');
    const filePath = storage.getFilePath(backupResult.fileName);
    console.log(`Verifying backup file path: ${filePath}`);
    const exists = fs.existsSync(filePath);
    console.log(`File exists physically: ${exists}`);

    // 4. Run database restore
    console.log('\n--- 4. Testing Restore ---');
    const restoreResult = await restoreService.runRestore(filePath);
    console.log('Restore result:', restoreResult);

    console.log('\n======================================');
    console.log('   VERIFICATION SUCCESSFUL: PASSED!   ');
    console.log('======================================');
  } catch (err: any) {
    console.error('\n======================================');
    console.error('       VERIFICATION FAILED!           ');
    console.error('======================================');
    console.error(err);
  } finally {
    console.log('Cleaning up connection...');
    await prismaService.onModuleDestroy();
  }
}

main();
