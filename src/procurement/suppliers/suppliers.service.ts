import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { paginatePrisma, buildSearchFilter } from '../../common/utils/pagination.util';
import { OrderType } from '../../common/dto/query.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateSupplierDto) {
    const code = dto.code || `SUPP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const supplier = await this.prisma.supplier.create({
      data: {
        code,
        name: dto.name,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        gstNumber: dto.gstNumber,
        panNumber: dto.panNumber,
        address: dto.address,
        paymentTerms: dto.paymentTerms,
        bankDetails: dto.bankDetails,
        notes: dto.notes,
        status: dto.status ?? 'ACTIVE',
      },
    });

    await this.audit.log({
      userId: 'system',
      action: 'CREATE_SUPPLIER',
      resource: 'Supplier',
      resourceId: supplier.id,
      metadata: { code: supplier.code, name: supplier.name },
    });

    return supplier;
  }

  async list(query: SupplierQueryDto) {
    const clauses: Record<string, any>[] = [];

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.search) {
      const searchFilter = buildSearchFilter(query.search, [
        'code',
        'name',
        'contactPerson',
        'email',
        'phone',
      ]);
      if (Object.keys(searchFilter).length > 0) {
        clauses.push(searchFilter);
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const allowedSortFields = ['createdAt', 'updatedAt', 'code', 'name', 'status'];
    const sortField = allowedSortFields.includes(query.sortBy || '')
      ? (query.sortBy as string)
      : 'createdAt';
    const direction = query.order || OrderType.DESC;
    const orderBy: Record<string, OrderType> = { [sortField]: direction };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const paged = await paginatePrisma<any>({
      model: this.prisma.supplier as any,
      where,
      orderBy,
      page,
      limit,
    });

    return {
      data: paged.data || [],
      meta: paged.meta,
    };
  }


  async get(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        gstNumber: dto.gstNumber,
        panNumber: dto.panNumber,
        address: dto.address,
        paymentTerms: dto.paymentTerms,
        bankDetails: dto.bankDetails,
        notes: dto.notes,
        status: dto.status,
      },
    });

    await this.audit.log({
      userId: 'system',
      action: 'UPDATE_SUPPLIER',
      resource: 'Supplier',
      resourceId: supplier.id,
      metadata: { code: supplier.code },
    });

    return supplier;
  }

  async toggleStatus(id: string) {
    const supplier = await this.get(id);
    const newStatus = supplier.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { status: newStatus },
    });

    await this.audit.log({
      userId: 'system',
      action: 'TOGGLE_SUPPLIER_STATUS',
      resource: 'Supplier',
      resourceId: updated.id,
      metadata: { code: updated.code, oldStatus: supplier.status, newStatus: updated.status },
    });

    return updated;
  }
}

