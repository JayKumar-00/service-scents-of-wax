import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';

describe('PaymentController', () => {
  let controller: PaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    assert.ok(controller);
  });
});
