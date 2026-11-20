import { Test, TestingModule } from '@nestjs/testing';
import { RestoreService } from './restore.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseIntrospectorService } from './database-introspector.service';
import { SchemaDiffService } from './schema-diff.service';
import { DependencyGraphService } from './dependency-graph.service';
import { CompressionService } from './compression.service';
import { ChecksumService } from './checksum.service';
import { StorageService } from './storage.service';
import { DatabaseSchema } from './interfaces/backup-format.interface';

describe('RestoreService', () => {
  let service: RestoreService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestoreService,
        { provide: ConfigService, useValue: {} },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: DatabaseIntrospectorService, useValue: {} },
        { provide: SchemaDiffService, useValue: {} },
        { provide: DependencyGraphService, useValue: {} },
        { provide: CompressionService, useValue: {} },
        { provide: ChecksumService, useValue: {} },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();

    service = module.get<RestoreService>(RestoreService);
  });

  it('should format array parameters and cast placeholders correctly', async () => {
    const schema: DatabaseSchema = {
      enums: {},
      tables: {
        TestTable: {
          columns: [
            {
              column_name: 'badge',
              data_type: 'ARRAY',
              is_nullable: 'YES',
              column_default: null,
              character_maximum_length: null,
              udt_name: '_text',
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
          primaryKeys: [],
          foreignKeys: [],
          indexes: [],
        },
      },
    };

    const rows = [
      {
        badge: ['gold', 'silver'],
        roles: ['ADMIN'],
      },
    ];

    // Access private insertBatch method via casting
    await (service as any).insertBatch(
      mockPrismaService,
      'TestTable',
      rows,
      schema,
    );

    expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
      'INSERT INTO "TestTable" ("badge", "roles") VALUES ($1::text[], $2::"UserRole"[]);',
      ['gold', 'silver'],
      ['ADMIN'],
    );
  });

  it('should cast JSON, JSONB, and UUID placeholders correctly', async () => {
    const schema: DatabaseSchema = {
      enums: {},
      tables: {
        TestTable: {
          columns: [
            {
              column_name: 'metadata',
              data_type: 'jsonb',
              is_nullable: 'YES',
              column_default: null,
              character_maximum_length: null,
              udt_name: 'jsonb',
            },
            {
              column_name: 'extra',
              data_type: 'json',
              is_nullable: 'YES',
              column_default: null,
              character_maximum_length: null,
              udt_name: 'json',
            },
            {
              column_name: 'uuidCol',
              data_type: 'uuid',
              is_nullable: 'YES',
              column_default: null,
              character_maximum_length: null,
              udt_name: 'uuid',
            },
          ],
          primaryKeys: [],
          foreignKeys: [],
          indexes: [],
        },
      },
    };

    const rows = [
      {
        metadata: { a: 1 },
        extra: { b: 2 },
        uuidCol: '123e4567-e89b-12d3-a456-426614174000',
      },
    ];

    await (service as any).insertBatch(
      mockPrismaService,
      'TestTable',
      rows,
      schema,
    );

    expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
      'INSERT INTO "TestTable" ("metadata", "extra", "uuidCol") VALUES ($1::jsonb, $2::json, $3::uuid);',
      '{"a":1}',
      '{"b":2}',
      '123e4567-e89b-12d3-a456-426614174000',
    );
  });

  it('should cast numeric and decimal placeholders correctly', async () => {
    const schema: DatabaseSchema = {
      enums: {},
      tables: {
        TestTable: {
          columns: [
            {
              column_name: 'ratingAvg',
              data_type: 'numeric',
              is_nullable: 'YES',
              column_default: null,
              character_maximum_length: null,
              udt_name: 'numeric',
            },
            {
              column_name: 'price',
              data_type: 'decimal',
              is_nullable: 'YES',
              column_default: null,
              character_maximum_length: null,
              udt_name: 'numeric',
            },
          ],
          primaryKeys: [],
          foreignKeys: [],
          indexes: [],
        },
      },
    };

    const rows = [
      {
        ratingAvg: '4.5',
        price: '19.99',
      },
    ];

    await (service as any).insertBatch(
      mockPrismaService,
      'TestTable',
      rows,
      schema,
    );

    expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
      'INSERT INTO "TestTable" ("ratingAvg", "price") VALUES ($1::numeric, $2::decimal);',
      '4.5',
      '19.99',
    );
  });
});
