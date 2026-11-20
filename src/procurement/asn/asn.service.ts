import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateAsnDto } from './dto/create-asn.dto';
import { AsnQueryDto } from './dto/asn-query.dto';
import { SubmitAsnDto } from './dto/submit-asn.dto';
import { paginatePrisma, buildSearchFilter } from '../../common/utils/pagination.util';
import { OrderType } from '../../common/dto/query.dto';
import { AsnStatus } from '@prisma/client';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@Injectable()
export class AsnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) { }

  async create(dto: CreateAsnDto, user?: JwtUser) {
    // create ASN header and lines in a transaction to avoid loose records
    const result = await this.prisma.$transaction(async (tx) => {
      const asnNumber = dto.asnNumber || `ASN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const asn = await tx.asn.create({
        data: {
          asnNumber,
          purchaseOrderId: dto.purchaseOrderId,
          supplierId: dto.supplierId,
          supplierInvoiceNo: dto.supplierInvoiceNo,
          vehicleNumber: dto.vehicleNumber,
          courier: dto.courier,
          trackingNumber: dto.trackingNumber,
          expectedArrival: dto.expectedArrival ? new Date(dto.expectedArrival) : null,
          shipmentNote: dto.shipmentNote,
          status: 'DRAFT',
        },
      });

      if (dto.lines?.length) {
        const resolvedLines = await Promise.all(
          dto.lines.map(async (l) => {
            let poLineId = l.purchaseOrderLineId;
            if (!poLineId && dto.purchaseOrderId) {
              const poLine = await tx.purchaseOrderLine.findFirst({
                where: {
                  purchaseOrderId: dto.purchaseOrderId,
                  productId: l.productId,
                  variantId: l.variantId || null,
                },
                select: { id: true },
              });
              if (poLine) {
                poLineId = poLine.id;
              }
            }
            return {
              asnId: asn.id,
              purchaseOrderLineId: poLineId || null,
              productId: l.productId,
              variantId: l.variantId || null,
              expectedQty: l.expectedQty ?? 0,
            };
          })
        );

        await tx.asnLine.createMany({
          data: resolvedLines,
        });
      }

      const created = await tx.asn.findUnique({ where: { id: asn.id }, include: { lines: true } });

      await this.audit.log({
        userId: user?.sub || 'system',
        action: 'CREATE_ASN',
        resource: 'Asn',
        resourceId: asn.id,
        metadata: { asnNumber: asn.asnNumber },
      });

      return created;
    });

    return result;
  }

  async list(query: AsnQueryDto) {
    const clauses: Record<string, any>[] = [];

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.supplierId) {
      clauses.push({ supplierId: query.supplierId });
    }

    if (query.purchaseOrderId) {
      clauses.push({ purchaseOrderId: query.purchaseOrderId });
    }

    if (query.search) {
      const searchFilter = buildSearchFilter(query.search, [
        'asnNumber',
        'courier',
        'vehicleNumber',
        'trackingNumber',
        'purchaseOrder.poNumber',
        'supplier.name',
      ]);
      if (Object.keys(searchFilter).length > 0) {
        clauses.push(searchFilter);
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const allowedSortFields = ['createdAt', 'asnNumber', 'status', 'expectedArrival'];
    const sortField = allowedSortFields.includes(query.sortBy || '')
      ? (query.sortBy as string)
      : 'createdAt';
    const direction = query.order || OrderType.DESC;
    const orderBy: Record<string, OrderType> = { [sortField]: direction };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const paged = await paginatePrisma<any>({
      model: this.prisma.asn as any,
      where,
      orderBy,
      page,
      limit,
      include: { purchaseOrder: true, supplier: true, lines: true },
    });

    return {
      data: paged.data || [],
      meta: paged.meta,
    };
  }

  async get(id: string) {
    const asn = await this.prisma.asn.findUnique({ where: { id } });
    if (!asn) {
      throw new NotFoundException('ASN not found');
    }
    return asn;
  }

  async submit(id: string, dto: SubmitAsnDto, userId: string = 'system') {
    const asn = await this.prisma.asn.update({
      where: { id },
      data: {
        status: AsnStatus.SUBMITTED,
        supplierInvoiceNo: dto.supplierInvoiceNo,
        vehicleNumber: dto.vehicleNumber,
        courier: dto.courier,
        trackingNumber: dto.trackingNumber,
        expectedArrival: dto.expectedArrival ? new Date(dto.expectedArrival) : undefined,
        shipmentNote: dto.shipmentNote,
      },
    });

    await this.audit.log({
      userId,
      action: 'SUBMIT_ASN',
      resource: 'Asn',
      resourceId: asn.id,
      metadata: { asnNumber: asn.asnNumber },
    });

    return asn;
  }

  async updateStatus(id: string, status: AsnStatus, userId: string = 'system') {
    const asn = await this.prisma.asn.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_ASN_STATUS',
      resource: 'Asn',
      resourceId: asn.id,
      metadata: { status: asn.status },
    });

    return asn;
  }
}
