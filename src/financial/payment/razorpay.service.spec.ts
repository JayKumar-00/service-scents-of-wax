import { Test, TestingModule } from '@nestjs/testing';
import { RazorpayService } from './razorpay.service';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';

describe('RazorpayService', () => {
  let service: RazorpayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RazorpayService],
    }).compile();

    service = module.get<RazorpayService>(RazorpayService);
  });

  it('should be defined', () => {
    assert.ok(service);
  });
});
