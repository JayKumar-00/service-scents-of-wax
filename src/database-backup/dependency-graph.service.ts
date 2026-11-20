import { Injectable, Logger } from '@nestjs/common';
import { DatabaseSchema } from './interfaces/backup-format.interface';

@Injectable()
export class DependencyGraphService {
  private readonly logger = new Logger(DependencyGraphService.name);

  sortTables(schema: DatabaseSchema): string[] {
    const tables = Object.keys(schema.tables);
    const dependencies: Record<string, Set<string>> = {};

    // Initialize dependencies
    for (const table of tables) {
      dependencies[table] = new Set<string>();
    }

    // Populate dependencies based on foreign keys
    for (const table of tables) {
      const tableSchema = schema.tables[table];
      for (const fk of tableSchema.foreignKeys) {
        const refTable = fk.foreign_table_name;
        // Check if the referenced table exists in our schema and is not a self-reference
        if (schema.tables[refTable] && refTable !== table) {
          dependencies[table].add(refTable);
        }
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: string[] = [];

    const visit = (table: string) => {
      if (visited.has(table)) {
        return;
      }
      if (visiting.has(table)) {
        // Cycle detected!
        this.logger.warn(
          `Circular dependency detected involving table: ${table}. Breaking cycle for sorting.`,
        );
        return;
      }

      visiting.add(table);

      const tableDeps = dependencies[table] || new Set();
      for (const dep of tableDeps) {
        visit(dep);
      }

      visiting.delete(table);
      visited.add(table);
      sorted.push(table);
    };

    for (const table of tables) {
      visit(table);
    }

    return sorted;
  }
}
