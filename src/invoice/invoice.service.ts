import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, PlatformInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceType as PaymentInvoiceType } from '../financial/payment/enums/payment.enum';
import {
  Prisma,
  InvoicePaymentStatus,
  InvoiceStatus,
  InvoiceType,
  OrderItem,
  Role,
  StockRequestPaymentStatus,
} from '@prisma/client';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { randomBytes, randomUUID } from 'crypto';
import { RazorpayService } from 'src/financial/payment/razorpay.service';
import { ORDER_ITEM_PRODUCT_SELECT } from 'src/orders/services/order-query.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import {
  InvoiceViewModel,
  InvoiceItemSnapshot,
  AddressSnapshot,
} from './interfaces/invoice.interface';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type InvoiceAddressSnapshot = {
  fullName?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  landmark?: string;
};

@Injectable()
export class InvoiceService {
  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
  ) {}

  private firstNonEmpty(
    ...values: Array<string | null | undefined>
  ): string | undefined {
    return values
      .find((value) => typeof value === 'string' && value.trim())
      ?.trim();
  }

  private buildAddressSnapshot(
    source?: Partial<InvoiceAddressSnapshot> | null,
    fallback?: Partial<InvoiceAddressSnapshot> | null,
  ): InvoiceAddressSnapshot {
    const merged = { country: 'India', ...(fallback ?? {}), ...(source ?? {}) };

    return {
      fullName: this.firstNonEmpty(merged.fullName) ?? undefined,
      phone: this.firstNonEmpty(merged.phone) ?? undefined,
      addressLine1: this.firstNonEmpty(merged.addressLine1) ?? '',
      addressLine2: this.firstNonEmpty(merged.addressLine2) ?? undefined,
      city: this.firstNonEmpty(merged.city) ?? '',
      state: this.firstNonEmpty(merged.state) ?? '',
      zipCode: this.firstNonEmpty(merged.zipCode) ?? '',
      country: this.firstNonEmpty(merged.country) ?? 'India',
      landmark: this.firstNonEmpty(merged.landmark) ?? undefined,
    };
  }

  private isEmptyJsonValue(
    value: Prisma.JsonValue | null | undefined,
  ): boolean {
    if (value == null) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim().length === 0;
    }

    return this.isJsonObject(value) && Object.keys(value).length === 0;
  }

  private isJsonObject(
    value: Prisma.JsonValue | null | undefined,
  ): value is Prisma.JsonObject {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private fallbackShippingAddressFromOrder(order: any): InvoiceAddressSnapshot {
    const address = order?.customer?.addresses?.[0];

    let parsedAddress: any = null;
    if (typeof order?.addressJson === 'string' && order.addressJson.trim()) {
      try {
        parsedAddress = JSON.parse(order.addressJson);
      } catch (e) {}
    }

    return this.buildAddressSnapshot(
      {
        fullName:
          order?.customer?.name ||
          order?.retailCustomer?.name ||
          order?.billingSnapshot?.customer?.name,
        phone:
          order?.customer?.phone ||
          order?.retailCustomer?.phoneNorm ||
          order?.billingSnapshot?.customer?.phone,
        addressLine1:
          address?.addressLine1 ||
          parsedAddress?.street ||
          parsedAddress?.addressLine1,
        addressLine2: address?.addressLine2 || parsedAddress?.addressLine2,
        city:
          address?.city ||
          order?.billingSnapshot?.delivery?.address?.city ||
          parsedAddress?.city,
        state:
          address?.state ||
          order?.billingSnapshot?.delivery?.address?.state ||
          parsedAddress?.state,
        zipCode:
          address?.postalCode ||
          order?.billingSnapshot?.delivery?.address?.zipCode ||
          order?.billingSnapshot?.delivery?.address?.postalCode ||
          parsedAddress?.postalCode ||
          parsedAddress?.zipCode,
        country:
          address?.country ||
          order?.billingSnapshot?.delivery?.address?.country ||
          parsedAddress?.country ||
          'India',
        landmark: address?.landmark || parsedAddress?.landmark,
      },
      {
        city:
          order?.billingSnapshot?.delivery?.address?.city ||
          parsedAddress?.city,
        state:
          order?.billingSnapshot?.delivery?.address?.state ||
          parsedAddress?.state,
        zipCode:
          order?.billingSnapshot?.delivery?.address?.zipCode ||
          order?.billingSnapshot?.delivery?.address?.postalCode ||
          parsedAddress?.postalCode ||
          parsedAddress?.zipCode,
        country:
          order?.billingSnapshot?.delivery?.address?.country ||
          parsedAddress?.country ||
          'India',
      },
    );
  }

  private pickupAddressFromOrder(order: any): InvoiceAddressSnapshot {
    const franchise = order?.franchise;
    if (
      !franchise ||
      (franchise.code && franchise.code.toUpperCase().startsWith('CENTRAL'))
    ) {
      return this.pickupAddressFromStockRequest();
    }

    return this.buildAddressSnapshot(
      {
        fullName:
          franchise?.businessName ||
          franchise?.name ||
          order?.billingSnapshot?.seller?.name ||
          franchise?.code,
        addressLine1:
          franchise?.addressLine1 ||
          order?.billingSnapshot?.seller?.addressLine1 ||
          franchise?.businessName ||
          franchise?.name ||
          'CENTRAL-HUB',
        city: franchise?.city || order?.billingSnapshot?.seller?.city,
        state: franchise?.state,
        zipCode:
          franchise?.postalCode || order?.billingSnapshot?.seller?.postalCode,
        country: franchise?.country || order?.billingSnapshot?.seller?.country,
      },
      {
        country: 'India',
      },
    );
  }

  private shippingAddressFromStockRequest(
    stockRequest: any,
  ): InvoiceAddressSnapshot {
    const franchise = stockRequest?.franchise;

    return this.buildAddressSnapshot(
      {
        fullName: franchise?.businessName || franchise?.name || franchise?.code,
        phone: franchise?.ownerPhone,
        addressLine1:
          franchise?.addressLine1 || franchise?.name || 'CENTRAL-HUB',
        city: franchise?.city,
        state: franchise?.state || franchise?.territory,
        zipCode: franchise?.postalCode,
        country: franchise?.country || 'India',
      },
      {
        country: 'India',
      },
    );
  }

  private pickupAddressFromStockRequest(): InvoiceAddressSnapshot {
    return this.buildAddressSnapshot(
      {
        fullName: 'ScentsOfWax Central Hub',
        addressLine1: 'CENTRAL-HUB',
        city: 'Bilaspur',
        state: 'Chhattisgarh',
        zipCode: '495001',
        country: 'India',
      },
      {
        country: 'India',
      },
    );
  }

  private isBlankAddress(addr: any): boolean {
    if (!addr) return true;
    const clean = (s: any) => (typeof s === 'string' ? s.trim() : '');
    return !clean(addr.addressLine1) && !clean(addr.city) && !clean(addr.state);
  }

  private hydrateInvoiceAddresses(invoice: any) {
    const shippingAddress =
      this.isEmptyJsonValue(invoice.shippingAddress) ||
      this.isBlankAddress(invoice.shippingAddress)
        ? invoice.orderId
          ? this.fallbackShippingAddressFromOrder(invoice.order)
          : invoice.stockRequestId
            ? this.shippingAddressFromStockRequest(invoice.stockRequest)
            : invoice.shippingAddress
        : invoice.shippingAddress;

    let pickupAddress =
      this.isEmptyJsonValue(invoice.pickupAddress) ||
      this.isBlankAddress(invoice.pickupAddress)
        ? invoice.orderId
          ? this.pickupAddressFromOrder(invoice.order)
          : invoice.stockRequestId
            ? this.pickupAddressFromStockRequest()
            : invoice.pickupAddress
        : invoice.pickupAddress;

    // Platform fulfillment override/fallback for both new and existing records
    const isPlatform =
      (invoice.order &&
        (!invoice.order.franchise ||
          (invoice.order.franchise.code &&
            invoice.order.franchise.code
              .toUpperCase()
              .startsWith('CENTRAL')))) ||
      (pickupAddress &&
        (pickupAddress.fullName === 'Central Warehouse' ||
          pickupAddress.city === 'HQ' ||
          pickupAddress.zipCode === '000000'));

    if (isPlatform) {
      pickupAddress = this.pickupAddressFromStockRequest();
    }

    const billingAddress =
      this.isEmptyJsonValue(invoice.billingAddress) ||
      this.isBlankAddress(invoice.billingAddress)
        ? shippingAddress
        : invoice.billingAddress;

    return {
      ...invoice,
      billingAddress,
      shippingAddress,
      pickupAddress,
    };
  }

  async findAll(query: InvoiceQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const isPaymentList = query.type === InvoiceType.PAYMENT;

    const where: Prisma.InvoiceWhereInput = {
      isDeleted: false,
    };

    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;

    if (query.shipmentPaymentMode) {
      where.shipmentPaymentMode = query.shipmentPaymentMode;
    }

    if (query.orderNumber) {
      where.order = {
        orderNumber: query.orderNumber,
      };
    }

    if (query.invoiceNumber) {
      where.invoiceNumber = {
        contains: query.invoiceNumber,
        mode: 'insensitive',
      };
    }

    if (query.storeName) {
      where.storeName = {
        contains: query.storeName,
        mode: 'insensitive',
      };
    }

    if (query.buyerPhone) {
      where.buyerPhone = {
        contains: query.buyerPhone,
      };
    }

    if (query.buyerName) {
      where.buyerName = {
        contains: query.buyerName,
        mode: 'insensitive',
      };
    }

    if (query.orderId) where.orderId = query.orderId;

    if (query.stockRequestId) {
      where.stockRequestId = query.stockRequestId;
    }

    if (query.franchiseId) {
      where.OR = [
        {
          order: {
            franchiseId: query.franchiseId,
          },
        },
        {
          stockRequest: {
            franchiseId: query.franchiseId,
          },
        },
      ];
    }

    if (query.fromDate || query.lastDate) {
      where.issuedAt = {};

      if (query.fromDate) {
        where.issuedAt.gte = new Date(query.fromDate);
      }

      if (query.lastDate) {
        where.issuedAt.lte = new Date(query.lastDate);
      }
    }

    const [invoices, total] = await this.prisma.$transaction([
      isPaymentList
        ? this.prisma.invoice.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
              issuedAt: query.order ?? 'desc',
            },
            select: {
              id: true,
              invoiceNumber: true,
              type: true,
              buyerName: true,
              buyerPhone: true,
              buyerEmail: true,
              storeName: true,
              items: true,
              subtotal: true,
              discountAmount: true,
              shippingFee: true,
              platformFee: true,
              gst: true,
              grandTotal: true,
              paymentStatus: true,
              status: true,
              issuedAt: true,
            },
          })
        : this.prisma.invoice.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
              issuedAt: query.order ?? 'desc',
            },
            include: {
              order: {
                select: {
                  id: true,
                  items: {
                    select: {
                      id: true,
                      productId: true,
                      variantId: true,
                      productName: true,
                      sku: true,
                      quantity: true,
                      unitPrice: true,
                      finalAmount: true,
                      product: { select: { id: true, name: true } },
                    },
                  },
                  orderNumber: true,
                  franchiseId: true,
                  customerId: true,
                  total: true,
                  latitude: true,
                  longitude: true,
                  addressJson: true,
                  billingSnapshot: true,
                  franchise: {
                    select: {
                      id: true,
                      name: true,
                      businessName: true,
                      code: true,
                      addressLine1: true,
                      city: true,
                      state: true,
                      postalCode: true,
                      country: true,
                    },
                  },
                  customer: {
                    select: {
                      id: true,
                      name: true,
                      phone: true,
                      longitude: true,
                      latitude: true,
                      user: {
                        select: {
                          email: true,
                        },
                      },
                      addresses: {
                        where: { isDefault: true },
                        take: 1,
                        select: {
                          addressLine1: true,
                          addressLine2: true,
                          city: true,
                          state: true,
                          postalCode: true,
                          country: true,
                        },
                      },
                    },
                  },
                  retailCustomer: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      phoneNorm: true,
                    },
                  },
                },
              },
              stockRequest: {
                select: {
                  id: true,
                  product: { select: { id: true, name: true } },
                  franchiseId: true,
                  franchise: {
                    select: {
                      id: true,
                      name: true,
                      businessName: true,
                      code: true,
                      ownerPhone: true,
                      addressLine1: true,
                      city: true,
                      state: true,
                      territory: true,
                      postalCode: true,
                      country: true,
                      latitude: true,
                      longitude: true,
                      users: {
                        select: {
                          email: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          }),

      this.prisma.invoice.count({ where }),
    ]);

    const data = isPaymentList
      ? invoices.map((invoice: any) => ({
          invoiceNumber: invoice.invoiceNumber,
          type: invoice.type,
          buyerName: invoice.buyerName,
          buyerPhone: invoice.buyerPhone,
          buyerEmail: invoice.buyerEmail,
          storeName: invoice.storeName,
          items: (invoice.items ?? []).map((item: any) => ({
            productName: this.firstNonEmpty(item.productName, item.title) ?? '',
            quantity: item.quantity ?? 0,
            unitPrice: item.unitPrice ?? 0,
            lineTotal: item.finalAmount ?? item.totalAmount ?? 0,
          })),
          subtotal: invoice.subtotal,
          charges: {
            discountAmount: invoice.discountAmount,
            shippingFee: invoice.shippingFee,
            platformFee: invoice.platformFee,
            gst: invoice.gst,
          },
          grandTotal: invoice.grandTotal,
          paymentStatus: invoice.paymentStatus,
          status: invoice.status,
          issuedAt: invoice.issuedAt,
        }))
      : invoices.map((invoice) => this.hydrateInvoiceAddresses(invoice));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async resolverOrder(payload: {
    orderNumber?: string;
    stockRequestId?: string;
  }) {
    const { orderNumber, stockRequestId } = payload;

    // =========================
    // ORDER
    // =========================

    if (orderNumber) {
      const select: Prisma.OrderSelect = {
        id: true,
        orderRequestId: true,
        orderNumber: true,
        invoiceNumber: true,
        channel: true,
        createdAt: true,
        updatedAt: true,
        saleType: true,
        paymentMode: true,
        onlinePaymentStatus: true,
        status: true,
        paidAt: true,
        paymentProvider: true,
        paymentReference: true,
        couponCode: true,
        giftMessage: true,
        giftWrap: true,
        giftWrapperFee: true,
        customerId: true,
        franchiseId: true,
        soldByUserId: true,
        isApproved: true,
        approvedByUserId: true,
        franchisePaybleAmount: true,
        franchise: {
          select: {
            id: true,
            name: true,
            code: true,
            badge: true,
            businessName: true,
            ownerEmail: true,
            status: true,
            acceptingOrders: true,
            city: true,
            country: true,
            postalCode: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            user: { select: { email: true } },
          },
        },
        retailCustomer: true,
        soldBy: { select: { id: true, email: true } },
        items: { include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } } },
        total: true,
        billingSnapshot: true,
        addressJson: true,
        latitude: true,
        longitude: true,
      };

      const order: any = await this.prisma.order.findUnique({
        where: { orderNumber },
        include: {
          franchise: {
            select: {
              id: true,
              name: true,
              code: true,
              badge: true,
              businessName: true,
              ownerEmail: true,
              status: true,
              acceptingOrders: true,
              city: true,
              country: true,
              postalCode: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              status: true,
              user: { select: { email: true } },
            },
          },
          soldBy: { select: { id: true, email: true } },
          items: {
            include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } },
          },
          retailCustomer: true,
          orderRequest: true,
        },
      });

      if (!order) {
        throw new NotFoundException(
          `No order found for order number ${orderNumber}`,
        );
      }

      const orderItems = order.items ?? [];

      const orderGstRate = Number(
        orderItems.find((item: any) => item.gstPercent != null)?.gstPercent ??
          18,
      );

      const resolvedPaymentStatus =
        order.onlinePaymentStatus === 'PAID' ||
        ['CASH', 'CARD', 'UPI', 'QR', 'NETBANKING'].includes(order.paymentMode)
          ? InvoicePaymentStatus.PAID
          : InvoicePaymentStatus.PENDING;

      return {
        orderId: order.id,

        buyerName:
          order.customer?.name || order.retailCustomer?.name || 'UNKNOWN',

        buyerPhone:
          order.customer?.phone || order.retailCustomer?.phoneNorm || '',

        buyerEmail:
          order.customer?.user?.email || order.retailCustomer?.email || '',

        storeName:
          order.franchise?.businessName ||
          order.franchise?.name ||
          order.franchise?.code ||
          'CENTRAL-HUB',

        shippingAddress: this.fallbackShippingAddressFromOrder(order),

        pickupAddress: this.pickupAddressFromOrder(order),

        longitude: order.customer?.longitude ?? 0,

        latitude: order.customer?.latitude ?? 0,

        items: orderItems.map((item: OrderItem) => ({
          productId: item.productId,
          variantId: item.variantId,
          title: item.productName,
          variantName: item.variantName,
          sku: item.sku || (item as any).product?.slug || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discountAmount,
          taxableAmount:
            Number(item.quantity) * Number(item.unitPrice) -
            Number(item.discountAmount || 0),
          gstRate: item.gstPercent,
          totalAmount: item.finalAmount,
        })),

        subtotal: order.total,

        discountAmount: order.discountAmount ?? 0,

        gstRate: orderGstRate,

        grandTotal: order.total,

        paymentMethod: order.paymentMode === 'COD' ? 'COD' : 'PREPAID',
        paymentReferenceId: order.paymentReference || null,
        paymentStatus: resolvedPaymentStatus,

        status: InvoiceStatus.GENERATED,

        shippingFee: (() => {
          let fee = 0;
          if (order.billingSnapshot) {
            const snapshot = typeof order.billingSnapshot === 'string' ? JSON.parse(order.billingSnapshot) : order.billingSnapshot;
            if (snapshot?.totals?.shippingFee != null) {
              fee = Number(snapshot.totals.shippingFee);
            }
          }
          if (fee === 0 && order.orderRequest?.requestSnapshot) {
            const snapshot = typeof order.orderRequest.requestSnapshot === 'string' ? JSON.parse(order.orderRequest.requestSnapshot) : order.orderRequest.requestSnapshot;
            if (snapshot?.discount?.shippingFee != null) {
              fee = Number(snapshot.discount.shippingFee);
            }
          }
          return fee;
        })(),
      };
    }

    // =========================
    // STOCK REQUEST
    // =========================

    if (stockRequestId) {
      const stockRequest = await this.prisma.stockRequest.findUnique({
        where: {
          id: stockRequestId,
        },

        select: {
          id: true,

          productId: true,
          variantId: true,
          product: { select: { name: true } },
          variant: { select: { sku: true } },
          quantity: true,
          approvedQuantity: true,
          unitPriceAtApproval: true,
          // discountAmount: true,
          billingTax: true,
          gstRatePercent: true,

          billingSubtotal: true,
          billingTotal: true,
          paymentStatus: true,
          isFullyPaid: true,
          paymentMode: true,
          paymentReference: true,
          // shippingFee: true,
          // platformFee: true,
          // gst: true,

          franchise: {
            select: {
              id: true,
              name: true,
              ownerPhone: true,
              longitude: true,
              latitude: true,
              city: true,
              postalCode: true,
              country: true,
              territory: true,
              addressLine1: true,
              state: true,

              users: {
                select: {
                  email: true,
                },
              },
            },
          },
          type: true,
          bundleAssignments: {
            select: {
              bundle: {
                select: {
                  items: {
                    select: {
                      productId: true,
                      variantId: true,
                      quantity: true,
                      product: { select: { name: true } },
                      variant: { 
                        select: { 
                          sku: true, 
                          attributeSummary: true, 
                          wholesalePrice: true,
                          attributes: {
                            include: {
                              attributeValue: {
                                include: {
                                  attributeName: true
                                }
                              }
                            }
                          }
                        } 
                      }
                    }
                  }
                }
              }
            }
          }
        },
      });

      if (!stockRequest) {
        throw new NotFoundException(
          `No stock request found for ID ${stockRequestId}`,
        );
      }

      return {
        stockRequestId: stockRequest.id,

        buyerName: stockRequest.franchise?.name || 'UNKNOWN',

        buyerPhone: stockRequest.franchise?.ownerPhone || '',

        buyerEmail: stockRequest.franchise?.users?.[0]?.email || '',

        storeName: 'CENTRAL-HUB',

        shippingAddress: this.shippingAddressFromStockRequest(stockRequest),

        pickupAddress: this.pickupAddressFromStockRequest(),

        longitude: stockRequest.franchise?.longitude ?? 0,

        latitude: stockRequest.franchise?.latitude ?? 0,

        items: stockRequest.type === 'BUNDLE' && stockRequest.bundleAssignments?.[0]?.bundle?.items?.length
          ? (() => {
              const bundleItems = stockRequest.bundleAssignments[0].bundle.items;
              const totalQtyInBundle = bundleItems.reduce((acc: number, item: any) => acc + (item.quantity ?? 1), 0);
              let remainingSubtotal = Number(stockRequest.billingSubtotal ?? 0);
              let remainingTotal = Number(stockRequest.billingTotal ?? 0);
              
              return bundleItems.map((item: any, index: number) => {
                const isLast = index === bundleItems.length - 1;
                const qtyInBundle = item.quantity ?? 1;
                const finalQty = qtyInBundle;
                
                let taxableAmount = 0;
                let totalAmount = 0;
                
                if (isLast) {
                  taxableAmount = remainingSubtotal;
                  totalAmount = remainingTotal;
                } else {
                  taxableAmount = Number(((Number(stockRequest.billingSubtotal ?? 0) * qtyInBundle) / totalQtyInBundle).toFixed(2));
                  totalAmount = Number(((Number(stockRequest.billingTotal ?? 0) * qtyInBundle) / totalQtyInBundle).toFixed(2));
                  remainingSubtotal -= taxableAmount;
                  remainingTotal -= totalAmount;
                }
                
                const unitPrice = finalQty > 0 ? Number((taxableAmount / finalQty).toFixed(2)) : 0;
                
                let attrStr = '';
                if (item.variant?.attributes && item.variant.attributes.length > 0) {
                  const attrs = item.variant.attributes
                    .map((attr: any) => {
                      const name = attr.attributeValue?.attributeName?.title || '';
                      const val = attr.attributeValue?.title || '';
                      return name && val ? `${name}: ${val}` : '';
                    })
                    .filter(Boolean)
                    .join(', ');
                  if (attrs) attrStr = ` (${attrs})`;
                } else if (item.variant?.attributeSummary && !item.variant.attributeSummary.includes('cmqdkia9')) {
                  attrStr = ` (${item.variant.attributeSummary.replace(/\|/g, ', ')})`;
                }

                const title = `${item.product?.name || 'PRODUCT'}${attrStr}`;

                return {
                  productId: item.productId,
                  variantId: item.variantId,
                  title,
                  variantName: item.variant?.sku || `VARIANT-${item.variantId}`,
                  sku: item.variant?.sku || `SKU-${item.productId}-${item.variantId}`,
                  quantity: finalQty,
                  unitPrice,
                  discount: 0,
                  taxableAmount,
                  gstRate: Number(stockRequest.gstRatePercent ?? 0),
                  totalAmount,
                };
              });
            })()
          : [
              {
                productId: stockRequest.productId,
                variantId: stockRequest.variantId,
                title: stockRequest.product?.name || 'PRODUCT',
                variantName:
                  stockRequest.variant?.sku || `VARIANT-${stockRequest.variantId}`,
                sku:
                  stockRequest.variant?.sku ||
                  `SKU-${stockRequest.productId}-${stockRequest.variantId}`,
                quantity: stockRequest.approvedQuantity,
                unitPrice: stockRequest.unitPriceAtApproval,
                discount: 0,
                taxableAmount: stockRequest.billingSubtotal ?? 0,
                gstRate: stockRequest.gstRatePercent ?? 0,
                totalAmount: stockRequest.billingTotal,
              },
            ],

        subtotal: stockRequest.billingSubtotal ?? 0,

        // discountAmount: stockRequest.discountAmount ?? 0,
        discountAmount: 0,

        // shippingFee: stockRequest.shippingFee ?? 0,

        // platformFee: stockRequest.platformFee ?? 0,

        gstRate: Number(stockRequest.gstRatePercent) ?? 0,

        grandTotal: stockRequest.billingTotal ?? 0,

        paymentMethod: 'PREPAID',
        paymentReferenceId: stockRequest.paymentReference || null,
        paymentStatus:
          stockRequest.paymentStatus === StockRequestPaymentStatus.PAID ||
          stockRequest.paymentStatus === StockRequestPaymentStatus.WAIVED ||
          stockRequest.isFullyPaid
            ? InvoicePaymentStatus.PAID
            : InvoicePaymentStatus.PENDING,

        status: InvoiceStatus.GENERATED,
      };
    }

    throw new NotFoundException('Order number or stock request ID is required');
  }

  private async generateUniqueInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    let isUnique = false;
    let invoiceNumber = '';
    while (!isUnique) {
      const randomStr = randomBytes(3).toString('hex').toUpperCase(); // 6 chars random hex
      invoiceNumber = `GFINO-${dateStr}-${randomStr}`;

      const count = await this.prisma.invoice.count({
        where: { invoiceNumber },
      });
      if (count === 0) {
        isUnique = true;
      }
    }
    return invoiceNumber;
  }

  private async updateRelatedRecords(invoice: {
    invoiceNumber: string;
    orderId?: string | null;
    stockRequestId?: string | null;
  }) {
    if (invoice.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: invoice.orderId },
        select: { invoiceNumber: true },
      });
      if (order && !order.invoiceNumber) {
        await this.prisma.order.update({
          where: { id: invoice.orderId },
          data: { invoiceNumber: invoice.invoiceNumber },
        });
      }
    }

    if (invoice.stockRequestId) {
      const stockRequest = await this.prisma.stockRequest.findUnique({
        where: { id: invoice.stockRequestId },
        select: { invoiceNumber: true },
      });
      if (stockRequest && !stockRequest.invoiceNumber) {
        await this.prisma.stockRequest.update({
          where: { id: invoice.stockRequestId },
          data: { invoiceNumber: invoice.invoiceNumber },
        });
      }
    }
  }

  async generateInvoiceX(dto: CreateInvoiceDto) {
    const { platformFee = 0, shippingFee = 0 } = dto;

    if (dto.stockRequestId) {
      const existing = await this.prisma.invoice.findFirst({
        where: {
          stockRequestId: dto.stockRequestId,
          isDeleted: false,
        },
      });

      if (existing) {
        await this.updateRelatedRecords(existing);
        return this.hydrateInvoiceAddresses(existing);
      }
    } else if (dto.orderNumber) {
      const existing = await this.prisma.invoice.findFirst({
        where: {
          order: {
            orderNumber: dto.orderNumber,
          },
          isDeleted: false,
        },
      });
      if (existing) {
        await this.updateRelatedRecords(existing);
        return this.hydrateInvoiceAddresses(existing);
      }
    }

    if (dto.invoiceNumber) {
      const existing = await this.prisma.invoice.findUnique({
        where: {
          invoiceNumber:
            dto.invoiceNumber ||
            `#INV-${dto.orderNumber || dto.stockRequestId}`,
        },
        include: {
          order: {
            select: {
              id: true,
              items: {
                select: {
                  id: true,
                  productId: true,
                  variantId: true,
                  productName: true,
                  sku: true,
                  quantity: true,
                  unitPrice: true,
                  finalAmount: true,
                  product: { select: { id: true, name: true } },
                },
              },
              orderNumber: true,
              franchiseId: true,
              customerId: true,
              total: true,
              latitude: true,
              longitude: true,
              addressJson: true,
              billingSnapshot: true,
              franchise: {
                select: {
                  id: true,
                  name: true,
                  businessName: true,
                  code: true,
                  addressLine1: true,
                  city: true,
                  state: true,
                  postalCode: true,
                  country: true,
                },
              },
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  longitude: true,
                  latitude: true,
                  user: {
                    select: {
                      email: true,
                    },
                  },
                  addresses: {
                    where: { isDefault: true },
                    take: 1,
                    select: {
                      addressLine1: true,
                      addressLine2: true,
                      city: true,
                      state: true,
                      postalCode: true,
                      country: true,
                    },
                  },
                },
              },
              retailCustomer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNorm: true,
                },
              },
            },
          },
          stockRequest: {
            select: {
              id: true,
              product: { select: { id: true, name: true } },
              franchiseId: true,
              franchise: {
                select: {
                  id: true,
                  name: true,
                  businessName: true,
                  code: true,
                  ownerPhone: true,
                  addressLine1: true,
                  city: true,
                  state: true,
                  territory: true,
                  postalCode: true,
                  country: true,
                  latitude: true,
                  longitude: true,
                  users: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (existing) {
        await this.updateRelatedRecords(existing);
        return this.hydrateInvoiceAddresses(existing);
      }
    }

    const result = await this.resolverOrder({
      orderNumber: dto.orderNumber,
      stockRequestId: dto.stockRequestId,
    });

    let invoiceNumber = dto.invoiceNumber;
    if (
      !invoiceNumber ||
      invoiceNumber.startsWith('INV-') ||
      invoiceNumber.startsWith('#INV-')
    ) {
      invoiceNumber = await this.generateUniqueInvoiceNumber();
    } else if (!invoiceNumber.toUpperCase().startsWith('GFINO')) {
      invoiceNumber = `GFINO-${invoiceNumber
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')}`;
    }

    const {
      orderId,
      stockRequestId,
      gstRate,
      paymentMethod,
      ...invoiceSnapshot
    } = result as any;

    const response = await this.prisma.invoice.create({
      data: {
        ...invoiceSnapshot,

        ...(orderId
          ? {
              order: {
                connect: {
                  id: orderId,
                },
              },
            }
          : {}),

        ...(stockRequestId
          ? {
              stockRequest: {
                connect: {
                  id: stockRequestId,
                },
              },
            }
          : {}),

        order_date: dto.order_date ? new Date(dto.order_date) : new Date(),

        shipmentPaymentMode:
          dto.shipmentPaymentMode ?? dto.shipmentPaymentMode ?? paymentMethod,

        longitude: String(result.longitude ?? 0),

        latitude: String(result.latitude ?? 0),

        invoiceNumber,

        platformFee,

        shippingFee: dto.shippingFee !== undefined ? dto.shippingFee : (result.shippingFee ?? 0),

        gst:
          (dto.gstRate ?? gstRate ?? 18)
            ? (Number(result.subtotal) * (dto.gstRate ?? gstRate ?? 18)) / 100
            : 0,

        grandTotal: result.grandTotal,

        length: dto.length,
        breadth: dto.breadth,
        height: dto.height,
        weight: dto.weight,

        items: result.items.map((item: any) => toJsonValue(item)),

        billingAddress: dto.billingAddress
          ? toJsonValue(dto.billingAddress)
          : toJsonValue(result.shippingAddress),

        shippingAddress: toJsonValue(result.shippingAddress),

        ...(dto.pickupAddress === undefined
          ? {
              pickupAddress: toJsonValue(dto.pickupAddress),
            }
          : {
              pickupAddress: toJsonValue(result.pickupAddress),
            }),

        paymentStatus: result.paymentStatus ?? InvoicePaymentStatus.PENDING,
        paymentReferenceId: result.paymentReferenceId ?? null,

        status: InvoiceStatus.GENERATED,
      },
    });

    await this.updateRelatedRecords(response);
    return response;
  }

  async generatedInvoice(dto: PlatformInvoiceDto) {
    const { shippingFee = 0 } = dto;

    if (dto.stockRequestId) {
      const existing = await this.prisma.invoice.findFirst({
        where: {
          stockRequestId: dto.stockRequestId,
          isDeleted: false,
        },
      });

      if (existing) {
        await this.updateRelatedRecords(existing);
        return this.hydrateInvoiceAddresses(existing);
      }
    }

    if (dto.orderNumber) {
      const order = await this.prisma.order.findUnique({
        where: { orderNumber: dto.orderNumber },
      });
      if (order) {
        const isPickupCod =
          order.saleType?.toUpperCase() === 'PICKUP' &&
          order.paymentMode === 'COD';
        if (isPickupCod && order.status !== 'DELIVERED') {
          throw new BadRequestException(
            `Invoice cannot be generated for PICKUP and COD orders until they are DELIVERED`,
          );
        }
      }

      const existing = await this.prisma.invoice.findFirst({
        where: {
          order: {
            orderNumber: dto.orderNumber,
          },
          isDeleted: false,
        },
      });
      if (existing) {
        await this.updateRelatedRecords(existing);
        return this.hydrateInvoiceAddresses(existing);
      }
    }

    const result = await this.resolverOrder({
      orderNumber: dto.orderNumber,
      stockRequestId: dto.stockRequestId,
    });

    const invoiceNumber = await this.generateUniqueInvoiceNumber();

    const {
      orderId,
      stockRequestId,
      gstRate,
      paymentMethod,
      ...invoiceSnapshot
    } = result as any;

    const response = await this.prisma.invoice.create({
      data: {
        ...invoiceSnapshot,

        ...(orderId
          ? {
              order: {
                connect: {
                  id: orderId,
                },
              },
            }
          : {}),

        ...(stockRequestId
          ? {
              stockRequest: {
                connect: {
                  id: stockRequestId,
                },
              },
            }
          : {}),

        order_date: dto.order_date ? new Date(dto.order_date) : new Date(),

        shipmentPaymentMode: paymentMethod,

        longitude: String(result.longitude ?? 0),

        latitude: String(result.latitude ?? 0),

        invoiceNumber,

        shippingFee: dto.shippingFee !== undefined ? dto.shippingFee : (result.shippingFee ?? 0),

        gst:
          (dto.gstRate ?? gstRate ?? 18)
            ? (Number(result.subtotal) * (dto.gstRate ?? gstRate ?? 18)) / 100
            : 0,

        grandTotal: result.grandTotal,

        items: result.items.map((item: any) => toJsonValue(item)),

        billingAddress: toJsonValue(result.shippingAddress),

        shippingAddress: toJsonValue(result.shippingAddress),
        pickupAddress: toJsonValue(result.pickupAddress),

        paymentStatus: result.paymentStatus ?? InvoicePaymentStatus.PENDING,
        paymentReferenceId: result.paymentReferenceId ?? null,

        status: InvoiceStatus.GENERATED,
      },
    });

    await this.updateRelatedRecords(response);
    return response;
  }

  async update(invoiceNumer: string, dto: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber: invoiceNumer },
    });

    if (!invoice || invoice.isDeleted) {
      throw new NotFoundException(`Invoice with ID ${invoiceNumer} not found`);
    }

    const data: Prisma.InvoiceUncheckedUpdateInput = {
      buyerName: dto.buyerName ?? invoice.buyerName,

      buyerPhone: dto.buyerPhone ?? invoice.buyerPhone,

      buyerEmail: dto.buyerEmail ?? invoice.buyerEmail,

      storeName: dto.storeName ?? invoice.storeName,

      ...(dto.billingAddress !== undefined
        ? {
            billingAddress: toJsonValue(dto.billingAddress),
          }
        : {}),

      ...(dto.shippingAddress !== undefined
        ? {
            shippingAddress: toJsonValue(dto.shippingAddress),
          }
        : {}),

      ...(dto.pickupAddress !== undefined
        ? {
            pickupAddress: toJsonValue(dto.pickupAddress),
          }
        : {}),

      ...(dto.items !== undefined
        ? {
            items: dto.items.map((item) => toJsonValue(item)),
          }
        : {}),

      subtotal: dto.subtotal ?? invoice.subtotal,

      discountAmount: dto.discountAmount ?? invoice.discountAmount,

      shippingFee: dto.shippingFee ?? invoice.shippingFee,

      platformFee: dto.platformFee ?? invoice.platformFee,

      gst: dto.gst ?? invoice.gst,

      grandTotal: dto.grandTotal ?? invoice.grandTotal,

      shipmentPaymentMode:
        dto.shipmentPaymentMode ??
        dto.paymentMethod ??
        invoice.shipmentPaymentMode,

      paymentStatus: dto.paymentStatus ?? invoice.paymentStatus,
    };

    return this.prisma.invoice.update({
      where: { invoiceNumber: invoiceNumer },
      data,
    });
  }

  async remove(id: string, deletedBy: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.isDeleted) {
      return invoice;
    }

    return this.prisma.invoice.update({
      where: { id },

      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy,
      },
    });
  }

  async upsert(dto: UpdateInvoiceDto) {
    let invoiceNumber = dto.invoiceNumber;

    if (!invoiceNumber) {
      if (dto.orderNumber) {
        const order = await this.prisma.order.findUnique({
          where: { orderNumber: dto.orderNumber },
          select: { invoiceNumber: true },
        });
        if (order?.invoiceNumber) {
          invoiceNumber = order.invoiceNumber;
        }
      } else if (dto.stockRequestId) {
        const sr = await this.prisma.stockRequest.findUnique({
          where: { id: dto.stockRequestId },
          select: { invoiceNumber: true },
        });
        if (sr?.invoiceNumber) {
          invoiceNumber = sr.invoiceNumber;
        }
      }
    }

    if (
      !invoiceNumber ||
      invoiceNumber.startsWith('INV-') ||
      invoiceNumber.startsWith('#INV-')
    ) {
      invoiceNumber = await this.generateUniqueInvoiceNumber();
    } else if (!invoiceNumber.toUpperCase().startsWith('GFINO')) {
      invoiceNumber = `GFINO-${invoiceNumber
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')}`;
    }

    const invoice = await this.prisma.invoice.upsert({
      where: {
        invoiceNumber,
      },
      update: {
        buyerName: dto.buyerName,

        buyerPhone: dto.buyerPhone,

        buyerEmail: dto.buyerEmail,

        storeName: dto.storeName,

        ...(dto.billingAddress
          ? {
              billingAddress: toJsonValue(dto.billingAddress),
            }
          : {}),

        ...(dto.shippingAddress
          ? {
              shippingAddress: toJsonValue(dto.shippingAddress),
            }
          : {}),

        ...(dto.pickupAddress
          ? {
              pickupAddress: toJsonValue(dto.pickupAddress),
            }
          : {}),

        ...(dto.items
          ? {
              items: dto.items.map((item) => toJsonValue(item)),
            }
          : {}),

        subtotal: dto.subtotal,

        discountAmount: dto.discountAmount,

        shippingFee: dto.shippingFee,

        platformFee: dto.platformFee,

        gst: dto.gst,

        grandTotal: dto.grandTotal,

        shipmentPaymentMode: dto.shipmentPaymentMode ?? dto.paymentMethod,

        paymentStatus: dto.paymentStatus,
      },
      create: {
        invoiceNumber,

        buyerName: dto.buyerName,

        buyerPhone: dto.buyerPhone,

        buyerEmail: dto.buyerEmail,

        storeName: dto.storeName,

        billingAddress: toJsonValue(dto.billingAddress),

        shippingAddress: toJsonValue(dto.shippingAddress),
        pickupAddress: toJsonValue(dto.pickupAddress),

        items: dto.items?.length
          ? dto.items.map((item: any) => toJsonValue(item))
          : [],

        subtotal: dto.subtotal || 0,

        discountAmount: dto.discountAmount,

        shippingFee: dto.shippingFee,

        platformFee: dto.platformFee,

        gst: dto.gst,

        grandTotal: dto.grandTotal || 0,

        shipmentPaymentMode: dto.shipmentPaymentMode ?? dto.paymentMethod,

        paymentStatus: dto.paymentStatus,

        status: InvoiceStatus.GENERATED,

        order_date: new Date(),
      },
    });

    await this.updateRelatedRecords(invoice);
    return invoice;
  }

  async getInvoiceView(user: JwtUser, invoiceNumber: string) {
    const include = {
      order: {
        select: {
          id: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              status: true,
              user: { select: { email: true } },
            },
          },
          franchise: {
            select: {
              id: true,
              name: true,
              code: true,

              users: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      },
    };

    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { invoiceNumber },
      include,
    });

    return this.hydrateInvoiceAddresses(invoice);
  }

  async getInvoiceByNumber(
    invoiceNumber: string,
    user: JwtUser,
  ): Promise<InvoiceViewModel> {
    const include = {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerId: true,
          franchiseId: true,
          createdAt: true,
          paymentMode: true,
          onlinePaymentStatus: true,
          paymentReference: true,
          channel: true,
          addressJson: true,
          paidAt: true,
          items: {
            select: {
              productId: true,
              variantId: true,
              sku: true,
              variantName: true,
              gstPercent: true,
            },
          },
          customer: {
            select: {
              id: true,
              addresses: {
                where: { isDefault: true },
                take: 1,
              },
            },
          },
          franchise: {
            select: {
              id: true,
              businessName: true,
              name: true,
              code: true,
              ownerPhone: true,
              addressLine1: true,
              city: true,
              state: true,
              territory: true,
              postalCode: true,
              country: true,
            },
          },
        },
      },
      stockRequest: {
        select: {
          id: true,
          franchiseId: true,
          createdAt: true,
          productId: true,
          variantId: true,
          paymentMode: true,
          paymentReference: true,
          paymentReceivedAt: true,
          paymentStatus: true,
          isFullyPaid: true,
          type: true,
          product: {
            select: {
              name: true,
              slug: true,
              defaultGstRatePercent: true,
            },
          },
          variant: {
            select: {
              sku: true,
              attributeSummary: true,
              gstTax: true,
            },
          },
          franchise: {
            select: {
              id: true,
              businessName: true,
              name: true,
              code: true,
              ownerPhone: true,
              addressLine1: true,
              city: true,
              state: true,
              territory: true,
              postalCode: true,
              country: true,
            },
          },
        },
      },
    };

    let invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber },
      include,
    });

    if (!invoice || invoice.isDeleted) {
      const order = await this.prisma.order.findUnique({
        where: { orderNumber: invoiceNumber },
      });
      if (order) {
        const isPickupCod =
          order.saleType?.toUpperCase() === 'PICKUP' &&
          order.paymentMode === 'COD';
        if (isPickupCod) {
          if (order.status === 'DELIVERED') {
            const newInvoice = await this.generatedInvoice({
              orderNumber: order.orderNumber,
            } as any);
            invoice = await this.prisma.invoice.findUnique({
              where: { invoiceNumber: newInvoice.invoiceNumber },
              include,
            });
          } else {
            throw new NotFoundException(
              `Invoice with invoice number ${invoiceNumber} not found`,
            );
          }
        } else if (order.invoiceNumber) {
          invoice = await this.prisma.invoice.findUnique({
            where: { invoiceNumber: order.invoiceNumber },
            include,
          });
        }
      }
    }

    if (!invoice || invoice.isDeleted) {
      throw new NotFoundException(
        `Invoice with invoice number ${invoiceNumber} not found`,
      );
    }

    // Role-based Access Control / Ownership validation
    if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF) {
      // Admins have unrestricted access
    } else if (user.role === Role.CUSTOMER) {
      const isOwner =
        (invoice.order && invoice.order.customerId === user.customerId) ||
        invoice.buyerEmail === user.email;
      if (!isOwner) {
        throw new ForbiddenException(
          'You do not have permission to view this invoice',
        );
      }
    } else if (user.role === Role.FRANCHISE_OWNER) {
      const isFranchiseOwner =
        (invoice.order && invoice.order.franchiseId === user.franchiseId) ||
        (invoice.stockRequest &&
          invoice.stockRequest.franchiseId === user.franchiseId);
      if (!isFranchiseOwner) {
        throw new ForbiddenException(
          'You do not have permission to view this invoice',
        );
      }
    } else if (user.role === Role.FRANCHISE_STAFF) {
      const targetFranchiseId = user.franchiseOwnerId || user.franchiseId;
      const isFranchiseStaff =
        (invoice.order && invoice.order.franchiseId === targetFranchiseId) ||
        (invoice.stockRequest &&
          invoice.stockRequest.franchiseId === targetFranchiseId);
      if (!isFranchiseStaff) {
        throw new ForbiddenException(
          'You do not have permission to view this invoice',
        );
      }
    } else {
      throw new ForbiddenException('Invalid role permissions');
    }

    const hydrated = this.hydrateInvoiceAddresses(invoice);

    const itemsRaw = (hydrated.items as any[]) || [];
    const variantIds = itemsRaw.map((it) => it.variantId).filter(Boolean);

    const dbVariants = variantIds.length
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: {
            attributes: {
              include: {
                attributeValue: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        })
      : [];

    const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

    const productIds = itemsRaw.map((it: any) => it.productId).filter(Boolean);
    const dbProducts = productIds.length && this.prisma.product
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            slug: true,
          },
        })
      : [];
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    const items: InvoiceItemSnapshot[] = itemsRaw.map((item: any) => {
      const quantity = Number(item.quantity) || 1;
      const discount = item.discount !== undefined ? Number(item.discount) : 0;
      const totalAmount = Number(item.totalAmount) || 0;

      // If the stored unitPrice is already net of discounts, reconstruct the original rate
      let unitPrice = Number(item.unitPrice) || 0;
      const taxableAmount =
        Number(item.taxableAmount) || unitPrice * quantity - discount;

      if (
        discount > 0 &&
        Math.abs(taxableAmount - unitPrice * quantity) < 0.01
      ) {
        unitPrice = unitPrice + discount / quantity;
      }

      const dbVariant = item.variantId ? variantMap.get(item.variantId) : null;

      const attributeValueTitle = dbVariant
        ? dbVariant.attributes
            ?.map((a: any) => a.attributeValue?.title?.trim())
            .filter(Boolean)
            .join(' | ') || dbVariant.attributeSummary
        : undefined;

      // Resolve SKU and variantName with order fallback
      const orderItem = hydrated.order?.items?.find(
        (oi: any) =>
          oi.productId === item.productId && oi.variantId === item.variantId,
      );

      const dbProduct = item.productId ? productMap.get(item.productId) : null;
      const productSlug = dbProduct?.slug || '';
      const sku = item.sku || orderItem?.sku || dbVariant?.sku || productSlug || '';
      const variantName =
        attributeValueTitle ||
        item.variantName ||
        orderItem?.variantName ||
        undefined;
      let gstRate = Number(item.gstRate) || 0;
      if (!gstRate || gstRate === 0) {
        gstRate =
          Number(dbVariant?.gstTax) || Number(orderItem?.gstPercent) || 18;
      }

      return {
        productId: item.productId || '',
        variantId: item.variantId || undefined,
        title: item.title || item.productName || 'Product',
        variantName,
        sku,
        hsnCode: item.hsnCode || undefined,
        quantity,
        unitPrice,
        discount,
        taxableAmount,
        gstRate,
        totalAmount,
      };
    });

    const mapAddress = (
      addr: any,
      isSeller = false,
    ): AddressSnapshot | undefined => {
      if (!addr) return undefined;
      return {
        fullName: addr.fullName || undefined,
        phone: addr.phone || undefined,
        addressLine1: addr.addressLine1 || '',
        addressLine2: addr.addressLine2 || undefined,
        city: addr.city || '',
        state: addr.state || (isSeller ? 'Chhattisgarh' : ''),
        country: addr.country || 'India',
        zipCode: addr.zipCode || addr.postalCode || '',
        landmark: addr.landmark || undefined,
      };
    };

    const grandTotal = Number(hydrated.grandTotal) || 0;
    const discountAmount = Number(hydrated.discountAmount) || 0;
    const shippingFee = Number(hydrated.shippingFee) || 0;
    const platformFee = Number(hydrated.platformFee) || 0;

    // Resolve payment status, method, and transaction references with fallbacks to the order if missing on the invoice
    const resolvedPaymentMode =
      hydrated.stockRequest?.paymentMode ||
      hydrated.shipmentPaymentMode ||
      (hydrated.order?.paymentMode === 'COD'
        ? 'COD'
        : hydrated.order?.paymentMode
          ? 'PREPAID'
          : undefined);

    const resolvedPaymentStatus =
      hydrated.paymentStatus === 'PAID' ||
      hydrated.order?.onlinePaymentStatus === 'PAID' ||
      ['CASH', 'CARD', 'UPI', 'QR', 'NETBANKING'].includes(
        hydrated.order?.paymentMode,
      ) ||
      hydrated.stockRequest?.paymentStatus === 'PAID' ||
      hydrated.stockRequest?.paymentStatus === 'WAIVED' ||
      hydrated.stockRequest?.isFullyPaid
        ? 'PAID'
        : hydrated.paymentStatus || 'PENDING';

    const resolvedPaymentReferenceId =
      hydrated.paymentReferenceId ||
      hydrated.order?.paymentReference ||
      hydrated.stockRequest?.paymentReference ||
      undefined;

    // Calculate dynamic/consistent GST and Subtotal
    const calculatedGst = items.reduce(
      (sum, item) => sum + (item.taxableAmount * (item.gstRate || 0)) / 100,
      0,
    );
    const finalGst = Number(hydrated.gst) || calculatedGst;
    const subtotal =
      grandTotal + discountAmount - shippingFee - platformFee - finalGst;

    const getNonEmptyState = (addr: any): string | undefined => {
      if (!addr) return undefined;
      const s = addr.state;
      return typeof s === 'string' && s.trim() ? s.trim() : undefined;
    };

    let isInterState = true; // Default to true (Admin / POS)
    if (
      hydrated.order &&
      hydrated.order.channel !== 'POS' &&
      !hydrated.invoiceNumber.startsWith('POS-')
    ) {
      // Online case: check buyer and franchise state
      const cleanState = (s?: string | null): string =>
        s
          ? s
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]/g, '')
          : '';
      const sellerState =
        getNonEmptyState(hydrated.pickupAddress) ||
        getNonEmptyState(hydrated.order.franchise) ||
        'Chhattisgarh';
      const buyerState =
        getNonEmptyState(hydrated.shippingAddress) ||
        getNonEmptyState(hydrated.billingAddress) ||
        'N/A';
      isInterState = cleanState(sellerState) !== cleanState(buyerState);
    } else if (hydrated.stockRequest) {
      const cleanState = (s?: string | null): string =>
        s
          ? s
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]/g, '')
          : '';
      const sellerState =
        getNonEmptyState(hydrated.pickupAddress) || 'Chhattisgarh';
      const buyerState =
        getNonEmptyState(hydrated.shippingAddress) ||
        getNonEmptyState(hydrated.billingAddress) ||
        'N/A';
      isInterState = cleanState(sellerState) !== cleanState(buyerState);
    }

    return {
      invoiceNumber: hydrated.invoiceNumber,
      type: hydrated.type,
      status: hydrated.status,
      issuedAt: hydrated.issuedAt,
      orderDate: hydrated.order_date || hydrated.issuedAt,
      buyerName: hydrated.buyerName || undefined,
      buyerPhone: hydrated.buyerPhone || undefined,
      buyerEmail: hydrated.buyerEmail || undefined,
      storeName: hydrated.storeName || undefined,
      billingAddress: mapAddress(hydrated.billingAddress),
      shippingAddress: mapAddress(hydrated.shippingAddress),
      pickupAddress: mapAddress(hydrated.pickupAddress, true),
      items,
      subtotal,
      discountAmount,
      shippingFee,
      platformFee,
      gst: finalGst,
      grandTotal,
      shipmentPaymentMode: resolvedPaymentMode,
      paymentStatus: resolvedPaymentStatus,
      paymentReferenceId: resolvedPaymentReferenceId,
      paidAt: hydrated.order?.paidAt || hydrated.stockRequest?.paymentReceivedAt || undefined,
      shipmentProvider: hydrated.shipmentProvider || undefined,
      shipmentOrderId:
        hydrated.shipmentOrderId || hydrated.order?.orderNumber || undefined,
      shipmentId: hydrated.shipmentId || undefined,
      courierName: hydrated.courierName || undefined,
      awb: hydrated.awb || undefined,
      trackingUrl: hydrated.trackingUrl || undefined,
      sellerGstin: hydrated.sellerGstin || undefined,
      buyerGstin: hydrated.buyerGstin || undefined,
      placeOfSupply: hydrated.placeOfSupply || undefined,
      isInterState,
    };
  }
}
