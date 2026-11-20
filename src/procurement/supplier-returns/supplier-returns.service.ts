import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupplierReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.supplierReturnOrder.findMany({
      include: {
        supplier: true,
        purchaseOrder: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const returnOrder = await this.prisma.supplierReturnOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseOrder: true,
        lines: {
          include: {
            product: true,
            variant: true,
          }
        },
      },
    });

    if (!returnOrder) {
      throw new NotFoundException('Return order not found');
    }

    return returnOrder;
  }
}
