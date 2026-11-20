import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StockingNodesService } from 'src/supply-chain/stocking-nodes.service';
import { DeliveryStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFranchiseDto } from './dto/create-franchise.dto';
import { UpdateFranchiseDto } from './dto/update-franchise.dto';
import { FranchiseDocumentDto } from '../users/franchise/dto/franchise-document.dto';

@Injectable()
export class FranchisesService {
  private readonly franchiseStockProductSelect = {
    select: {
      id: true,
      name: true,
      slug: true,
      category: { select: { name: true } },
    },
  } as const;

  private readonly logger = new Logger(FranchisesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stockingNodesService: StockingNodesService,
    @InjectQueue('starter-bundle')
    private readonly starterBundleQueue: Queue,
  ) {}

  async ensureStoreStockingNode(franchise: { id: string; code: string; name: string }) {
    const existing = await this.prisma.stockingNode.findUnique({
      where: { franchiseId: franchise.id },
    });
    if (existing) {
      return existing;
    }

    const existingByCode = await this.prisma.stockingNode.findUnique({
      where: { code: `STORE-${franchise.code.toUpperCase()}` },
    });
    if (existingByCode) {
      if (existingByCode.franchiseId !== franchise.id) {
        return this.prisma.stockingNode.update({
          where: { id: existingByCode.id },
          data: { franchiseId: franchise.id },
        });
      }
      return existingByCode;
    }

    const centralNode = await this.prisma.stockingNode.findFirst({
      where: { type: 'CENTRAL_DC' },
    });

    const node = await this.prisma.stockingNode.create({
      data: {
        type: 'STORE',
        name: franchise.name,
        code: `STORE-${franchise.code.toUpperCase()}`,
        franchiseId: franchise.id,
        parentId: centralNode?.id || null,
        sortOrder: 10,
      },
    });

    return node;
  }

  private mapFranchiseDocuments(
    documents: FranchiseDocumentDto[] | undefined,
    uploadedByUserId: string,
  ) {
    return (documents ?? []).map((document) => ({
      kind: document.kind,
      title: document.title.trim(),
      fileUrl: document.fileUrl.trim(),
      uploadedByUserId,
    }));
  }

