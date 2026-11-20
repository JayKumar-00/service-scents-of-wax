import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderChannel,
  OnlinePaymentStatus,
  Prisma,
  Role,
  PaymentModeEnum,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import { franchiseHasReadAccess } from '../common/franchise-roles';
import { RetailCustomerQueryDto } from './dto/retail-customer-query.dto';
import { RetailCustomerPaymentDto } from './dto/retail-customer-payment.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { OrderType } from 'src/common/dto/query.dto';
import { buildPrismaDateRangeFilter } from 'src/products/utils/range-filter.util';
import { OrderStockService } from 'src/orders/services/order-stock.service';

@Injectable()
export class RetailCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderStockService: OrderStockService,
  ) { }

  private buildRetailCustomerSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> => buildSortOrder(sortBy, order, ['createdAt']);

  async list(user: JwtUser, query: RetailCustomerQueryDto) {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    if (q.search) {
      const digits = q.search.replace(/\D/g, '');

      const or: Prisma.RetailCustomerWhereInput[] = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];

      if (digits.length >= 3) {
        or.push({
          phoneNorm: { contains: digits },
        });
      }

      clauses.push({ OR: or });
    }

    if (query.franchiseId !== null && query.franchiseId !== undefined) {
      clauses.push({
        franchise: { id: query.franchiseId },
      });
    }

    if (query.franchiseCode !== null && query.franchiseCode !== undefined) {
      clauses.push({
        franchise: {
          code: q.franchiseCode.trim().toUpperCase(),
        },
      });
    }

    if (query.gstin !== null && query.gstin !== undefined) {
      clauses.push({
        gstin: { contains: q.gstin, mode: 'insensitive' },
      });
    }

    if (query.billingStreet !== null && query.billingStreet !== undefined) {
      clauses.push({
        billingStreet: { contains: q.billingStreet, mode: 'insensitive' },
      });
    }

    if (query.billingCity !== null && query.billingCity !== undefined) {
      clauses.push({
        billingCity: { contains: q.billingCity, mode: 'insensitive' },
      });
    }

    if (query.fromDate || query.lastDate) {
      const createdAt = buildPrismaDateRangeFilter({
        fromDate: q.fromDate,
        toDate: q.lastDate,
      });
      if (createdAt) {
        clauses.push({ createdAt });
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildRetailCustomerSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.retailCustomer as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        franchise: {
          select: { id: true, name: true, code: true, city: true },
        },
        _count: { select: { orders: true } },
      },
    });

    // paged.data = paged.data.map((p: any) =>
    //   this.mapProductResponse(this.applyAwsPrefixToProduct(p)),
    // );

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;
    // const andParts: Prisma.RetailCustomerWhereInput[] = [];

    // if (user.role === Role.SUPERADMIN) {
    //   if (params.franchiseId?.trim()) {
    //     andParts.push({ franchiseId: params.franchiseId.trim() });
    //   }
    // } else if (franchiseHasReadAccess(user.role)) {
    //   if (!user.franchiseId) {
    //     return [];
    //   }
    //   andParts.push({ franchiseId: user.franchiseId });
    // } else {
    //   throw new ForbiddenException();
    // }

    // const q = params.q?.trim();
    // if (q) {
    //   const digits = q.replace(/\D/g, '');
    //   const or: Prisma.RetailCustomerWhereInput[] = [
    //     { name: { contains: q, mode: 'insensitive' } },
    //   ];
    //   if (digits.length >= 2) {
    //     or.push({ phoneNorm: { contains: digits } });
    //   }
    //   andParts.push({ OR: or });
    // }

    // const where: Prisma.RetailCustomerWhereInput =
    //   andParts.length > 0 ? { AND: andParts } : {};

    // return this.prisma.retailCustomer.findMany({
    //   where,
    //   orderBy: { updatedAt: 'desc' },
    //   take: 500,
    // include: {
    //   franchise: { select: { id: true, name: true, code: true, city: true } },
    //   _count: { select: { orders: true } },
    // },
    // });
  }

  async getById(id: string, user: JwtUser) {
    const row = await this.prisma.retailCustomer.findUnique({
      where: { id },
      include: {
        franchise: { select: { id: true, name: true, code: true, city: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            items: {
              include: { product: { select: { id: true, name: true } } },
            },
            soldBy: { select: { email: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Customer not found');
    }
    if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF) {
      return row;
    }
    if (franchiseHasReadAccess(user.role)) {
      const allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      if (!allowedFranchiseId || allowedFranchiseId !== row.franchiseId) {
        throw new ForbiddenException();
      }
      return row;
    }
    throw new ForbiddenException();
  }

  async recordPayment(
    user: JwtUser,
    orderNumber: string,
    dto: RetailCustomerPaymentDto,
    ip: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        franchiseId: true,
        channel: true,
        retailCustomerId: true,
        total: true,
        paidAt: true,
        paymentMode: true,
        onlinePaymentStatus: true,
        paymentReference: true,
        paymentProvider: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user.role !== Role.SUPERADMIN) {
      const allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      if (
        !franchiseHasReadAccess(user.role) ||
        !allowedFranchiseId ||
        allowedFranchiseId !== order.franchiseId
      ) {
        throw new ForbiddenException();
      }
    }

    if (order.channel !== OrderChannel.POS) {
      throw new ForbiddenException('Only POS orders can be paid here');
    }

    if (!order.retailCustomerId) {
      throw new ForbiddenException(
        'Only retail-customer POS orders can be paid here',
      );
    }

    if (order.onlinePaymentStatus === OnlinePaymentStatus.PAID) {
      throw new ForbiddenException('Order payment already completed');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const orderWithItems = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });

      if (!orderWithItems) {
        throw new NotFoundException('Order not found');
      }

      await this.orderStockService.consumeRetailCustomerOrderStock(tx, {
        id: orderWithItems.id,
        franchiseId: orderWithItems.franchiseId,
        retailCustomerId: orderWithItems.retailCustomerId,
        items: orderWithItems.items.map(
          (line: { productId: string; quantity: number }) => ({
            productId: line.productId,
            quantity: line.quantity,
          }),
        ),
      });

      const paidAt = new Date();
      return tx.order.update({
        where: { id: order.id },
        data: {
          paymentMode: dto.paymentMode as PaymentModeEnum,
          onlinePaymentStatus: OnlinePaymentStatus.PAID,
          paidAt,
          paymentProvider: dto.paymentMode,
        },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          paidAt: true,
          paymentMode: true,
          channel: true,
        },
      });
    });

    return {
      orderNumber: updated.orderNumber,
      amount:
        updated.total instanceof Prisma.Decimal
          ? Number(updated.total.toFixed(2))
          : Number(updated.total),
      paymentMode: updated.paymentMode,
      paidAt: updated.paidAt,
      channel: updated.channel,
    };
  }
}
