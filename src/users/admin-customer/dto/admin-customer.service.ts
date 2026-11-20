import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service'; // Adjust path if needed
import { CustomerStatus, Prisma } from '@prisma/client';
import { CustomerQueryDto, CustomerType } from './customer-query.dto';

@Injectable()
export class AdminCustomerService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (customerType === CustomerType.RETAIL_CUSTOMER) {
      const where: Prisma.RetailCustomerWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNorm: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (fromDate || lastDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (lastDate) where.createdAt.lte = new Date(lastDate);
      }

      const [data, total] = await Promise.all([
        this.prisma.retailCustomer.findMany({ where, skip, take, orderBy }),
        this.prisma.retailCustomer.count({ where }),
      ]);

      return {
        data,
        meta: { total, page, limit: take, lastPage: Math.ceil(total / take) },
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
      if (fromDate || lastDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (lastDate) where.createdAt.lte = new Date(lastDate);
      }

      const [data, total] = await Promise.all([
        this.prisma.customer.findMany({
          where,
          skip,
          take,
          orderBy,
          include: { user: { select: { email: true, isActive: true } } },
        }),
        this.prisma.customer.count({ where }),
      ]);

      return {
        data,
        meta: { total, page, limit: take, lastPage: Math.ceil(total / take) },
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

  async toSetStatus(id: string, status: CustomerStatus) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Online customer not found');
    return this.prisma.customer.update({ where: { id }, data: { status } });
  }
}
