import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from 'src/financial/payment/razorpay.service';

describe('InvoiceService', () => {
  let service: InvoiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: RazorpayService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getInvoiceByNumber', () => {
    it('should correctly determine isInterState and resolve item attributes/SKUs', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV-ONLINE-1',
        type: 'PAYMENT',
        status: 'GENERATED',
        issuedAt: new Date(),
        grandTotal: 1000,
        discountAmount: 100,
        shippingFee: 0,
        platformFee: 0,
        gst: 180,
        billingAddress: { state: 'Karnataka' },
        shippingAddress: { state: 'Karnataka' },
        pickupAddress: { state: 'Karnataka' },
        items: [
          {
            productId: 'p1',
            variantId: 'v1',
            title: 'Test Product',
            quantity: 1,
            unitPrice: 1000,
            discount: 100,
            totalAmount: 1080,
            taxableAmount: 900,
            gstRate: 0,
            sku: '',
            variantName: '',
          },
        ],
        order: {
          channel: 'ONLINE',
          franchise: { state: 'Karnataka' },
          items: [
            {
              productId: 'p1',
              variantId: 'v1',
              sku: 'ORDER-ITEM-SKU',
              variantName: 'Color:Red',
              gstPercent: 18,
            },
          ],
        },
        stockRequest: null,
      };

      const mockVariant = {
        id: 'v1',
        sku: 'DB-VARIANT-SKU',
        gstTax: 18,
        attributes: [
          {
            attributeValue: {
              title: 'Red',
            },
          },
        ],
      };

      const mockPrisma = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        productVariant: {
          findMany: jest.fn().mockResolvedValue([mockVariant]),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoiceService,
          {
            provide: PrismaService,
            useValue: mockPrisma,
          },
          {
            provide: RazorpayService,
            useValue: {},
          },
        ],
      }).compile();

      const testService = module.get<InvoiceService>(InvoiceService);
      const user = { role: 'SUPERADMIN' } as any;

      const result = await testService.getInvoiceByNumber('INV-ONLINE-1', user);

      expect(result.isInterState).toBe(false);
      expect(result.items[0].sku).toBe('ORDER-ITEM-SKU');
      expect(result.items[0].variantName).toBe('Red');
      expect(result.items[0].gstRate).toBe(18);
    });

    it('should default isInterState to true for POS invoices', async () => {
      const mockInvoice = {
        invoiceNumber: 'POS-123',
        type: 'PAYMENT',
        status: 'GENERATED',
        issuedAt: new Date(),
        grandTotal: 1000,
        discountAmount: 0,
        shippingFee: 0,
        platformFee: 0,
        gst: 180,
        billingAddress: { state: 'Karnataka' },
        shippingAddress: { state: 'Karnataka' },
        pickupAddress: { state: 'Karnataka' },
        items: [
          {
            productId: 'p1',
            title: 'Test Product',
            quantity: 1,
            unitPrice: 1000,
            discount: 0,
            totalAmount: 1180,
            taxableAmount: 1000,
            gstRate: 18,
            sku: 'SKU',
          },
        ],
        order: {
          channel: 'POS',
          franchise: { state: 'Karnataka' },
          items: [],
        },
        stockRequest: null,
      };

      const mockPrisma = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        productVariant: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoiceService,
          {
            provide: PrismaService,
            useValue: mockPrisma,
          },
          {
            provide: RazorpayService,
            useValue: {},
          },
        ],
      }).compile();

      const testService = module.get<InvoiceService>(InvoiceService);
      const user = { role: 'SUPERADMIN' } as any;

      const result = await testService.getInvoiceByNumber('POS-123', user);
      expect(result.isInterState).toBe(true);
    });

    it('should default pickupAddress to Central Hub for platform-fulfilled order (no franchise)', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV-PLATFORM-1',
        type: 'PAYMENT',
        status: 'GENERATED',
        issuedAt: new Date(),
        grandTotal: 1000,
        discountAmount: 0,
        shippingFee: 0,
        platformFee: 0,
        gst: 0,
        billingAddress: { state: 'Karnataka' },
        shippingAddress: { state: 'Karnataka' },
        pickupAddress: null, // trigger hydration
        orderId: 'order-1',
        order: {
          channel: 'ONLINE',
          franchise: null, // platform-fulfilled
          items: [],
        },
        stockRequest: null,
      };

      const mockPrisma = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        productVariant: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoiceService,
          {
            provide: PrismaService,
            useValue: mockPrisma,
          },
          {
            provide: RazorpayService,
            useValue: {},
          },
        ],
      }).compile();

      const testService = module.get<InvoiceService>(InvoiceService);
      const user = { role: 'SUPERADMIN' } as any;

      const result = await testService.getInvoiceByNumber(
        'INV-PLATFORM-1',
        user,
      );
      expect(result.pickupAddress?.fullName).toBe('UnBoxIO Central Hub');
      expect(result.pickupAddress?.city).toBe('Bilaspur');
      expect(result.pickupAddress?.state).toBe('Chhattisgarh');
    });

    it('should default pickupAddress to Central Hub for platform-fulfilled order (franchise code CENTRAL)', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV-PLATFORM-2',
        type: 'PAYMENT',
        status: 'GENERATED',
        issuedAt: new Date(),
        grandTotal: 1000,
        discountAmount: 0,
        shippingFee: 0,
        platformFee: 0,
        gst: 0,
        billingAddress: { state: 'Karnataka' },
        shippingAddress: { state: 'Karnataka' },
        pickupAddress: null, // trigger hydration
        orderId: 'order-2',
        order: {
          channel: 'ONLINE',
          franchise: { code: 'CENTRAL' }, // platform-fulfilled
          items: [],
        },
        stockRequest: null,
      };

      const mockPrisma = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        productVariant: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoiceService,
          {
            provide: PrismaService,
            useValue: mockPrisma,
          },
          {
            provide: RazorpayService,
            useValue: {},
          },
        ],
      }).compile();

      const testService = module.get<InvoiceService>(InvoiceService);
      const user = { role: 'SUPERADMIN' } as any;

      const result = await testService.getInvoiceByNumber(
        'INV-PLATFORM-2',
        user,
      );
      expect(result.pickupAddress?.fullName).toBe('UnBoxIO Central Hub');
      expect(result.pickupAddress?.state).toBe('Chhattisgarh');
    });

    it('should calculate correct taxableAmount for order items (pre-tax)', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV-TAXABLE-1',
        type: 'PAYMENT',
        status: 'GENERATED',
        issuedAt: new Date(),
        grandTotal: 1180,
        discountAmount: 100,
        shippingFee: 0,
        platformFee: 0,
        gst: 180,
        billingAddress: { state: 'Karnataka' },
        shippingAddress: { state: 'Karnataka' },
        pickupAddress: { state: 'Chhattisgarh' },
        items: [
          {
            productId: 'p1',
            variantId: 'v1',
            title: 'Test Product',
            quantity: 2,
            unitPrice: 500, // unitPrice
            discount: 100, // discount
            totalAmount: 1080,
            taxableAmount: 900, // should be 2 * 500 - 100 = 900
            gstRate: 18,
          },
        ],
        order: {
          channel: 'ONLINE',
          franchise: { state: 'Chhattisgarh' },
          items: [],
        },
        stockRequest: null,
      };

      const mockPrisma = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        productVariant: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoiceService,
          {
            provide: PrismaService,
            useValue: mockPrisma,
          },
          {
            provide: RazorpayService,
            useValue: {},
          },
        ],
      }).compile();

      const testService = module.get<InvoiceService>(InvoiceService);
      const user = { role: 'SUPERADMIN' } as any;

      const result = await testService.getInvoiceByNumber(
        'INV-TAXABLE-1',
        user,
      );
      expect(result.items[0].taxableAmount).toBe(900);
    });

    it('should default pickupAddress to Central Hub for franchise code CENTRAL_WAREHOUSE', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV-PLATFORM-3',
        type: 'PAYMENT',
        status: 'GENERATED',
        issuedAt: new Date(),
        grandTotal: 1000,
        discountAmount: 0,
        shippingFee: 0,
        platformFee: 0,
        gst: 0,
        billingAddress: { state: 'Karnataka' },
        shippingAddress: { state: 'Karnataka' },
        pickupAddress: null,
        orderId: 'order-3',
        order: {
          channel: 'ONLINE',
          franchise: { code: 'CENTRAL_WAREHOUSE' },
          items: [],
        },
        stockRequest: null,
      };

      const mockPrisma = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        productVariant: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoiceService,
          {
            provide: PrismaService,
            useValue: mockPrisma,
          },
          {
            provide: RazorpayService,
            useValue: {},
          },
        ],
      }).compile();

      const testService = module.get<InvoiceService>(InvoiceService);
      const user = { role: 'SUPERADMIN' } as any;

      const result = await testService.getInvoiceByNumber(
        'INV-PLATFORM-3',
        user,
      );
      expect(result.pickupAddress?.fullName).toBe('UnBoxIO Central Hub');
    });

    it('should fall back to parsing order.addressJson when addresses relation is empty', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV-JSON-1',
        type: 'PAYMENT',
        status: 'GENERATED',
        issuedAt: new Date(),
        grandTotal: 1000,
        discountAmount: 0,
        shippingFee: 0,
        platformFee: 0,
        gst: 0,
        billingAddress: null,
        shippingAddress: null,
        pickupAddress: null,
        orderId: 'order-4',
        order: {
          channel: 'ONLINE',
          franchise: { code: 'CENTRAL_WAREHOUSE' },
          addressJson: JSON.stringify({
            street: '123 Main St',
            city: 'Bilaspur',
            state: 'Chhattisgarh',
            postalCode: '495001',
            country: 'India',
          }),
          items: [],
        },
        stockRequest: null,
      };

      const mockPrisma = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        productVariant: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoiceService,
          {
            provide: PrismaService,
            useValue: mockPrisma,
          },
          {
            provide: RazorpayService,
            useValue: {},
          },
        ],
      }).compile();

      const testService = module.get<InvoiceService>(InvoiceService);
      const user = { role: 'SUPERADMIN' } as any;

      const result = await testService.getInvoiceByNumber('INV-JSON-1', user);
      expect(result.shippingAddress?.addressLine1).toBe('123 Main St');
      expect(result.shippingAddress?.city).toBe('Bilaspur');
      expect(result.shippingAddress?.state).toBe('Chhattisgarh');
      expect(result.shippingAddress?.zipCode).toBe('495001');
      expect(result.isInterState).toBe(false); // Both are Chhattisgarh
    });

    it('should dynamically hot-fix existing database records with blank address fields', async () => {
      const mockInvoice = {
        invoiceNumber: 'INV-EXISTING-1',
        type: 'PAYMENT',
        status: 'GENERATED',
        issuedAt: new Date(),
        grandTotal: 1000,
        discountAmount: 0,
        shippingFee: 0,
        platformFee: 0,
        gst: 0,
        // Saved as placeholder/blank address objects in the DB
        billingAddress: {
          city: '',
          state: '',
          country: 'India',
          zipCode: '',
          fullName: 'OmRathore',
          addressLine1: '',
        },
        shippingAddress: {
          city: '',
          state: '',
          country: 'India',
          zipCode: '',
          fullName: 'OmRathore',
          addressLine1: '',
        },
        pickupAddress: {
          city: 'HQ',
          state: '',
          country: 'INDIA',
          zipCode: '000000',
          fullName: 'Central Warehouse',
          addressLine1: 'Central Warehouse',
        },
        orderId: 'order-5',
        order: {
          channel: 'ONLINE',
          franchise: { code: 'CENTRAL_WAREHOUSE' },
          addressJson: JSON.stringify({
            street: '123 Main St',
            city: 'Bilaspur',
            state: 'Chhattisgarh',
            postalCode: '495001',
            country: 'India',
          }),
          items: [],
        },
        stockRequest: null,
      };

      const mockPrisma = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        productVariant: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoiceService,
          {
            provide: PrismaService,
            useValue: mockPrisma,
          },
          {
            provide: RazorpayService,
            useValue: {},
          },
        ],
      }).compile();

      const testService = module.get<InvoiceService>(InvoiceService);
      const user = { role: 'SUPERADMIN' } as any;

      const result = await testService.getInvoiceByNumber(
        'INV-EXISTING-1',
        user,
      );
      expect(result.pickupAddress?.fullName).toBe('UnBoxIO Central Hub');
      expect(result.pickupAddress?.state).toBe('Chhattisgarh');
      expect(result.shippingAddress?.addressLine1).toBe('123 Main St');
      expect(result.shippingAddress?.state).toBe('Chhattisgarh');
      expect(result.isInterState).toBe(false);
    });
  });
});
