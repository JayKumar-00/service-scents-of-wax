import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ColumnMetadata,
  ForeignKeyMetadata,
  IndexMetadata,
  TableSchema,
  DatabaseSchema,
} from './interfaces/backup-format.interface';

@Injectable()
export class DatabaseIntrospectorService {
  private readonly logger = new Logger(DatabaseIntrospectorService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  private async getClient(): Promise<PrismaClient> {
    return this.prismaService as any;
  }

  private async releaseClient(_client: PrismaClient) {
    // No-op
  }

  async introspectSchema(): Promise<DatabaseSchema> {
    const client = await this.getClient();
    try {
      this.logger.log('Batch fetching database schema metadata...');

      this.logger.log('Fetching custom enums...');
      const enums = await this.getAllEnums(client);

      this.logger.log('Fetching tables...');
      const tables = await this.getTables(client);

      this.logger.log('Fetching columns...');
      const allColumns = await this.getAllColumns(client);

      this.logger.log('Fetching primary keys...');
      const allPrimaryKeys = await this.getAllPrimaryKeys(client);

      this.logger.log('Fetching foreign keys (direct pg_catalog)...');
      const allForeignKeys = await this.getAllForeignKeys(client);

      this.logger.log('Fetching indexes...');
      const allIndexes = await this.getAllIndexes(client);

      this.logger.log(
        `Found ${tables.length} tables. Structuring in-memory...`,
      );
      const tablesSchema: Record<string, TableSchema> = {};

      for (const tableName of tables) {
        tablesSchema[tableName] = {
          columns: allColumns[tableName] || [],
          primaryKeys: allPrimaryKeys[tableName] || [],
          foreignKeys: allForeignKeys[tableName] || [],
          indexes: allIndexes[tableName] || [],
        };
      }

      this.logger.log('Database introspection completed successfully.');
      return {
        enums,
        tables: tablesSchema,
      };
    } finally {
      await this.releaseClient(client);
    }
  }

  private async getTables(client: PrismaClient): Promise<string[]> {
    const rows = await client.$queryRawUnsafe<any[]>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    return rows.map((r) => r.table_name);
  }

  private async getAllColumns(
    client: PrismaClient,
  ): Promise<Record<string, ColumnMetadata[]>> {
    const rows = await client.$queryRawUnsafe<any[]>(`
      SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    const result: Record<string, ColumnMetadata[]> = {};
    for (const r of rows) {
      if (!result[r.table_name]) {
        result[r.table_name] = [];
      }
      result[r.table_name].push({
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.is_nullable,
        column_default: r.column_default,
        character_maximum_length: r.character_maximum_length,
        udt_name: r.udt_name,
      });
    }
    return result;
  }

  private async getAllPrimaryKeys(
    client: PrismaClient,
  ): Promise<Record<string, string[]>> {
    const rows = await client.$queryRawUnsafe<any[]>(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.ordinal_position;
    `);

    const result: Record<string, string[]> = {};
    for (const r of rows) {
      if (!result[r.table_name]) {
        result[r.table_name] = [];
      }
      result[r.table_name].push(r.column_name);
    }
    return result;
  }

  private async getAllForeignKeys(
    client: PrismaClient,
  ): Promise<Record<string, ForeignKeyMetadata[]>> {
    // Direct pg_catalog queries are exponentially faster than information_schema joins
    const rows = await client.$queryRawUnsafe<any[]>(`
      SELECT
        cl.relname AS table_name,
        con.conname AS constraint_name,
        att2.attname AS column_name,
        cl2.relname AS foreign_table_name,
        att.attname AS foreign_column_name,
        con.confupdtype AS update_rule_code,
        con.confdeltype AS delete_rule_code
      FROM pg_constraint con
      JOIN pg_class cl ON con.conrelid = cl.oid
      JOIN pg_class cl2 ON con.confrelid = cl2.oid
      JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = ANY(con.confkey)
      JOIN pg_attribute att2 ON att2.attrelid = con.conrelid AND att2.attnum = ANY(con.conkey)
      JOIN pg_namespace ns ON cl.relnamespace = ns.oid
      WHERE con.contype = 'f' AND ns.nspname = 'public';
    `);

    const ruleMap: Record<string, string> = {
      a: 'NO ACTION',
      r: 'RESTRICT',
      c: 'CASCADE',
      n: 'SET NULL',
      d: 'SET DEFAULT',
    };

    const result: Record<string, ForeignKeyMetadata[]> = {};
    for (const r of rows) {
      if (!result[r.table_name]) {
        result[r.table_name] = [];
      }

      const updateRule =
        ruleMap[String.fromCharCode(r.update_rule_code)] || 'NO ACTION';
      const deleteRule =
        ruleMap[String.fromCharCode(r.delete_rule_code)] || 'NO ACTION';

      result[r.table_name].push({
        constraint_name: r.constraint_name,
        column_name: r.column_name,
        foreign_table_name: r.foreign_table_name,
        foreign_column_name: r.foreign_column_name,
        update_rule: updateRule,
        delete_rule: deleteRule,
      });
    }
    return result;
  }

  private async getAllIndexes(
    client: PrismaClient,
  ): Promise<Record<string, IndexMetadata[]>> {
    const rows = await client.$queryRawUnsafe<any[]>(`
      SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        pg_get_indexdef(ix.indexrelid) AS index_def
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace ns ON t.relnamespace = ns.oid
      WHERE t.relkind = 'r' 
        AND ns.nspname = 'public';
    `);

    const result: Record<string, IndexMetadata[]> = {};
    for (const r of rows) {
      if (!result[r.table_name]) {
        result[r.table_name] = [];
      }
      result[r.table_name].push({
        index_name: r.index_name,
        is_unique: r.is_unique,
        is_primary: r.is_primary,
        index_def: r.index_def,
      });
    }
    return result;
  }

  private async getAllEnums(
    client: PrismaClient,
  ): Promise<Record<string, string[]>> {
    const rows = await client.$queryRawUnsafe<any[]>(`
      SELECT 
        t.typname AS enum_name,
        e.enumlabel AS enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder;
    `);

    const enums: Record<string, string[]> = {};
    for (const row of rows) {
      if (!enums[row.enum_name]) {
        enums[row.enum_name] = [];
      }
      enums[row.enum_name].push(row.enum_value);
    }
    return enums;
  }
}
