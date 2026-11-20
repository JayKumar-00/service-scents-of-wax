import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service'; // Adjust path if needed
import { AuditService } from '../../audit/audit.service';
import { CustomerStatus, OrderStatus, Prisma } from '@prisma/client';
import { CustomerQueryDto, CustomerType } from './dto/customer-query.dto';

@Injectable()
export class AdminCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listCustomer(query: CustomerQueryDto) {
    const {
      customerType = CustomerType.ONLINE_CUSTOMER,
      search,
      fromDate,
      lastDate,
      order,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;
    const take = limit;
    const orderBy = { createdAt: (order || 'desc') as Prisma.SortOrder };

    // Overall period order date filter
    const dateFilter =
      fromDate || lastDate
        ? {
            ...(fromDate && { gte: new Date(fromDate) }),
            ...(lastDate && { lte: new Date(lastDate) }),
          }
        : undefined;

    if (customerType === CustomerType.RETAIL_CUSTOMER) {
      const where: Prisma.RetailCustomerWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNorm: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (dateFilter) {
        where.createdAt = dateFilter;
      }

      const [rawData, total, orderStats] = await Promise.all([
        this.prisma.retailCustomer.findMany({
          where,
          skip,
          take,
          orderBy,
          include: {
            orders: {
              where: dateFilter ? { createdAt: dateFilter } : undefined,
              select: { status: true },
            },
          },
        }),
        this.prisma.retailCustomer.count({ where }),
        this.prisma.order.groupBy({
          by: ['status'],
          where: {
            retailCustomer: where,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          _count: { _all: true },
        }),
      ]);

      const data = rawData.map((customer) => {
        const custOrderCount = customer.orders.length;
        let custOrderDeliveredCount = 0;
        let custOrderCancelCount = 0;

        customer.orders.forEach((o) => {
          if (o.status === OrderStatus.DELIVERED) custOrderDeliveredCount++;
          if (o.status === OrderStatus.CANCELLED) custOrderCancelCount++;
        });

        const { orders, ...rest } = customer;
        return {
          ...rest,
          orderCount: custOrderCount,
          orderDeliveredCount: custOrderDeliveredCount,
          orderCancelCount: custOrderCancelCount,
        };
      });

      let orderCount = 0;
      let orderDeliveredCount = 0;
      let orderCancelCount = 0;

      orderStats.forEach((stat) => {
        orderCount += stat._count._all;
        if (stat.status === OrderStatus.DELIVERED)
          orderDeliveredCount += stat._count._all;
        if (stat.status === OrderStatus.CANCELLED)
          orderCancelCount += stat._count._all;
      });

      return {
        data,
        meta: {
          total,
          page,
          limit: take,
          lastPage: Math.ceil(total / take),
          orderCount,
          orderDeliveredCount,
          orderCancelCount,
        },
      };
    } else {
      const where: Prisma.CustomerWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (dateFilter) {
        where.createdAt = dateFilter;
      }

      const [rawData, total, orderStats] = await Promise.all([
        this.prisma.customer.findMany({
          where,
          skip,
          take,
          orderBy,
          include: {
            user: { select: { email: true, isActive: true } },
            orders: {
              where: dateFilter ? { createdAt: dateFilter } : undefined,
              select: { status: true },
            },
          },
        }),
        this.prisma.customer.count({ where }),
        this.prisma.order.groupBy({
          by: ['status'],
          where: {
            customer: where,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          _count: { _all: true },
        }),
      ]);

      const data = rawData.map((customer) => {
        const custOrderCount = customer.orders.length;
        let custOrderDeliveredCount = 0;
        let custOrderCancelCount = 0;

        customer.orders.forEach((o) => {
          if (o.status === OrderStatus.DELIVERED) custOrderDeliveredCount++;
          if (o.status === OrderStatus.CANCELLED) custOrderCancelCount++;
        });

        const { orders, ...rest } = customer;
        return {
          ...rest,
          orderCount: custOrderCount,
          orderDeliveredCount: custOrderDeliveredCount,
          orderCancelCount: custOrderCancelCount,
        };
      });

      let orderCount = 0;
      let orderDeliveredCount = 0;
      let orderCancelCount = 0;

      orderStats.forEach((stat) => {
        orderCount += stat._count._all;
        if (stat.status === OrderStatus.DELIVERED)
          orderDeliveredCount += stat._count._all;
        if (stat.status === OrderStatus.CANCELLED)
          orderCancelCount += stat._count._all;
      });

      return {
        data,
        meta: {
          total,
          page,
          limit: take,
          lastPage: Math.ceil(total / take),
          orderCount,
          orderDeliveredCount,
          orderCancelCount,
        },
      };
    }
  }

  async getByCustomerId(id: string, customerType?: CustomerType) {
    if (customerType === CustomerType.RETAIL_CUSTOMER) {
      const customer = await this.prisma.retailCustomer.findUnique({
        where: { id },
        include: { franchise: true },
      });
      if (!customer) throw new NotFoundException('Retail customer not found');
      return customer;
    } else {
      const customer = await this.prisma.customer.findUnique({
        where: { id },
        include: { addresses: true, user: true },
      });
      if (!customer) throw new NotFoundException('Online customer not found');
      return customer;
    }
  }

  async toSetStatus(
    id: string,
    status: CustomerStatus,
    actor?: { userId: string; ip?: string | null },
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Online customer not found');
    const updated = await this.prisma.customer.update({
      where: { id },
      data: { status },
    });
    if (actor) {
      try {
        await this.audit.log({
          userId: actor.userId,
          action: 'customer.status_update',
          resource: 'Customer',
          resourceId: id,
          metadata: { oldStatus: customer.status, newStatus: status },
          ip: actor.ip,
        });
      } catch (err) {
        // Ignore or log
      }
    }
    return updated;
  }
}
