import {
  Inject,
  Injectable,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { LocationService } from 'src/geo/location.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePosSaleDto } from './dto/create-pos-sale.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { CreateOrderFromCartDto } from './controllers/dto/allocate-cart-order.dto';
import { OrderAllocationService } from 'src/order-allocation/services/order-allocation.service';
import { OrderQueryService } from './services/order-query.service';
import { OrderPaymentService } from './services/order-payment.service';
import { OrderPosService } from './services/order-pos.service';
import { OrderCartService } from './services/order-cart.service';
import { OrderStatusService } from './services/order-status.service';
import { FranchiseStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewFranchisesDto } from './dto/preview-franchises.dto';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(forwardRef(() => OrderAllocationService))
    private readonly orderAllocationService: OrderAllocationService,
    private readonly orderQueryService: OrderQueryService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly orderPosService: OrderPosService,
    private readonly orderCartService: OrderCartService,
    private readonly orderStatusService: OrderStatusService,
    private readonly prisma: PrismaService,
    private readonly locationService: LocationService,
  ) {}

  async previewNearestFranchises(dto: PreviewFranchisesDto) {
    const { latitude, longitude, pincode, range, cartId, productId, quantity } =
      dto;
    const defaultRange = Number(process.env.MAX_DELIVERY_RADIUS_KM) || 25;
    const maxRange = range ?? defaultRange;

    let lat = latitude;
    let lon = longitude;

    if (lat == null || lon == null) {
      if (!pincode) {
        throw new BadRequestException(
          'Either coordinates (latitude, longitude) or pincode is required',
        );
      }
      try {
        const geoResult = await this.locationService.geocode(pincode);
        lat = geoResult.lat;
        lon = geoResult.lng;
      } catch (err: any) {
        throw new BadRequestException(
          `Failed to resolve coordinates for pincode ${pincode}: ${err.message}`,
        );
      }
    }

    const franchises = await this.prisma.franchise.findMany({
      where: {
        status: FranchiseStatus.ACTIVE,
        code: { notIn: ['CENTRAL_WAREHOUSE', 'ADMIN-HQ'] },
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        latitude: true,
        longitude: true,
        acceptingOrders: true,
        addressLine1: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    });

    const calculated = franchises
      .map((f) => {
        const dist = this.haversineDistanceKm(
          lat!,
          lon!,
          f.latitude,
          f.longitude,
        );
        return {
          ...f,
          distanceKm: Number(dist.toFixed(2)),
        };
      })
      .filter((f) => f.distanceKm <= maxRange)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const nearestFive = calculated.slice(0, 5);

    const checkedItems: Array<{
      productId: string;
      quantity: number;
      productName: string;
    }> = [];

    if (cartId) {
      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        select: {
          items: {
            select: {
              productId: true,
              quantity: true,
            },
          },
        },
      });
      if (cart && cart.items && cart.items.length > 0) {
        const productIds = cart.items.map((i) => i.productId);
        const products = await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p.name]));

        for (const item of cart.items) {
          checkedItems.push({
            productId: item.productId,
            quantity: item.quantity,
            productName: productMap.get(item.productId) ?? 'Unknown Product',
          });
        }
      }
    } else if (productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { name: true },
      });
      checkedItems.push({
        productId,
        quantity: quantity ?? 1,
        productName: product?.name ?? 'Unknown Product',
      });
    }

    if (checkedItems.length === 0) {
      return nearestFive;
    }

    const enriched = await Promise.all(
      nearestFive.map(async (f) => {
        const stocks = await this.prisma.franchiseStock.findMany({
          where: {
            franchiseId: f.id,
            productId: { in: checkedItems.map((i) => i.productId) },
          },
        });
        const stockMap = new Map(
          stocks.map((s) => [s.productId, s.quantity - s.reserved]),
        );

        const itemsFulfillment = checkedItems.map((item) => {
          const availableStock = stockMap.get(item.productId) ?? 0;
          return {
            productId: item.productId,
            productName: item.productName,
            requestedQuantity: item.quantity,
            availableStock: Math.max(0, availableStock),
            isFulfilled: availableStock >= item.quantity,
          };
        });

        const isFullyFulfilled = itemsFulfillment.every(
          (item) => item.isFulfilled,
        );

        return {
          ...f,
          fulfillment: {
            isFullyFulfilled,
            items: itemsFulfillment,
          },
        };
      }),
    );

    return enriched;
  }

  private haversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  create(dto: CreateOrderDto, user: JwtUser) {
    return this.orderAllocationService.createOrderRequest(dto, user);
  }

  getById(orderId: string, user: JwtUser) {
    return this.orderQueryService.getById(orderId, user);
  }

  listForUser(user: JwtUser, query: OrderQueryDto) {
    return this.orderQueryService.listForUser(user, query);
  }

  invoiceHtml(orderId: string, user: JwtUser): Promise<string> {
    return this.orderQueryService.invoiceHtml(orderId, user);
  }

  upsertInvoice(user: JwtUser, orderNumber: string) {
    return this.orderQueryService.upsertInvoice(user, orderNumber);
  }

  payOnline(orderId: string, user: JwtUser, dto: PayOrderDto) {
    return this.orderPaymentService.payOnline(orderId, user, dto);
  }

  markOrderPaidManual(orderId: string, user: JwtUser) {
    return this.orderPaymentService.markOrderPaidManual(orderId, user);
  }

  cancelOnlineUnpaid(orderId: string, user: JwtUser) {
    return this.orderPaymentService.cancelOnlineUnpaid(orderId, user);
  }

  createPosSale(dto: CreatePosSaleDto, user: JwtUser, ip?: string | null) {
    return this.orderPosService.createPosSale(dto, user, ip);
  }

  updateStatus(
    orderId: string,
    status: OrderStatus,
    user: JwtUser,
    ip?: string,
  ) {
    return this.orderStatusService.updateStatus(orderId, status, user, ip);
  }

  markOrderPaid(
    tx: Prisma.TransactionClient,
    orderId: string,
    paymentId: string,
  ) {
    return this.orderPaymentService.markOrderPaid(tx, orderId, paymentId);
  }

  generateInvoiceForOrderId(orderId: string) {
    return this.orderPaymentService.generateInvoiceForOrderId(orderId);
  }

  sendOrderConfirmationEmail(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    amount: number,
  ) {
    return this.orderPaymentService.sendOrderConfirmationEmail(
      customerEmail,
      customerName,
      orderNumber,
      amount,
    );
  }

  notifyPaymentFailure(
    superAdminEmail: string,
    franchiseEmail: string,
    franchiseName: string,
    orderNumber: string,
    amount: number,
    errorReason: string,
  ) {
    return this.orderPaymentService.notifyPaymentFailure(
      superAdminEmail,
      franchiseEmail,
      franchiseName,
      orderNumber,
      amount,
      errorReason,
    );
  }

  createFromCart(cartId: string, user: JwtUser, dto: CreateOrderFromCartDto) {
    return this.orderCartService.createFromCart(cartId, user, dto);
  }
}
