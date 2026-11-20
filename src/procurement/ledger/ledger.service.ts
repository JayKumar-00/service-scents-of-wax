import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: any) {
    return this._fetchLedger(query);
  }

  async listForFranchise(franchiseId: string, query: any) {
    return this._fetchLedger({ ...query, franchiseId });
  }

  private async _fetchLedger(query: any) {
    const { referenceType, search, page = 1, limit = 10, franchiseId } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    if (franchiseId) {
      where.warehouseNode = { franchiseId };
    }
    if (referenceType) {
      where.referenceType = referenceType;
    }
    if (search) {
      where.OR = [
        { referenceId: { contains: search, mode: 'insensitive' } },
        { referenceType: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryLedgerEntry.findMany({
        where,
        include: {
          product: true,
          variant: true,
          grn: true,
          warehouseNode: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.inventoryLedgerEntry.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async listSupplierLedger(query: any) {
    const { page = 1, limit = 10, supplierId, purchaseOrderId, search, status } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    if (supplierId) {
      where.id = supplierId;
    }

    const poWhere: any = {};
    if (purchaseOrderId) poWhere.id = purchaseOrderId;
    if (status) poWhere.status = status;
    if (search) {
      poWhere.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (Object.keys(poWhere).length > 0) {
      where.purchaseOrders = { some: poWhere };
    }

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take,
        include: {
          purchaseOrders: {
            where: Object.keys(poWhere).length > 0 ? poWhere : undefined,
            include: {
              lines: { include: { product: true, variant: true } },
              asns: true,
              grns: { include: { qualityInspections: true } },
              // qc is usually related to grn or asn in this schema
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    const data = suppliers.map((supplier: any) => {
      // Calculate overall amounts from purchase orders
      const overallPayments = supplier.purchaseOrders.reduce((sum: number, po: any) => sum + (Number(po.totalAmount) || 0), 0);
      
      return {
        ...supplier,
        overallPayments,
        pendingAmount: 0, // Pending calculation logic depends on payment tracking model
        purchaseOrders: supplier.purchaseOrders,
      };
    });

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    };
  }

  async listFranchiseLedger(query: any, userFranchiseId?: string) {
    const { page = 1, limit = 10, franchiseId, stockRequestId, search, status, paymentStatus, type, fromDate, lastDate, order } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // If a specific franchise user calls this, force the franchiseId to theirs
    const targetFranchiseId = userFranchiseId || franchiseId;

    if (targetFranchiseId) {
      const franchise = await this.prisma.franchise.findUnique({
        where: { id: targetFranchiseId },
      });

      if (!franchise) {
        throw new NotFoundException(`Franchise with ID ${targetFranchiseId} not found`);
      }

      // Build stock requests filter for this specific franchise
      const stockRequestWhere: any = {
        franchiseId: targetFranchiseId,
      };

      if (stockRequestId) {
        stockRequestWhere.id = stockRequestId;
      }

      if (status) {
        stockRequestWhere.status = status;
      }

      if (paymentStatus) {
        stockRequestWhere.paymentStatus = paymentStatus;
      }

      if (type) {
        stockRequestWhere.type = type;
      }

      if (fromDate || lastDate) {
        stockRequestWhere.createdAt = {};
        if (fromDate) stockRequestWhere.createdAt.gte = new Date(fromDate);
        if (lastDate) stockRequestWhere.createdAt.lte = new Date(lastDate);
      }

      if (search) {
        stockRequestWhere.OR = [
          { id: { contains: search, mode: 'insensitive' } },
          { note: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { variant: { title: { contains: search, mode: 'insensitive' } } },
          { variant: { sku: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const sortOrder: 'asc' | 'desc' = order && String(order).toLowerCase() === 'asc' ? 'asc' : 'desc';

      const [stockRequests, total, allStockRequests] = await Promise.all([
        this.prisma.stockRequest.findMany({
          where: stockRequestWhere,
          skip,
          take,
          include: {
            product: true,
            variant: true,
            deliveries: true,
            returns: true,
            returnRequestsV2: true,
          },
          orderBy: { createdAt: sortOrder },
        }),
        this.prisma.stockRequest.count({ where: stockRequestWhere }),
        this.prisma.stockRequest.findMany({
          where: { franchiseId: targetFranchiseId },
          select: { billingTotal: true },
        }),
      ]);

      const overallPayments = allStockRequests.reduce((sum, req) => sum + (Number(req.billingTotal) || 0), 0);

      return {
        franchise: {
          ...franchise,
          overallPayments,
          pendingAmount: 0,
        },
        data: stockRequests,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)) || 1,
        },
      };
    }

    // Default: Multi-franchise overview when targetFranchiseId is not provided
    const where: any = {};
    const stockRequestSubWhere: any = {};
    if (stockRequestId) stockRequestSubWhere.id = stockRequestId;
    if (status) stockRequestSubWhere.status = status;
    if (paymentStatus) stockRequestSubWhere.paymentStatus = paymentStatus;
    if (type) stockRequestSubWhere.type = type;

    if (Object.keys(stockRequestSubWhere).length > 0) {
      where.stockRequests = { some: stockRequestSubWhere };
    }

    const [franchises, total] = await Promise.all([
      this.prisma.franchise.findMany({
        where,
        skip,
        take,
        include: {
          stockRequests: {
            where: Object.keys(stockRequestSubWhere).length > 0 ? stockRequestSubWhere : undefined,
            include: {
              product: true,
              variant: true,
              deliveries: true,
              returns: true,
              returnRequestsV2: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.franchise.count({ where }),
    ]);

    const data = franchises.map((franchiseItem) => {
      const overallPayments = franchiseItem.stockRequests.reduce((sum, req) => sum + (Number(req.billingTotal) || 0), 0);
      
      return {
        ...franchiseItem,
        overallPayments,
        pendingAmount: 0,
        stockRequests: franchiseItem.stockRequests,
      };
    });

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    };
  }
}