  private isMissingReservedColumn(err: unknown): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
    const missingColumns = [
      'FranchiseStock.reserved',
      'FranchiseStock.defectiveQuantity',
      'FranchiseStock.conflictQuantity',
    ];
    return (
      err.code === 'P2022' &&
      missingColumns.some((column) => String(err.message).includes(column))
    );
  }

  list() {
    return this.prisma.franchise.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { orders: true, users: true } } },
    });
  }

  async create(
    dto: CreateFranchiseDto,
    actor: { userId: string; ip?: string | null },
  ) {
    const sopTraining = dto.sopTrainingCompleted ?? false;
    const sopBranding = dto.sopBrandingCompleted ?? false;
    const sopInfra = dto.sopInfraAuditCompleted ?? false;
    const sopPos = dto.sopPosSetupCompleted ?? false;
    const sopSafety = dto.sopSafetyCompleted ?? false;
    const sopAll =
      sopTraining && sopBranding && sopInfra && sopPos && sopSafety;
    const row = await this.prisma.$transaction(async (tx) => {
      const franchise = await tx.franchise.create({
        data: {
          name: dto.name,
          code: dto.code.toUpperCase(),
          latitude: dto.latitude,
          longitude: dto.longitude,
          territory: dto.territory,
          state: dto.state ?? undefined,
          addressLine1: dto.addressLine1,
          city: dto.city,
          postalCode: dto.postalCode,
          country: dto.country ?? 'IN',
          ownerFullName: dto.ownerFullName ?? undefined,
          ownerPhone: dto.ownerPhone ?? undefined,
          ownerEmail: dto.ownerEmail ?? undefined,
          businessName: dto.businessName ?? undefined,
          gstNumber: dto.gstNumber ?? undefined,
          panNumber: dto.panNumber ?? undefined,
          kycDocumentType: dto.kycDocumentType ?? undefined,
          kycDocumentNumber: dto.kycDocumentNumber ?? undefined,
          basicDetailsCompleted: !!(
            dto.ownerFullName &&
            dto.ownerPhone &&
            dto.ownerEmail
          ),
          gstDetailsCompleted: !!(
            dto.businessName &&
            dto.gstNumber &&
            dto.panNumber
          ),
          sopTrainingCompleted: sopTraining,
          sopBrandingCompleted: sopBranding,
          sopInfraAuditCompleted: sopInfra,
          sopPosSetupCompleted: sopPos,
          sopSafetyCompleted: sopSafety,
          sopChecklistCompleted: sopAll,
          sopLastReviewedAt: sopAll ? new Date() : undefined,
          sopNote: dto.sopNote ?? undefined,
        },
      });

      const documents = this.mapFranchiseDocuments(dto.documents, actor.userId);
      if (documents.length > 0) {
        await tx.franchiseDocument.createMany({
          data: documents.map((document) => ({
            ...document,
            franchiseId: franchise.id,
          })),
        });
      }

      return tx.franchise.findUnique({
        where: { id: franchise.id },
        include: {
          documents: { orderBy: { createdAt: 'asc' } },
          _count: { select: { orders: true, users: true } },
        },
      });
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'franchise.create',
      resource: 'Franchise',
      resourceId: row?.id,
      metadata: { code: row?.code, name: row?.name },
      ip: actor.ip,
    });

    if (row) {
      try {
        await this.ensureStoreStockingNode(row);

        const defaultBundle = await this.prisma.starterBundle.findFirst({
          where: {
            status: 'ACTIVE',
            OR: [{ isDefault: true }, { autoAssignOnCreate: true }],
          },
        });

        if (defaultBundle) {
          const assignment = await this.prisma.franchiseBundleAssignment.create({
            data: {
              franchiseId: row.id,
              bundleId: defaultBundle.id,
              status: 'PENDING',
            },
          });

          await this.starterBundleQueue.add('provision-franchise-bundle', {
            assignmentId: assignment.id,
            franchiseId: row.id,
            bundleId: defaultBundle.id,
            actorUserId: actor.userId,
            ip: actor.ip,
          });
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to auto-assign starter bundle for franchise ${row.code}: ${err.message}`,
          err.stack,
        );
      }
    }

    return row;
  }

  async inventoryForFranchise(franchiseId: string | null) {
    if (!franchiseId) {
      throw new NotFoundException('No franchise linked');
    }
    const inboundPendingCount = await this.prisma.inboundDelivery.count({
      where: {
        franchiseId,
        status: { in: [DeliveryStatus.SCHEDULED, DeliveryStatus.IN_TRANSIT] },
      },
    });
    let rows: Array<{
      quantity: number;
      lowStockThreshold: number;
      reserved?: number;
      product: {
        name: string;
        slug: string;
        category: { name: string };
      };
    }> = [];
    try {
      rows = await this.prisma.franchiseStock.findMany({
        where: { franchiseId },
        orderBy: { product: { name: 'asc' } },
        include: { product: this.franchiseStockProductSelect },
      });
    } catch (err) {
      if (!this.isMissingReservedColumn(err)) throw err;
      const fallback = await this.prisma.franchiseStock.findMany({
        where: { franchiseId },
        orderBy: { product: { name: 'asc' } },
        select: {
          quantity: true,
          lowStockThreshold: true,
          product: {
            select: {
              name: true,
              slug: true,
              category: { select: { name: true } },
            },
          },
        },
      });
      rows = fallback.map((r) => ({ ...r, reserved: 0 }));
    }
    const groupedSummaryMap = new Map<string, any>();
    for (const r of rows) {
      const pId = (r as any).product?.id || (r as any).productId;
      if (!pId || !(r as any).product) continue;
      if (!groupedSummaryMap.has(pId)) {
        groupedSummaryMap.set(pId, { ...r, quantity: 0, reserved: 0 });
      }
      const item = groupedSummaryMap.get(pId);
      item.quantity += r.quantity;
      item.reserved = (item.reserved ?? 0) + (r.reserved ?? 0);
    }
    return { rows: Array.from(groupedSummaryMap.values()), inboundPendingCount };
  }

  async reorderSuggestionsForFranchise(franchiseId: string | null) {
    if (!franchiseId) {
      throw new NotFoundException('No franchise linked');
    }
    let rows: Array<{
      productId: string;
      quantity: number;
      lowStockThreshold: number;
      reserved?: number;
      product: { name: string; category: { name: string } };
    }> = [];
    try {
      rows = await this.prisma.franchiseStock.findMany({
        where: { franchiseId },
        orderBy: { product: { name: 'asc' } },
        include: { product: this.franchiseStockProductSelect },
      });
    } catch (err) {
      if (!this.isMissingReservedColumn(err)) throw err;
      const fallback = await this.prisma.franchiseStock.findMany({
        where: { franchiseId },
        orderBy: { product: { name: 'asc' } },
        select: {
          productId: true,
          quantity: true,
          lowStockThreshold: true,
          product: {
            select: { name: true, category: { select: { name: true } } },
          },
        },
      });
      rows = fallback.map((r) => ({ ...r, reserved: 0 }));
    }
    const groupedReorderMap = new Map<string, any>();
    for (const r of rows) {
      const pId = r.productId;
      if (!pId || !r.product) continue;
      if (!groupedReorderMap.has(pId)) {
        groupedReorderMap.set(pId, { ...r, quantity: 0, reserved: 0 });
      }
      const item = groupedReorderMap.get(pId);
      item.quantity += r.quantity;
      item.reserved = (item.reserved ?? 0) + (r.reserved ?? 0);
    }
    return Array.from(groupedReorderMap.values())
      .map((r) => {
        const available = Math.max(0, r.quantity - (r.reserved ?? 0));
        return { ...r, available };
      })
      .filter((r) => r.available <= r.lowStockThreshold)
      .map((r) => ({
        productId: r.productId,
        name: r.product.name,
        category: r.product.category.name,
        quantity: r.quantity,
        reserved: r.reserved ?? 0,
        available: r.available,
        lowStockThreshold: r.lowStockThreshold,
        suggestedOrderQty: Math.max(
          r.lowStockThreshold * 2 - r.available,
          r.lowStockThreshold,
        ),
      }));
  }

  async getForFranchiseUser(franchiseId: string | null) {
    if (!franchiseId) {
      throw new NotFoundException('No franchise linked to this account');
    }
    const f = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      include: { _count: { select: { orders: true, stocks: true } } },
    });
    if (!f) {
      throw new NotFoundException('Franchise not found');
    }
    return f;
  }

  async update(
    id: string,
    dto: UpdateFranchiseDto,
    actor: { userId: string; ip?: string | null },
  ) {
    const existing = await this.prisma.franchise.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Franchise not found');
    }
    const targetBasic =
      dto.basicDetailsCompleted ?? existing.basicDetailsCompleted;
    const targetGst = dto.gstDetailsCompleted ?? existing.gstDetailsCompleted;
    const targetSopTraining =
      dto.sopTrainingCompleted ?? existing.sopTrainingCompleted;
    const targetSopBranding =
      dto.sopBrandingCompleted ?? existing.sopBrandingCompleted;
    const targetSopInfra =
      dto.sopInfraAuditCompleted ?? existing.sopInfraAuditCompleted;
    const targetSopPos =
      dto.sopPosSetupCompleted ?? existing.sopPosSetupCompleted;
    const targetSopSafety =
      dto.sopSafetyCompleted ?? existing.sopSafetyCompleted;
    const computedSop =
      targetSopTraining &&
      targetSopBranding &&
      targetSopInfra &&
      targetSopPos &&
      targetSopSafety;
    const targetSop = dto.sopChecklistCompleted ?? computedSop;
    const targetKyc = dto.kycStatus ?? existing.kycStatus;
    if (
      dto.status === 'ACTIVE' &&
      !(targetBasic && targetGst && targetSop && targetKyc === 'APPROVED')
    ) {
      throw new BadRequestException(
        'Complete basic, KYC approved, GST, and SOP checklist before activation',
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.documents !== undefined) {
        await tx.franchiseDocument.deleteMany({
          where: { franchiseId: id },
        });
        const documents = this.mapFranchiseDocuments(
          dto.documents,
          actor.userId,
        );
        if (documents.length > 0) {
          await tx.franchiseDocument.createMany({
            data: documents.map((document) => ({
              ...document,
              franchiseId: id,
            })),
          });
        }
      }

      await tx.franchise.update({
        where: { id },
        data: {
          ...(dto.status === 'ACTIVE'
            ? {
                status: dto.status,
                approvedAt: new Date(),
                approvedByUserId: actor.userId,
              }
            : { status: dto.status ?? undefined }),
          kycStatus: dto.kycStatus ?? undefined,
          kycNote: dto.kycNote ?? undefined,
          kycDocumentType: dto.kycDocumentType ?? undefined,
          kycDocumentNumber: dto.kycDocumentNumber ?? undefined,
          kycVerifiedAt:
            dto.kycStatus != null
              ? dto.kycStatus === 'APPROVED'
                ? new Date()
                : null
              : undefined,
          territory: dto.territory ?? undefined,
          state: dto.state ?? undefined,
          latitude: dto.latitude ?? undefined,
          longitude: dto.longitude ?? undefined,
          addressLine1: dto.addressLine1 ?? undefined,
          city: dto.city ?? undefined,
          postalCode: dto.postalCode ?? undefined,
          ownerFullName: dto.ownerFullName ?? undefined,
          ownerPhone: dto.ownerPhone ?? undefined,
          ownerEmail: dto.ownerEmail ?? undefined,
          businessName: dto.businessName ?? undefined,
          gstNumber: dto.gstNumber ?? undefined,
          panNumber: dto.panNumber ?? undefined,
          basicDetailsCompleted: dto.basicDetailsCompleted ?? undefined,
          gstDetailsCompleted: dto.gstDetailsCompleted ?? undefined,
          sopTrainingCompleted: dto.sopTrainingCompleted ?? undefined,
          sopBrandingCompleted: dto.sopBrandingCompleted ?? undefined,
          sopInfraAuditCompleted: dto.sopInfraAuditCompleted ?? undefined,
          sopPosSetupCompleted: dto.sopPosSetupCompleted ?? undefined,
          sopSafetyCompleted: dto.sopSafetyCompleted ?? undefined,
          sopChecklistCompleted: targetSop,
          sopLastReviewedAt: targetSop ? new Date() : undefined,
          sopNote: dto.sopNote ?? undefined,
        },
      });

      return tx.franchise.findUnique({
        where: { id },
        include: {
          documents: { orderBy: { createdAt: 'asc' } },
          _count: { select: { orders: true, users: true } },
        },
      });
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'franchise.update',
      resource: 'Franchise',
      resourceId: id,
      metadata: dto as unknown as Prisma.InputJsonValue,
      ip: actor.ip,
    });
    return row;
  }
}
