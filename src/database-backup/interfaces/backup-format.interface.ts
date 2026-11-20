export interface ColumnMetadata {
  column_name: string;
  data_type: string;
  is_nullable: string; // 'YES' or 'NO'
  column_default: string | null;
  character_maximum_length: number | null;
  udt_name: string;
}

export interface ForeignKeyMetadata {
  constraint_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  update_rule: string;
  delete_rule: string;
}

export interface IndexMetadata {
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  index_def: string;
}

export interface TableSchema {
  columns: ColumnMetadata[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyMetadata[];
  indexes: IndexMetadata[];
}

export interface DatabaseSchema {
  enums: Record<string, string[]>;
  tables: Record<string, TableSchema>;
}

export interface BackupMetadata {
  version: string;
  createdAt: string;
  database: string;
  schema: DatabaseSchema;
}

export interface HistoryRecord {
  fileName: string;
  size: string; // Formatted size, e.g. "1.2 MB" or bytes
  createdAt: string;
  checksum: string;
}
