import { Test, TestingModule } from '@nestjs/testing';
import { OrderAllocationService } from './order-allocation.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { LocationService } from 'src/geo/location.service';
import { OrderDiscountService } from 'src/orders/services/order-discount.service';
import { OrderAllocationQueue } from '../queues/order-allocation.queue';
import { OrderAllocationEmitterService } from '../events/order-allocation-emitter.service';
import { InventoryReservationService } from './inventory-reservation.service';
import { InvoiceService } from 'src/invoice/invoice.service';
import { AuditService } from 'src/audit/audit.service';
import {
  FranchiseStatus,
  Role,
  PaymentModeEnum,
  OnlinePaymentStatus,
  OrderStatus,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('OrderAllocationService - COD Franchise Restriction', () => {
  let service: OrderAllocationService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      franchise: {
        findMany: jest.fn(),
      },
      franchiseStock: {
        findMany: jest.fn(),
      },
      inventoryReservation: {
        findMany: jest.fn(),
      },
      franchiseProposal: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderAllocationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: LocationService, useValue: {} },
        { provide: OrderDiscountService, useValue: {} },
        { provide: OrderAllocationQueue, useValue: {} },
        {
          provide: OrderAllocationEmitterService,
          useValue: { emit: jest.fn() },
        },
        { provide: InventoryReservationService, useValue: {} },
        { provide: InvoiceService, useValue: {} },
        { provide: AuditService, useValue: {} },
      ],
    }).compile();

    service = module.get<OrderAllocationService>(OrderAllocationService);
  });

  describe('isRequestCod', () => {
    it('should return true if requestSnapshot has payment onlinePaymentMethod as COD', () => {
      const request = {
        requestSnapshot: {
          payment: {
            onlinePaymentMethod: 'COD',
          },
        },
      };
      expect((service as any).isRequestCod(request)).toBe(true);
    });

    it('should return true if requestSnapshot has input onlinePaymentMethod as COD', () => {
      const request = {
        requestSnapshot: {
          input: {
            onlinePaymentMethod: 'COD',
          },
        },
      };
      expect((service as any).isRequestCod(request)).toBe(true);
    });

    it('should return false if payment method is ONLINE', () => {
      const request = {
        requestSnapshot: {
          payment: {
            onlinePaymentMethod: 'ONLINE',
          },
        },
      };
      expect((service as any).isRequestCod(request)).toBe(false);
    });
  });

  describe('findFranchisesWithMaxProducts', () => {
    it('should return the franchise with maximum products in stock', async () => {
      // Mock active franchises (franchise A and franchise B)
      prismaMock.franchise.findMany.mockResolvedValue([
        { id: 'fran_a', code: 'A', status: FranchiseStatus.ACTIVE },
        { id: 'fran_b', code: 'B', status: FranchiseStatus.ACTIVE },
      ]);

      // Mock stocks:
      // fran_a has stock for product 1 and product 2
      // fran_b has stock only for product 1
      prismaMock.franchiseStock.findMany.mockResolvedValue([
        { franchiseId: 'fran_a', productId: 'p1', quantity: 5, reserved: 0 },
        { franchiseId: 'fran_a', productId: 'p2', quantity: 5, reserved: 0 },
        { franchiseId: 'fran_b', productId: 'p1', quantity: 2, reserved: 0 },
      ]);

      prismaMock.inventoryReservation.findMany.mockResolvedValue([]);

      const requestItems = [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 2 },
      ];

      const bestIds = await (service as any).findFranchisesWithMaxProducts(
        prismaMock,
        requestItems,
        'req_123',
      );

      expect(bestIds.has('fran_a')).toBe(true);
      expect(bestIds.has('fran_b')).toBe(false); // fran_a has 2 matching products, fran_b has 1
    });

    it('should resolve tie by totalQty', async () => {
      // both have stock for p1 and p2, but fran_a has more totalQty
      prismaMock.franchise.findMany.mockResolvedValue([
        { id: 'fran_a', code: 'A', status: FranchiseStatus.ACTIVE },
        { id: 'fran_b', code: 'B', status: FranchiseStatus.ACTIVE },
      ]);

      prismaMock.franchiseStock.findMany.mockResolvedValue([
        { franchiseId: 'fran_a', productId: 'p1', quantity: 10, reserved: 0 },
        { franchiseId: 'fran_a', productId: 'p2', quantity: 10, reserved: 0 },
        { franchiseId: 'fran_b', productId: 'p1', quantity: 2, reserved: 0 },
        { franchiseId: 'fran_b', productId: 'p2', quantity: 2, reserved: 0 },
      ]);

      prismaMock.inventoryReservation.findMany.mockResolvedValue([]);

      const requestItems = [
        { productId: 'p1', quantity: 5 },
        { productId: 'p2', quantity: 5 },
      ];

      const bestIds = await (service as any).findFranchisesWithMaxProducts(
        prismaMock,
        requestItems,
        'req_123',
      );

      expect(bestIds.has('fran_a')).toBe(true);
      expect(bestIds.has('fran_b')).toBe(false); // fran_a has totalQty = 10, fran_b has totalQty = 4
    });
  });

  describe('acceptProposal guard', () => {
    it('should throw BadRequestException if franchise accepting proposal is not among the best for COD', async () => {
      const proposal = {
        id: 'prop_123',
        franchiseId: 'fran_b',
        requestId: 'req_123',
        request: {
          id: 'req_123',
          requestSnapshot: {
            payment: { onlinePaymentMethod: 'COD' },
          },
          items: [
            { productId: 'p1', quantity: 2 },
            { productId: 'p2', quantity: 2 },
          ],
        },
      };

      prismaMock.franchiseProposal.findUnique.mockResolvedValue(proposal);

      // Mock active franchises: fran_a and fran_b
      prismaMock.franchise.findMany.mockResolvedValue([
        { id: 'fran_a', code: 'A', status: FranchiseStatus.ACTIVE },
        { id: 'fran_b', code: 'B', status: FranchiseStatus.ACTIVE },
      ]);

      // fran_a has maximum products
      prismaMock.franchiseStock.findMany.mockResolvedValue([
        { franchiseId: 'fran_a', productId: 'p1', quantity: 5, reserved: 0 },
        { franchiseId: 'fran_a', productId: 'p2', quantity: 5, reserved: 0 },
        { franchiseId: 'fran_b', productId: 'p1', quantity: 2, reserved: 0 },
      ]);

      prismaMock.inventoryReservation.findMany.mockResolvedValue([]);

      const user = {
        sub: 'user_123',
        role: Role.FRANCHISE_OWNER,
        franchiseId: 'fran_b',
      };

      await expect(
        service.acceptProposal('prop_123', user as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('expireOnlinePayment', () => {
    it('should return early and NOT cancel order if paymentMode is COD', async () => {
      const mockOrder = {
        id: 'order_123',
        paymentMode: PaymentModeEnum.COD,
        onlinePaymentStatus: OnlinePaymentStatus.UNPAID,
        status: OrderStatus.PENDING,
      };

      prismaMock.order = {
        findUnique: jest.fn().mockResolvedValue(mockOrder),
        update: jest.fn(),
      };

      const reservationServiceMock = {
        releaseOrderReservations: jest.fn(),
      };
      (service as any).reservationService = reservationServiceMock;

      await service.expireOnlinePayment('order_123');

      expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order_123' },
      });
      expect(
        reservationServiceMock.releaseOrderReservations,
      ).not.toHaveBeenCalled();
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });
  });
});
