import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { Role, OrderStatus, DeliveryStatus } from '@prisma/client';
import { JwtUser } from '../auth/types/jwt-user.type';

describe('DashboardService - Franchise Metrics', () => {
  let service: DashboardService;

  const mockPrismaService = {
    franchiseStock: {
      findMany: jest.fn(),
    },
    order: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    inboundDelivery: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
    },
    faq: {
      findMany: jest.fn(),
    },
    stockRequest: {
      count: jest.fn(),
    },
    stockTransfer: {
      count: jest.fn(),
    },
    supportTicket: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
  });

  it('should throw ForbiddenException if user is not franchise owner or staff', async () => {
    const user: JwtUser = {
      sub: 'user1',
      email: 'admin@gf.com',
      role: Role.SUPERADMIN,
    };

    await expect(service.getFranchiseMetrics(user, {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw ForbiddenException if user is franchise staff but has no franchiseId', async () => {
    const user: JwtUser = {
      sub: 'user1',
      email: 'staff@gf.com',
      role: Role.FRANCHISE_STAFF,
    };

    await expect(service.getFranchiseMetrics(user, {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should calculate and return franchise metrics successfully', async () => {
    const user: JwtUser = {
      sub: 'user1',
      email: 'owner@gf.com',
      role: Role.FRANCHISE_OWNER,
      franchiseOwnerId: 'franchise-123',
    };

    // Mock FranchiseStock
    mockPrismaService.franchiseStock.findMany.mockResolvedValue([
      {
        franchiseId: 'franchise-123',
        productId: 'prod-1',
        quantity: 10,
        lowStockThreshold: 5,
        reserved: 2,
        product: {
          id: 'prod-1',
          name: 'Gift Box A',
          categoryId: 'cat-1',
          category: { id: 'cat-1', name: 'Gifts' },
        },
      },
      {
        franchiseId: 'franchise-123',
        productId: 'prod-2',
        quantity: 3,
        lowStockThreshold: 5,
        reserved: 1,
        product: {
          id: 'prod-2',
          name: 'Ribbon Red',
          categoryId: 'cat-2',
          category: { id: 'cat-2', name: 'Packaging' },
        },
      },
    ]);

    // Mock Order Aggregate (total sales)
    mockPrismaService.order.aggregate.mockResolvedValue({
      _sum: { total: 1500.5 },
    });

    // Mock Order Count (total orders)
    mockPrismaService.order.count
      .mockResolvedValueOnce(20) // totalOrders count
      .mockResolvedValueOnce(15); // completedOrders count

    // Mock InboundDelivery count (open deliveries)
    mockPrismaService.inboundDelivery.count.mockResolvedValue(2);

    // Mock recent orders
    mockPrismaService.order.findMany
      .mockResolvedValueOnce([
        {
          id: 'order-1',
          orderNumber: 'ORD-123',
          total: 100.0,
          status: OrderStatus.COMPLETED,
          createdAt: new Date(),
        },
      ]) // recentOrdersRaw
      .mockResolvedValueOnce([
        { id: 'order-1', total: 100.0, createdAt: new Date() },
      ]); // monthlySalesOrders

    // Mock recent inbound deliveries
    mockPrismaService.inboundDelivery.findMany
      .mockResolvedValueOnce([
        {
          id: 'del-1',
          status: DeliveryStatus.SCHEDULED,
          createdAt: new Date(),
        },
      ]) // recentDeliveriesRaw
      .mockResolvedValueOnce([{ createdAt: new Date() }]); // monthlyDeliveredItems

    // Mock topCustomerGroups
    mockPrismaService.order.groupBy.mockResolvedValue([
      { customerId: 'cust-1', _count: { id: 5 } },
    ]);

    // Mock customer details
    mockPrismaService.customer.findMany.mockResolvedValue([
      {
        id: 'cust-1',
        name: 'John Doe',
        phone: '123456789',
        user: { email: 'john@gmail.com' },
      },
    ]);

    // Mock FAQs
    mockPrismaService.faq.findMany.mockResolvedValue([
      { id: 'faq-1', question: 'Q1', answer: 'A1' },
    ]);

    // Mock Operational metrics
    mockPrismaService.stockRequest.count.mockResolvedValue(1);
    mockPrismaService.stockTransfer.count.mockResolvedValue(3);
    mockPrismaService.supportTicket.count.mockResolvedValue(2);

    const result = await service.getFranchiseMetrics(user, {});

    expect(result).toBeDefined();
    // Overview
    expect(result.overview.totalSales).toBe(1500.5);
    expect(result.overview.completedOrders).toBe(15);
    expect(result.overview.totalOrders).toBe(20);
    expect(result.overview.completionPercentage).toBe(75);
    expect(result.overview.openDeliveries).toBe(2);
    expect(result.overview.atpUnits).toBe(10); // (10-2) + (3-1) = 8 + 2 = 10

    // Inventory
    expect(result.inventory.totalInventoryRows).toBe(2);
    expect(result.inventory.atpUnits).toBe(10);
    expect(result.inventory.lowStockProducts).toHaveLength(1); // prod-2 has 3 <= 5
    expect(result.inventory.lowStockProducts[0].productId).toBe('prod-2');
    expect(result.inventory.lowStockProducts[0].stockPercentage).toBe(67); // Math.round((2 / 3) * 100) = 67
    expect(result.inventory.categoryBreakdown).toHaveLength(2);

    // Reorder Suggestions
    expect(result.reorderSuggestions).toHaveLength(1); // Only prod-2 is low stock
    expect(result.reorderSuggestions[0].productId).toBe('prod-2');
    expect(result.reorderSuggestions[0].suggestedOrderQty).toBe(8); // Math.max(5 * 2 - 2, 5) = 8

    // Operational summary
    expect(result.operationalSummary.pendingStockRequests).toBe(1);
    expect(result.operationalSummary.inTransitTransfers).toBe(3);
    expect(result.operationalSummary.openSupportTickets).toBe(2);

    // Recent Orders
    expect(result.recentOrders).toHaveLength(1);
    expect(result.recentOrders[0].orderId).toBe('order-1');
    expect(result.recentOrders[0].orderNumber).toBe('ORD-123');
    expect(result.recentOrders[0].amount).toBe(100.0);

    // Top customers
    expect(result.topCustomers).toHaveLength(1);
    expect(result.topCustomers[0].name).toBe('John Doe');
    expect(result.topCustomers[0].email).toBe('john@gmail.com');

    // Faqs
    expect(result.faqPreview).toHaveLength(1);
    expect(result.faqPreview[0].id).toBe('faq-1');
  });
});
