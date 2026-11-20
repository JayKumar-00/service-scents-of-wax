import { Test, TestingModule } from '@nestjs/testing';
import { CustomerOrderController } from './customer-order.controller';
import { OrdersService } from '../orders.service';
import { FulfillmentPreviewService } from '../services/fulfillment-preview.service';

describe('CustomerOrderController', () => {
  let controller: CustomerOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerOrderController],
      providers: [
        {
          provide: OrdersService,
          useValue: {},
        },
        {
          provide: FulfillmentPreviewService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CustomerOrderController>(CustomerOrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
