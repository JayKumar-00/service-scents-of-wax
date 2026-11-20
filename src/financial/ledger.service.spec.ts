import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';

describe('LedgerService', () => {
  let service: LedgerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LedgerService],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  it('should be defined', () => {
    assert.ok(service);
  });
});
