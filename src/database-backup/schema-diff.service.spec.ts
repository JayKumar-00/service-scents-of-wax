import { Test, TestingModule } from '@nestjs/testing';
import { SchemaDiffService } from './schema-diff.service';
import { DatabaseSchema } from './interfaces/backup-format.interface';

describe('SchemaDiffService', () => {
  let service: SchemaDiffService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaDiffService],
    }).compile();

    service = module.get<SchemaDiffService>(SchemaDiffService);
  });

  it('should generate create table SQL with standard array type', () => {
    const backupSchema: DatabaseSchema = {
      enums: {},
      tables: {
        KeywordSearchSuggestion: {
          columns: [
            {
              column_name: 'id',
              data_type: 'text',
              is_nullable: 'NO',
              column_default: null,
              character_maximum_length: null,
              udt_name: 'text',
            },
            {
              column_name: 'suggestions',
              data_type: 'ARRAY',
              is_nullable: 'YES',
              column_default: null,
              character_maximum_length: null,
              udt_name: '_text',
            },
          ],
          primaryKeys: ['id'],
          foreignKeys: [],
          indexes: [],
        },
      },
    };

    const currentSchema: DatabaseSchema = { enums: {}, tables: {} };

    const sqlCommands = service.generateDiffSql(backupSchema, currentSchema);
    expect(sqlCommands.length).toBe(1);
    expect(sqlCommands[0]).toContain('"suggestions" text[] NULL');
    expect(sqlCommands[0]).toContain('CREATE TABLE "KeywordSearchSuggestion"');
  });

  it('should generate create table SQL with custom enum array type', () => {
    const backupSchema: DatabaseSchema = {
      enums: {
        UserRole: ['ADMIN', 'USER'],
      },
      tables: {
        User: {
          columns: [
            {
              column_name: 'id',
              data_type: 'text',
              is_nullable: 'NO',
              column_default: null,
              character_maximum_length: null,
              udt_name: 'text',
            },
            {
              column_name: 'roles',
              data_type: 'ARRAY',
              is_nullable: 'YES',
              column_default: null,
              character_maximum_length: null,
              udt_name: '_UserRole',
            },
          ],
          primaryKeys: ['id'],
          foreignKeys: [],
          indexes: [],
        },
      },
    };

    const currentSchema: DatabaseSchema = {
      enums: { UserRole: ['ADMIN', 'USER'] },
      tables: {},
    };

    const sqlCommands = service.generateDiffSql(backupSchema, currentSchema);
    expect(sqlCommands.length).toBe(1);
    expect(sqlCommands[0]).toContain('"roles" "UserRole"[] NULL');
  });

  it('should generate ALTER TYPE commands for existing enums missing new values', () => {
    const backupSchema: DatabaseSchema = {
      enums: {
        ReturnSourceType: ['CUSTOMER_ORDER', 'STORE_PURCHASE', 'ONLINE_DRAFT'],
      },
      tables: {},
    };

    const currentSchema: DatabaseSchema = {
      enums: {
        ReturnSourceType: ['STORE_PURCHASE'], // Missing 'CUSTOMER_ORDER' and 'ONLINE_DRAFT'
      },
      tables: {},
    };

    const sqlCommands = service.generateDiffSql(backupSchema, currentSchema);
    expect(sqlCommands.length).toBe(2);
    expect(sqlCommands).toContain(
      'ALTER TYPE "ReturnSourceType" ADD VALUE \'CUSTOMER_ORDER\';',
    );
    expect(sqlCommands).toContain(
      'ALTER TYPE "ReturnSourceType" ADD VALUE \'ONLINE_DRAFT\';',
    );
  });
});
