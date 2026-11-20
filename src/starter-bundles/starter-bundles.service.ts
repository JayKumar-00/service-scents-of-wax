import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/audit/audit.service';
import { DomainEventsService } from 'src/supply-chain/domain-events.service';
import { CreateStarterBundleDto } from './dto/create-bundle.dto';
import { UpdateStarterBundleDto } from './dto/update-bundle.dto';
import { BundleItemDto } from './dto/add-items.dto';
import { StarterBundleStatus, Prisma, BundleAssignmentStatus, BundleProvisionMethod, OnlinePaymentStatus, FranchiseStatus } from '@prisma/client';
import { StarterBundleQueryDto, StarterBundleSortBy } from './dto/starter-bundle.query.dto';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import {
  paginatePrisma,
  buildSearchFilter,
  buildDateFilter,
  buildSortOrder,
} from 'src/common/utils/pagination.util';

@Injectable()
export class StarterBundlesService {
  private readonly logger = new Logger(StarterBundlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    @InjectQueue('starter-bundle')
    private readonly starterBundleQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateStarterBundleDto, creatorUserId: string, ip?: string) {
    const isDefault = dto.isDefault === BooleanEnum.TRUE;
    const autoAssignOnCreate = dto.autoAssignOnCreate === BooleanEnum.TRUE;

    if (isDefault) {
      if (dto.status === StarterBundleStatus.INACTIVE) {
        throw new BadRequestException('Only active bundle can be set as default.');
      }
      await this.prisma.starterBundle.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const nameSlug = dto.name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = `SB_${nameSlug}_${randomSuffix}`;

    const generatedTxtId = dto.txtId || `TXN_SB_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const defaultPaymentStatus = isDefault
      ? OnlinePaymentStatus.PAID
      : OnlinePaymentStatus.UNPAID;

    const bundle = await this.prisma.starterBundle.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        type: dto.type,
        status: dto.status ?? StarterBundleStatus.ACTIVE,
        isDefault,
        autoAssignOnCreate,
        createdByUserId: creatorUserId,
        paymentStatus: dto.paymentStatus ?? defaultPaymentStatus,
        txtId: generatedTxtId,
      },
    });

    await this.audit.log({
      userId: creatorUserId,
      action: 'starter_bundle.create',
      resource: 'StarterBundle',
      resourceId: bundle.id,
      metadata: { code: bundle.code, name: bundle.name, isDefault: bundle.isDefault },
      ip: ip || null,
    });

    await this.domainEvents.emit('STARTER_BUNDLE_CREATED', {
      bundleId: bundle.id,
      code: bundle.code,
      name: bundle.name,
      isDefault: bundle.isDefault,
    });

    fireAndForget(this.redisService.clearCacheByPrefix('starter-bundles:list:'));

    // Auto-assign bundle to all existing active franchises
    if (autoAssignOnCreate) {
      fireAndForget(
        this.autoAssignToAllFranchises(bundle.id, creatorUserId, ip),
      );
    }

    return bundle;
  }

  async update(id: string, dto: UpdateStarterBundleDto, userId: string, ip?: string) {
    const bundle = await this.prisma.starterBundle.findUnique({
      where: { id },
    });
    if (!bundle) {
      throw new NotFoundException('Starter bundle not found.');
    }

    const isDefault = dto.isDefault !== undefined ? (dto.isDefault === BooleanEnum.TRUE) : undefined;

    if (isDefault) {
      const targetStatus = dto.status ?? bundle.status;
      if (targetStatus === StarterBundleStatus.INACTIVE) {
        throw new BadRequestException('Only active bundle can be set as default.');
      }
      await this.prisma.starterBundle.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    } else if (isDefault === false && bundle.isDefault) {
      throw new BadRequestException('Cannot unset default bundle directly. Make another bundle default instead.');
    }

    if (dto.status === StarterBundleStatus.INACTIVE && (isDefault !== true && bundle.isDefault)) {
      throw new BadRequestException('Cannot make default bundle inactive. Change default bundle first.');
    }

    const updated = await this.prisma.starterBundle.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        type: dto.type,
        status: dto.status,
        isDefault,
        autoAssignOnCreate: dto.autoAssignOnCreate !== undefined ? (dto.autoAssignOnCreate === BooleanEnum.TRUE) : undefined,
        paymentStatus: dto.paymentStatus,
        txtId: dto.txtId,
      },
    });

    await this.audit.log({
      userId,
      action: 'starter_bundle.update',
      resource: 'StarterBundle',
      resourceId: updated.id,
      metadata: dto as Prisma.InputJsonValue,
      ip: ip || null,
    });

    await this.domainEvents.emit('STARTER_BUNDLE_UPDATED', {
      bundleId: updated.id,
      code: updated.code,
      name: updated.name,
      status: updated.status,
    });

    fireAndForget(this.redisService.clearCacheByPrefix('starter-bundles:list:'));

    return updated;
  }



  async findAll(query: StarterBundleQueryDto) {
    const cacheKey = `starter-bundles:list:${JSON.stringify(query)}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // ignore
    }

    const clauses: Prisma.StarterBundleWhereInput[] = [];

    const searchFilter = buildSearchFilter(query.search, ['name', 'code']);
    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter as Prisma.StarterBundleWhereInput);
    }

    if (query.type) {
      clauses.push({ type: query.type });
    }

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.isDefault !== undefined) {
      clauses.push({ isDefault: query.isDefault === BooleanEnum.TRUE });
    }

    if (query.autoAssignOnCreate !== undefined) {
      clauses.push({ autoAssignOnCreate: query.autoAssignOnCreate === BooleanEnum.TRUE });
    }

    const dateFilter = buildDateFilter('createdAt', query.fromDate, query.lastDate);
    if (Object.keys(dateFilter).length > 0) {
      clauses.push(dateFilter as Prisma.StarterBundleWhereInput);
    }

    const where: Prisma.StarterBundleWhereInput = clauses.length > 0 ? { AND: clauses } : {};

    const orderBy = buildSortOrder(
      query.sortBy,
      query.order,
      Object.values(StarterBundleSortBy),
      'createdAt',
    );

    const result = await paginatePrisma<any>({
      model: this.prisma.starterBundle,
      where,
      orderBy,
      page: query.page,
      limit: query.limit,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            variant: { select: { id: true, sku: true, attributeSummary: true } },
          },
        },
        _count: {
          select: { items: true, assignments: true },
        },
      },
    });

    const mappedData = result.data.map((bundle: any) => {
      const mappedItems = bundle.items.map((item: any) => {
        let variantName: string | null = null;
        if (item.variant?.attributeSummary) {
          variantName = item.variant.attributeSummary
            .split('|')
            .map((part: string) => {
              const colonIndex = part.indexOf(':');
              if (colonIndex !== -1) {
                const key = part.slice(0, colonIndex).trim().toUpperCase();
                const val = part.slice(colonIndex + 1).trim().toUpperCase();
                return `${key}:${val}`;
              }
              return part.trim().toUpperCase();
            })
            .filter(Boolean)
            .join(', ');
        }
        return {
          ...item,
          variant: item.variant
            ? {
                ...item.variant,
                variantName,
              }
            : null,
        };
      });
      return {
        ...bundle,
        items: mappedItems,
      };
    });

    const finalResult = {
      ...result,
      data: mappedData,
    };

    try {
      await this.redisService.set(cacheKey, finalResult, 300);
    } catch (e) {
      // ignore
    }

    return finalResult;
  }

  async findOne(id: string) {
    const bundle = await this.prisma.starterBundle.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            variant: { select: { id: true, sku: true, attributeSummary: true } },
          },
        },
      },
    });

    if (!bundle) {
      throw new NotFoundException('Starter bundle not found.');
    }

    const assignments = await this.prisma.franchiseBundleAssignment.findMany({
      where: { bundleId: id },
      include: {
        franchise: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedItems = bundle.items.map((item: any) => {
      let variantName: string | null = null;
      if (item.variant?.attributeSummary) {
        variantName = item.variant.attributeSummary
          .split('|')
          .map((part: string) => {
            const colonIndex = part.indexOf(':');
            if (colonIndex !== -1) {
              const key = part.slice(0, colonIndex).trim().toUpperCase();
              const val = part.slice(colonIndex + 1).trim().toUpperCase();
              return `${key}:${val}`;
            }
            return part.trim().toUpperCase();
          })
          .filter(Boolean)
          .join(', ');
      }
      return {
        ...item,
        variant: item.variant
          ? {
              ...item.variant,
              variantName,
            }
          : null,
      };
    });

    const stats = {
      pending: assignments.filter((a: any) => a.status === 'PENDING').length,
      processing: assignments.filter((a: any) => a.status === 'PROCESSING').length,
      provisioned: assignments.filter((a: any) => a.status === 'PROVISIONED').length,
      failed: assignments.filter((a: any) => a.status === 'FAILED').length,
      total: assignments.length,
    };

    return {
      ...bundle,
      items: mappedItems,
      stats,
      provisioningHistory: assignments,
    };
  }

  private async validateItems(items: BundleItemDto[]) {
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      });
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} does not exist.`);
      }

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          throw new BadRequestException(`Variant ${item.variantId} does not belong to product ${item.productId}.`);
        }
      }
    }
  }

  async addItems(id: string, items: BundleItemDto[], userId: string, ip?: string) {
    const bundle = await this.prisma.starterBundle.findUnique({ where: { id } });
    if (!bundle) throw new NotFoundException('Starter bundle not found.');

    await this.validateItems(items);

    const createdItems = [];
    for (const item of items) {
      const existing = await this.prisma.starterBundleItem.findFirst({
        where: {
          bundleId: id,
          productId: item.productId,
          variantId: item.variantId || null,
        },
      });

      let created;
      if (existing) {
        created = await this.prisma.starterBundleItem.update({
          where: { id: existing.id },
          data: { quantity: item.quantity },
        });
      } else {
        created = await this.prisma.starterBundleItem.create({
          data: {
            bundleId: id,
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity,
          },
        });
      }
      createdItems.push(created);
    }

    await this.audit.log({
      userId,
      action: 'starter_bundle.add_items',
      resource: 'StarterBundle',
      resourceId: id,
      metadata: { itemsCount: items.length },
      ip: ip || null,
    });

    fireAndForget(this.redisService.clearCacheByPrefix('starter-bundles:list:'));

    // Provision any PENDING/FAILED auto-assigned franchises now that items exist
    if (bundle.autoAssignOnCreate) {
      fireAndForget(
        this.provisionPendingAssignments(id, userId, ip),
      );
    }

    return createdItems;
  }

  async replaceItems(id: string, items: BundleItemDto[], userId: string, ip?: string) {
    const bundle = await this.prisma.starterBundle.findUnique({ where: { id } });
    if (!bundle) throw new NotFoundException('Starter bundle not found.');

    await this.validateItems(items);

    const replaced = await this.prisma.$transaction(async (tx) => {
      await tx.starterBundleItem.deleteMany({ where: { bundleId: id } });
      const created = [];
      for (const item of items) {
        const c = await tx.starterBundleItem.create({
          data: {
            bundleId: id,
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity,
          },
        });
        created.push(c);
      }
      return created;
    });

    await this.audit.log({
      userId,
      action: 'starter_bundle.replace_items',
      resource: 'StarterBundle',
      resourceId: id,
      metadata: { itemsCount: items.length },
      ip: ip || null,
    });

    fireAndForget(this.redisService.clearCacheByPrefix('starter-bundles:list:'));

    // Provision any PENDING/FAILED auto-assigned franchises now that items exist
    if (bundle.autoAssignOnCreate) {
      fireAndForget(
        this.provisionPendingAssignments(id, userId, ip),
      );
    }

    return replaced;
  }

  async removeItem(bundleId: string, itemId: string, userId: string, ip?: string) {
    const item = await this.prisma.starterBundleItem.findFirst({
      where: { id: itemId, bundleId },
    });
    if (!item) {
      throw new NotFoundException('Bundle item not found in this bundle.');
    }

    await this.prisma.starterBundleItem.delete({
      where: { id: itemId },
    });

    await this.audit.log({
      userId,
      action: 'starter_bundle.remove_item',
      resource: 'StarterBundle',
      resourceId: bundleId,
      metadata: { itemId, productId: item.productId, variantId: item.variantId },
      ip: ip || null,
    });

    fireAndForget(this.redisService.clearCacheByPrefix('starter-bundles:list:'));

    return { success: true };
  }

  async assignBundle(
    bundleId: string,
    franchiseId: string,
    actorUserId: string,
    ip?: string,
    method?: BundleProvisionMethod,
  ) {
    const bundle = await this.prisma.starterBundle.findUnique({
      where: { id: bundleId },
    });
    if (!bundle) {
      throw new NotFoundException('Starter bundle not found.');
    }
    if (bundle.status !== StarterBundleStatus.ACTIVE) {
      throw new BadRequestException('Cannot assign an inactive bundle.');
    }

    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
    });
    if (!franchise) {
      throw new NotFoundException('Franchise not found.');
    }

    const centralNode = await this.prisma.stockingNode.findFirst({
      where: { type: 'CENTRAL_DC' },
    });
    const existingNode = await this.prisma.stockingNode.findUnique({
      where: { franchiseId },
    });
    if (!existingNode) {
      await this.prisma.stockingNode.create({
        data: {
          type: 'STORE',
          name: franchise.name,
          code: `STORE-${franchise.code.toUpperCase()}`,
          franchiseId,
          parentId: centralNode?.id || null,
          sortOrder: 10,
        },
      });
    }

    let assignment = await this.prisma.franchiseBundleAssignment.findUnique({
      where: {
        franchiseId_bundleId: { franchiseId, bundleId },
      },
    });

    if (assignment) {
      if (assignment.status === BundleAssignmentStatus.PROVISIONED && !assignment.isPartial) {
        throw new BadRequestException('Bundle is already fully provisioned for this franchise.');
      }
    } else {
      assignment = await this.prisma.franchiseBundleAssignment.create({
        data: {
          franchiseId,
          bundleId,
          status: BundleAssignmentStatus.PENDING,
          method: method ?? 'STOCK_REQUEST',
        },
      });
    }

    await this.starterBundleQueue.add('provision-franchise-bundle', {
      assignmentId: assignment.id,
      franchiseId,
      bundleId,
      actorUserId,
      ip,
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'starter_bundle.assign',
      resource: 'FranchiseBundleAssignment',
      resourceId: assignment.id,
      metadata: { franchiseId, bundleId },
      ip: ip || null,
    });

    return assignment;
  }

  async delete(id: string, userId: string, ip?: string) {
    const bundle = await this.prisma.starterBundle.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    if (!bundle) {
      throw new NotFoundException('Starter bundle not found.');
    }

    if (bundle.isDefault) {
      throw new BadRequestException(
        'Cannot delete the default starter bundle. Set another bundle as default first.',
      );
    }

    if (bundle._count.assignments > 0) {
      throw new BadRequestException(
        'Cannot delete starter bundle because it is assigned to one or more franchises.',
      );
    }

    await this.prisma.starterBundle.delete({
      where: { id },
    });

    await this.audit.log({
      userId,
      action: 'starter_bundle.delete',
      resource: 'StarterBundle',
      resourceId: id,
      metadata: { code: bundle.code, name: bundle.name },
      ip: ip || null,
    });

    fireAndForget(this.redisService.clearCacheByPrefix('starter-bundles:list:'));

    return { success: true };
  }

  async getAssignments(bundleId: string) {
    const bundle = await this.prisma.starterBundle.findUnique({
      where: { id: bundleId },
    });
    if (!bundle) {
      throw new NotFoundException('Starter bundle not found.');
    }

    return this.prisma.franchiseBundleAssignment.findMany({
      where: { bundleId },
      include: {
        franchise: {
          select: { id: true, name: true, code: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFranchiseBundles(franchiseId: string) {
    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
    });
    if (!franchise) {
      throw new NotFoundException('Franchise not found.');
    }

    const assignments = await this.prisma.franchiseBundleAssignment.findMany({
      where: { franchiseId },
      include: {
        bundle: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, slug: true } },
                variant: { select: { id: true, sku: true, attributeSummary: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assignments.map((a: any) => this.mapAssignmentItems(a));
  }

  async getFranchiseInitialInventory(franchiseId: string) {
    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
    });
    if (!franchise) {
      throw new NotFoundException('Franchise not found.');
    }

    const assignment = await this.prisma.franchiseBundleAssignment.findFirst({
      where: { franchiseId },
      include: {
        bundle: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, slug: true } },
                variant: { select: { id: true, sku: true, attributeSummary: true } },
              },
            },
          },
        },
        stockRequest: {
          select: { id: true, status: true, paymentStatus: true },
        },
        inboundDelivery: {
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!assignment) {
      throw new NotFoundException('No bundle assignment found for this franchise.');
    }

    return this.mapAssignmentItems(assignment);
  }

  private async autoAssignToAllFranchises(
    bundleId: string,
    actorUserId: string,
    ip?: string,
  ): Promise<void> {
    try {
      const franchises = await this.prisma.franchise.findMany({
        where: { status: FranchiseStatus.ACTIVE },
        select: { id: true, name: true, code: true },
      });

      this.logger.log(
        `Auto-assigning bundle ${bundleId} to ${franchises.length} active franchise(s).`,
      );

      for (const franchise of franchises) {
        try {
          const existing = await this.prisma.franchiseBundleAssignment.findUnique({
            where: {
              franchiseId_bundleId: { franchiseId: franchise.id, bundleId },
            },
          });

          if (!existing) {
            await this.prisma.franchiseBundleAssignment.create({
              data: {
                franchiseId: franchise.id,
                bundleId,
                status: BundleAssignmentStatus.PENDING,
                method: 'STOCK_REQUEST',
              },
            });
          }

          // Ensure a stocking node exists for this franchise
          const existingNode = await this.prisma.stockingNode.findUnique({
            where: { franchiseId: franchise.id },
          });
          if (!existingNode) {
            const centralNode = await this.prisma.stockingNode.findFirst({
              where: { type: 'CENTRAL_DC' },
            });
            await this.prisma.stockingNode.create({
              data: {
                type: 'STORE',
                name: franchise.name,
                code: `STORE-${franchise.code.toUpperCase()}`,
                franchiseId: franchise.id,
                parentId: centralNode?.id || null,
                sortOrder: 10,
              },
            });
          }

          this.logger.log(
            `Created/verified PENDING assignment for bundle ${bundleId} → franchise ${franchise.code}.`,
          );
        } catch (err: any) {
          this.logger.warn(
            `Failed to auto-assign bundle ${bundleId} to franchise ${franchise.code}: ${err.message}`,
          );
        }
      }

      // Provision any PENDING or FAILED assignments now
      await this.provisionPendingAssignments(bundleId, actorUserId, ip);
    } catch (err: any) {
      this.logger.error(
        `Error during auto-assign of bundle ${bundleId}: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Finds all PENDING or FAILED assignments for a bundle and queues provisioning.
   * Called when items are added/replaced so provisioning runs with actual items.
   */
  private async provisionPendingAssignments(
    bundleId: string,
    actorUserId: string,
    ip?: string,
  ): Promise<void> {
    try {
      const assignments = await this.prisma.franchiseBundleAssignment.findMany({
        where: {
          bundleId,
          status: { in: [BundleAssignmentStatus.PENDING, BundleAssignmentStatus.FAILED] },
        },
        include: {
          franchise: { select: { id: true, code: true } },
        },
      });

      if (assignments.length === 0) return;

      this.logger.log(
        `Provisioning ${assignments.length} pending/failed assignment(s) for bundle ${bundleId}.`,
      );

      for (const assignment of assignments) {
        try {
          await this.starterBundleQueue.add('provision-franchise-bundle', {
            assignmentId: assignment.id,
            franchiseId: assignment.franchiseId,
            bundleId,
            actorUserId,
            ip,
          });
          this.logger.log(
            `Queued provisioning for assignment ${assignment.id} (franchise ${assignment.franchise.code}).`,
          );
        } catch (err: any) {
          this.logger.warn(
            `Failed to queue provisioning for assignment ${assignment.id}: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error provisioning pending assignments for bundle ${bundleId}: ${err.message}`,
        err.stack,
      );
    }
  }

  private mapAssignmentItems(assignment: any): any {
    if (!assignment || !assignment.bundle || !assignment.bundle.items) {
      return assignment;
    }
    const mappedItems = assignment.bundle.items.map((item: any) => {
      let variantName: string | null = null;
      if (item.variant?.attributeSummary) {
        variantName = item.variant.attributeSummary
          .split('|')
          .map((part: string) => {
            const colonIndex = part.indexOf(':');
            if (colonIndex !== -1) {
              const key = part.slice(0, colonIndex).trim().toUpperCase();
              const val = part.slice(colonIndex + 1).trim().toUpperCase();
              return `${key}:${val}`;
            }
            return part.trim().toUpperCase();
          })
          .filter(Boolean)
          .join(', ');
      }
      return {
        ...item,
        variant: item.variant
          ? {
              ...item.variant,
              variantName,
            }
          : null,
      };
    });
    return {
      ...assignment,
      bundle: {
        ...assignment.bundle,
        items: mappedItems,
      },
    };
  }
}
