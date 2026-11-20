import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatusService } from './order-status.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BrevoService } from 'src/notification/services/brevo.service';
import { getQueueToken } from '@nestjs/bullmq';
import { InvoiceService } from 'src/invoice/invoice.service';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { ConfigService } from '@nestjs/config';
import { AuditService } from 'src/audit/audit.service';
import { InventoryReservationService } from 'src/order-allocation/services/inventory-reservation.service';

describe('OrderStatusService', () => {
  let service: OrderStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderStatusService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: BrevoService,
          useValue: {},
        },
        {
          provide: getQueueToken('retention'),
          useValue: { add: jest.fn() },
        },
        {
          provide: InvoiceService,
          useValue: {},
        },
        {
          provide: RoleBasedNotificationService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
        {
          provide: InventoryReservationService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<OrderStatusService>(OrderStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
