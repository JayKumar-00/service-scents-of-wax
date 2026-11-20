import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProcurementDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [openPos, pendingApprovals, pendingGrns, supplierCount] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { status: 'APPROVED' } }),
      this.prisma.purchaseOrder.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.goodsReceiptNote.count({ where: { status: 'DRAFT' } }),
      this.prisma.supplier.count(),
    ]);

    return {
      openPos,
      pendingApprovals,
      pendingGrns,
      supplierCount,
    };
  }
}
