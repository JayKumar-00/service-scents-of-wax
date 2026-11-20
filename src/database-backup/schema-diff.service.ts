import { Injectable } from '@nestjs/common';
import {
  DatabaseSchema,
  TableSchema,
  ColumnMetadata,
} from './interfaces/backup-format.interface';

@Injectable()
export class SchemaDiffService {
  generateDiffSql(
    backupSchema: DatabaseSchema,
    currentSchema: DatabaseSchema,
  ): string[] {
    const sqlCommands: string[] = [];

    // 1. Check for missing custom enums or missing enum values
    for (const [enumName, values] of Object.entries(backupSchema.enums)) {
      const currentValues = currentSchema.enums[enumName];
      if (!currentValues) {
        const valuesList = values
          .map((v) => `'${v.replace(/'/g, "''")}'`)
          .join(', ');
        sqlCommands.push(`CREATE TYPE "${enumName}" AS ENUM (${valuesList});`);
      } else {
        const currentValsSet = new Set(currentValues);
        for (const val of values) {
          if (!currentValsSet.has(val)) {
            const escapedVal = val.replace(/'/g, "''");
            sqlCommands.push(
              `ALTER TYPE "${enumName}" ADD VALUE '${escapedVal}';`,
            );
          }
        }
      }
    }

    // 2. Check for missing tables
    for (const [tableName, tableSchema] of Object.entries(
      backupSchema.tables,
    )) {
      if (!currentSchema.tables[tableName]) {
        sqlCommands.push(this.generateCreateTableSql(tableName, tableSchema));
      } else {
        // Compare existing table columns
        const currentTableSchema = currentSchema.tables[tableName];
        sqlCommands.push(
          ...this.generateAlterTableSql(
            tableName,
            tableSchema,
            currentTableSchema,
          ),
        );
      }
    }

    return sqlCommands;
  }

  private generateCreateTableSql(
    tableName: string,
    tableSchema: TableSchema,
  ): string {
    const colDefs: string[] = [];

    for (const col of tableSchema.columns) {
      colDefs.push(this.getColumnDefinitionSql(col));
    }

    if (tableSchema.primaryKeys.length > 0) {
      const pks = tableSchema.primaryKeys.map((pk) => `"${pk}"`).join(', ');
      colDefs.push(`CONSTRAINT "${tableName}_pkey" PRIMARY KEY (${pks})`);
    }

    return `CREATE TABLE "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;
  }

  private generateAlterTableSql(
    tableName: string,
    backupTable: TableSchema,
    currentTable: TableSchema,
  ): string[] {
    const sqls: string[] = [];

    const backupColsMap = new Map<string, ColumnMetadata>();
    for (const col of backupTable.columns) {
      backupColsMap.set(col.column_name, col);
    }

    const currentColsMap = new Map<string, ColumnMetadata>();
    for (const col of currentTable.columns) {
      currentColsMap.set(col.column_name, col);
    }

    // Add missing columns
    for (const [colName, col] of backupColsMap.entries()) {
      if (!currentColsMap.has(colName)) {
        sqls.push(
          `ALTER TABLE "${tableName}" ADD COLUMN ${this.getColumnDefinitionSql(col)};`,
        );
      } else {
        // Compare changed columns
        const currentCol = currentColsMap.get(colName)!;

        // 1. Compare type
        const backupType = this.getColumnTypeSql(col);
        const currentType = this.getColumnTypeSql(currentCol);
        if (backupType.toLowerCase() !== currentType.toLowerCase()) {
          sqls.push(
            `ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" TYPE ${backupType} USING "${colName}"::${backupType};`,
          );
        }

        // 2. Compare nullability
        if (col.is_nullable !== currentCol.is_nullable) {
          if (col.is_nullable === 'NO') {
            sqls.push(
              `ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" SET NOT NULL;`,
            );
          } else {
            sqls.push(
              `ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" DROP NOT NULL;`,
            );
          }
        }

        // 3. Compare default
        if (col.column_default !== currentCol.column_default) {
          if (col.column_default === null) {
            sqls.push(
              `ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" DROP DEFAULT;`,
            );
          } else {
            sqls.push(
              `ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" SET DEFAULT ${col.column_default};`,
            );
          }
        }
      }
    }

    // Drop extra columns (in current but not in backup)
    for (const colName of currentColsMap.keys()) {
      if (!backupColsMap.has(colName)) {
        sqls.push(`ALTER TABLE "${tableName}" DROP COLUMN "${colName}";`);
      }
    }

    return sqls;
  }

  private getColumnDefinitionSql(col: ColumnMetadata): string {
    const typeStr = this.getColumnTypeSql(col);
    const nullStr = col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
    const defStr =
      col.column_default !== null ? `DEFAULT ${col.column_default}` : '';
    return `"${col.column_name}" ${typeStr} ${nullStr} ${defStr}`.trim();
  }

  private getColumnTypeSql(col: ColumnMetadata): string {
    if (col.data_type === 'USER-DEFINED') {
      return `"${col.udt_name}"`;
    }
    if (col.data_type === 'ARRAY') {
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
      const elementUdt = col.udt_name.startsWith('_')
        ? col.udt_name.slice(1)
        : col.udt_name;
      if (standardTypes.has(elementUdt)) {
        let sqlTypeName = elementUdt;
        if (elementUdt === 'bool') sqlTypeName = 'boolean';
        else if (elementUdt === 'int4') sqlTypeName = 'integer';
        else if (elementUdt === 'int8') sqlTypeName = 'bigint';
        else if (elementUdt === 'int2') sqlTypeName = 'smallint';
        else if (elementUdt === 'float8') sqlTypeName = 'double precision';
        else if (elementUdt === 'float4') sqlTypeName = 'real';
        return `${sqlTypeName}[]`;
      }
      return `"${elementUdt}"[]`;
    }
    if (col.data_type === 'character varying' && col.character_maximum_length) {
      return `character varying(${col.character_maximum_length})`;
    }
    return col.data_type;
  }

  generateRebuildForeignKeysSql(schema: DatabaseSchema): string[] {
    const sqlCommands: string[] = [];

    // Group foreign keys by constraint name to support multi-column foreign keys
    for (const [tableName, tableSchema] of Object.entries(schema.tables)) {
      const fkGroups: Record<
        string,
        {
          foreign_table: string;
          columns: string[];
          foreign_columns: string[];
          update_rule: string;
          delete_rule: string;
        }
      > = {};

      for (const fk of tableSchema.foreignKeys) {
        if (!fkGroups[fk.constraint_name]) {
          fkGroups[fk.constraint_name] = {
            foreign_table: fk.foreign_table_name,
            columns: [],
            foreign_columns: [],
            update_rule: fk.update_rule,
            delete_rule: fk.delete_rule,
          };
        }
        fkGroups[fk.constraint_name].columns.push(fk.column_name);
        fkGroups[fk.constraint_name].foreign_columns.push(
          fk.foreign_column_name,
        );
      }

      for (const [constraintName, group] of Object.entries(fkGroups)) {
        const cols = group.columns.map((c) => `"${c}"`).join(', ');
        const fCols = group.foreign_columns.map((fc) => `"${fc}"`).join(', ');

        sqlCommands.push(
          `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" ` +
            `FOREIGN KEY (${cols}) REFERENCES "${group.foreign_table}"(${fCols}) ` +
            `ON UPDATE ${group.update_rule} ON DELETE ${group.delete_rule};`,
        );
      }
    }

    return sqlCommands;
  }

  generateDropForeignKeysSql(schema: DatabaseSchema): string[] {
    const sqlCommands: string[] = [];

    for (const [tableName, tableSchema] of Object.entries(schema.tables)) {
      const constraints = new Set(
        tableSchema.foreignKeys.map((fk) => fk.constraint_name),
      );
      for (const constraint of constraints) {
        sqlCommands.push(
          `ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraint}";`,
        );
      }
    }

    return sqlCommands;
  }
}
