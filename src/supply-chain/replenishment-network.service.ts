import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  DomainEventOutbox,
  Prisma,
  ReplenishmentPolicy,
  Role,
  StockingNodeType,
  StockTransferStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import { franchiseHasReadAccess } from '../common/franchise-roles';
import { DomainEventsService } from './domain-events.service';
import { AuditService } from '../audit/audit.service';
import { ReplenishmentPolicyQueryDto } from './dto/replenishmentPolicy-query.dto';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import {
  buildPrismaDateRangeFilter,
  buildPrismaRatingRangeFilter,
} from 'src/products/utils/range-filter.util';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { NetworkInventoryQueryDto } from './dto/network-inventory-query.dto';
import { AtpQueryDto } from './dto/atp-query.dto';
import {
  AllocationQueryDto,
  AllocationWithoutFilterQueryDto,
} from './dto/allocation-query.dto';
import { SuggessionQueryDto } from './dto/suggession-query.dto';
import { EventTimeLineQueryDto } from './dto/event-query.dto';
import { OutboxQueryDto } from './dto/outbox-query.dto';
import { fireAndForget } from 'src/common/utils/fireForgot.util';

@Injectable()
export class ReplenishmentNetworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEvents: DomainEventsService,
    private readonly audit: AuditService,
  ) { }

  private buildReplenishmentSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> => buildSortOrder(sortBy, order, ['createdAt']);

  private buildOutBoxSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, [
      'createdAt',
      'dispatchedAt',
      'status',
      'eventName',
    ]);

  async listPolicies(
    user: JwtUser,
    query: ReplenishmentPolicyQueryDto,
  ): Promise<{
    data: ReplenishmentPolicy[];
    meta: IMeta;
  }> {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
        OR: [
          {
            franchise: {
              name: { contains: search, mode: 'insensitive' },
            },
            product: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.active !== null && query.active !== undefined) {
      clauses.push({
        active: query.active.includes('true') ? true : false,
      });
    }

    if (query.franchiseId) {
      clauses.push({ fromNodeId: q.fromNodeId });
    }

    if (query.productId) {
      clauses.push({ product: { id: q.productId } });
    }

    if (
      (!query.minQty !== null && query.minQty !== undefined) ||
      (query.maxQty !== null && query.maxQty !== undefined) ||
      (!query.minQty !== null && query.minQty !== undefined) ||
      !(query.maxQty !== null && query.maxQty !== undefined)
    ) {
      if (query.minQty !== null && query.minQty !== undefined) {
        clauses.push({ quantityRequested: { gte: q.minQty } });
      }

      if (query.maxQty !== null && query.maxQty !== undefined) {
        clauses.push({ quantityRequested: { lte: q.maxQty } });
      }
    }

    if (
      query.minQty !== null &&
      query.minQty !== undefined &&
      query.maxQty !== null &&
      query.maxQty !== undefined
    ) {
      const result = buildPrismaRatingRangeFilter({
        minRatingOrComment: q.minQty,
        maxRatingOrComment: q.maxQty,
      });

      console.log('result', result);
    }

    const allowedFranchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (query.franchiseId !== null && query.franchiseId !== undefined) {
      clauses.push({ franchise: { id: allowedFranchiseId } });
    }

    if (
      user.role !== Role.SUPERADMIN &&
      franchiseHasReadAccess(user.role) &&
      allowedFranchiseId
    ) {
      clauses.push({ franchise: { id: allowedFranchiseId } });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildReplenishmentSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.replenishmentPolicy as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        product: { select: { id: true, name: true, slug: true } },
        franchise: { select: { id: true, code: true, name: true } },
      },
    });

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;

    // if (user.role === Role.SUPERADMIN) {
    //   return this.prisma.replenishmentPolicy.findMany({
    //     where: franchiseId ? { franchiseId } : undefined,
    //     orderBy: { updatedAt: 'desc' },
    //     take: 500,
    // include: {
    //   product: { select: { id: true, name: true, slug: true } },
    //   franchise: { select: { id: true, code: true, name: true } },
    // },
    //   });
    // }
    // if (franchiseHasReadAccess(user.role) && user.franchiseId) {
    //   return this.prisma.replenishmentPolicy.findMany({
    //     where: { franchiseId: user.franchiseId, active: true },
    //     orderBy: { updatedAt: 'desc' },
    //     include: { product: { select: { id: true, name: true, slug: true } } },
    //   });
    // }
    // return [];
  }

  async upsertPolicy(
    user: JwtUser,
    body: {
      franchiseId: string;
      productId: string;
      minQty?: number;
      maxQty?: number;
      reorderPoint?: number;
      active?: boolean;
    },
    ip?: string,
  ) {
    if (user.role !== Role.SUPERADMIN) throw new ForbiddenException();
    const minQty = body.minQty ?? 0;
    const maxQty = body.maxQty ?? 10;
    const reorderPoint = body.reorderPoint ?? 2;
    if (minQty < 0 || maxQty < 1 || reorderPoint < 0 || reorderPoint > maxQty) {
      throw new BadRequestException('Invalid min/max/reorder');
    }

    const existingPolicy = await this.prisma.replenishmentPolicy.findUnique({
      where: {
        franchiseId_productId: {
          franchiseId: body.franchiseId,
          productId: body.productId,
        },
      },
    });

    const isCreate = !existingPolicy;

    const row = await this.prisma.replenishmentPolicy.upsert({
      where: {
        franchiseId_productId: {
          franchiseId: body.franchiseId,
          productId: body.productId,
        },
      },
      create: {
        franchiseId: body.franchiseId,
        productId: body.productId,
        minQty,
        maxQty,
        reorderPoint,
        active: body.active ?? true,
      },
      update: {
        minQty,
        maxQty,
        reorderPoint,
        active: body.active ?? true,
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        franchise: { select: { id: true, code: true } },
      },
    });

    await this.domainEvents.emit(
      'inventory.policy.upserted',
      {
        policyId: row.id,
        franchiseId: row.franchiseId,
        productId: row.productId,
      },
      {
        refType: 'REPLENISHMENT_POLICY',
        refId: row.id,
        productId: row.productId,
      },
    );

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: isCreate
          ? 'replenishment_policy.create'
          : 'replenishment_policy.update',
        resource: 'SupplyChain',
        resourceId: row.id,
        metadata: isCreate ? {
          created: {
            franchiseId: row.franchiseId,
            productId: row.productId,
            minQty: row.minQty,
            maxQty: row.maxQty,
            reorderPoint: row.reorderPoint,
          }
        } : {
          from: {
            franchiseId: existingPolicy?.franchiseId,
            productId: existingPolicy?.productId,
            minQty: existingPolicy?.minQty,
            maxQty: existingPolicy?.maxQty,
            reorderPoint: existingPolicy?.reorderPoint,
          },
          to: {
            franchiseId: row.franchiseId,
            productId: row.productId,
            minQty: row.minQty,
            maxQty: row.maxQty,
            reorderPoint: row.reorderPoint,
          }
        },
        ip,
      }),
      'replenishment_policy.upsert',
    );

    return row;
  }

  /** On-hand and in-transit slices for network visibility (includes outlet `reserved` for ATP). */
  async networkInventory(user: JwtUser) {
    if (user.role === Role.SUPERADMIN) {
      const [dc, hubs, nodes] = await Promise.all([
        this.prisma.warehouseStock.findMany({
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
          // orderBy: { productId: 'asc' },
        }),
        this.prisma.hubInventory.findMany({
          include: {
            stockingNode: {
              select: { id: true, code: true, name: true, type: true },
            },
            product: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ stockingNodeId: 'asc' }, { productId: 'asc' }],
        }),
        this.prisma.stockingNode.findMany({
          where: { type: StockingNodeType.STORE, active: true },
          include: {
            franchise: { select: { id: true, code: true, name: true } },
          },
        }),
      ]);
      const franchiseIds = nodes
        .map((n) => n.franchiseId)
        .filter((id): id is string => Boolean(id));
      const storeStocks = franchiseIds.length
        ? await this.prisma.franchiseStock.findMany({
          where: { franchiseId: { in: franchiseIds } },
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        })
        : [];
      const inTransit = await this.prisma.stockTransfer.findMany({
        where: { status: StockTransferStatus.IN_TRANSIT },
        include: {
          lines: { include: { product: { select: { id: true, slug: true } } } },
          fromNode: { select: { id: true, code: true, type: true } },
          toNode: {
            select: { id: true, code: true, type: true, franchiseId: true },
          },
        },
        take: 200,
        orderBy: { updatedAt: 'desc' },
      });
      return {
        scope: 'network' as const,
        centralDc: dc,
        hubRows: hubs,
        storeStocks,
        inTransitTransfers: inTransit,
      };
    }
    const allowedFranchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;
    if (franchiseHasReadAccess(user.role) && allowedFranchiseId) {
      const node = await this.prisma.stockingNode.findFirst({
        where: { franchiseId: allowedFranchiseId },
      });
      const [dc, store, inToStore] = await Promise.all([
        this.prisma.warehouseStock.findMany({
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
          // orderBy: { productId: 'asc' },
        }),
        this.prisma.franchiseStock.findMany({
          where: { franchiseId: allowedFranchiseId },
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        }),
        node
          ? this.prisma.stockTransfer.findMany({
            where: {
              toNode: {
                franchiseId: allowedFranchiseId,
              },
              status: StockTransferStatus.IN_TRANSIT,
            },
            include: {
              lines: true,
              fromNode: { select: { id: true, code: true, type: true } },
              toNode: { select: { id: true, code: true, type: true } },
            },
            take: 50,
          })
          : Promise.resolve([]),
      ]);
      return {
        scope: 'outlet' as const,
        stockingNodeId: node?.id ?? null,
        nodeName: node?.name,
        nodeCode: node?.code,
        nodeType: node?.type,
        centralDc: dc,
        outletOnHand: store,
        inboundTransfers: inToStore,
      };
    }
    return { scope: 'none' as const };
  }

  async networkInventoryWithFilterPagination(
    user: JwtUser,
    query: NetworkInventoryQueryDto,
  ) {
    const page = Math.max(1, Math.floor(Number(query.page ?? 1) || 1));
    const limit = Math.max(1, Math.floor(Number(query.limit ?? 10) || 10));
    const search = query.search?.trim().toLowerCase();

    type InventoryRow = {
      id: string;
      source: 'centralDc' | 'hub' | 'store' | 'inTransit';
      productId: string;
      franchiseId?: string | null;
      product: { id: string; name: string; slug: string } | null;
      quantity: number;
      reserved: number;
      available: number;
      lowStockThreshold?: number | null;
      stockingNodeId?: string | null;
      stockingNode?: {
        id: string;
        code: string;
        name: string;
        type: StockingNodeType;
      } | null;
      franchise?: {
        id: string;
        code: string;
        name: string;
      } | null;
      transfer?: {
        id: string;
        status: StockTransferStatus;
        createdAt: Date;
        updatedAt: Date;
        fromNode: { id: string; code: string; type: StockingNodeType } | null;
        toNode: {
          id: string;
          code: string;
          type: StockingNodeType;
          franchiseId: string | null;
        } | null;
      } | null;
    };

    const matchesSearch = (row: InventoryRow) => {
      if (!search) return true;
      const haystack = [
        row.product?.name,
        row.product?.slug,
        row.franchiseId,
        row.stockingNode?.code,
        row.stockingNode?.name,
        row.stockingNodeId,
        row.franchise?.code,
        row.franchise?.name,
        row.transfer?.id,
        row.transfer?.fromNode?.code,
        row.transfer?.toNode?.code,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    };

    const matchesFilters = (row: InventoryRow) => {
      if (query.productId && row.productId !== query.productId) {
        return false;
      }

      if (
        query.minQty !== null &&
        query.minQty !== undefined &&
        row.quantity < query.minQty
      ) {
        return false;
      }

      if (
        query.maxQty !== null &&
        query.maxQty !== undefined &&
        row.quantity > query.maxQty
      ) {
        return false;
      }

      if (
        query.minLowStockThreshold !== null &&
        query.minLowStockThreshold !== undefined &&
        (row.lowStockThreshold === undefined ||
          row.lowStockThreshold === null ||
          row.lowStockThreshold < query.minLowStockThreshold)
      ) {
        return false;
      }

      if (
        query.maxLowStockThreshold !== null &&
        query.maxLowStockThreshold !== undefined &&
        (row.lowStockThreshold === undefined ||
          row.lowStockThreshold === null ||
          row.lowStockThreshold > query.maxLowStockThreshold)
      ) {
        return false;
      }

      return matchesSearch(row);
    };

    const inventoryRows: InventoryRow[] = [];

    if (user.role === Role.SUPERADMIN) {
      const [dc, hubs, nodes, inTransit] = await Promise.all([
        this.prisma.warehouseStock.findMany({
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        }),
        this.prisma.hubInventory.findMany({
          include: {
            stockingNode: {
              select: { id: true, code: true, name: true, type: true },
            },
            product: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ stockingNodeId: 'asc' }, { productId: 'asc' }],
        }),
        this.prisma.stockingNode.findMany({
          where: { type: StockingNodeType.STORE, active: true },
          include: {
            franchise: { select: { id: true, code: true, name: true } },
          },
        }),
        this.prisma.stockTransfer.findMany({
          where: { status: StockTransferStatus.IN_TRANSIT },
          include: {
            lines: {
              include: {
                product: { select: { id: true, name: true, slug: true } },
              },
            },
            fromNode: { select: { id: true, code: true, type: true } },
            toNode: {
              select: { id: true, code: true, type: true, franchiseId: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

      const franchiseIds = nodes
        .map((n) => n.franchiseId)
        .filter((id): id is string => Boolean(id));

      const storeStocks = franchiseIds.length
        ? await this.prisma.franchiseStock.findMany({
          where: { franchiseId: { in: franchiseIds } },
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        })
        : [];

      inventoryRows.push(
        ...dc.map<InventoryRow>((row) => ({
          id: row.productId,
          source: 'centralDc',
          productId: row.productId,
          product: row.product,
          quantity: row.quantity,
          reserved: row.reserved,
          available: Math.max(0, row.quantity - row.reserved),
          lowStockThreshold: row.lowStockThreshold,
        })),
        ...hubs.map<InventoryRow>((row) => ({
          id: `${row.stockingNodeId}:${row.productId}`,
          source: 'hub',
          productId: row.productId,
          product: row.product,
          quantity: row.quantity,
          reserved: row.reserved,
          available: Math.max(0, row.quantity - row.reserved),
          stockingNode: row.stockingNode,
        })),
        ...storeStocks.map<InventoryRow>((row) => ({
          id: `${row.franchiseId}:${row.productId}`,
          source: 'store',
          productId: row.productId,
          franchiseId: row.franchiseId,
          product: row.product,
          quantity: row.quantity,
          reserved: row.reserved,
          available: Math.max(0, row.quantity - row.reserved),
          lowStockThreshold: row.lowStockThreshold,
          stockingNodeId:
            nodes.find((node) => node.franchiseId === row.franchiseId)?.id ??
            null,
          franchise:
            nodes.find((node) => node.franchiseId === row.franchiseId)
              ?.franchise ?? null,
        })),
        ...inTransit.flatMap<InventoryRow>((transfer) =>
          transfer.lines.map((line) => ({
            id: `${transfer.id}:${line.id}`,
            source: 'inTransit',
            productId: line.productId,
            product: line.product,
            quantity: line.quantityShipped ?? line.quantityRequested,
            reserved: 0,
            available: line.quantityShipped ?? line.quantityRequested,
            transfer: {
              id: transfer.id,
              status: transfer.status,
              createdAt: transfer.createdAt,
              updatedAt: transfer.updatedAt,
              fromNode: transfer.fromNode,
              toNode: transfer.toNode,
            },
          })),
        ),
      );

      const filtered = inventoryRows.filter(matchesFilters);
      const total = filtered.length;
      const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
      const start = (page - 1) * limit;
      const data = filtered.slice(start, start + limit);

      return {
        scope: 'network' as const,
        data,
        meta: {
          count: total,
          totalPages,
          page,
          limit,
        },
      };
    }

    const allowedFranchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;
    if (franchiseHasReadAccess(user.role) && allowedFranchiseId) {
      const [node, dc, store, inTransit] = await Promise.all([
        this.prisma.stockingNode.findFirst({
          where: { franchiseId: allowedFranchiseId },
          include: {
            franchise: { select: { id: true, code: true, name: true } },
          },
        }),
        this.prisma.warehouseStock.findMany({
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        }),
        this.prisma.franchiseStock.findMany({
          where: { franchiseId: allowedFranchiseId },
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        }),
        this.prisma.stockTransfer.findMany({
          where: {
            toNode: {
              franchiseId: allowedFranchiseId,
            },
            status: StockTransferStatus.IN_TRANSIT,
          },
          include: {
            lines: {
              include: {
                product: { select: { id: true, name: true, slug: true } },
              },
            },
            fromNode: { select: { id: true, code: true, type: true } },
            toNode: {
              select: { id: true, code: true, type: true, franchiseId: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

      inventoryRows.push(
        ...dc.map<InventoryRow>((row) => ({
          id: row.productId,
          source: 'centralDc',
          productId: row.productId,
          product: row.product,
          quantity: row.quantity,
          reserved: row.reserved,
          available: Math.max(0, row.quantity - row.reserved),
          lowStockThreshold: row.lowStockThreshold,
        })),
        ...store.map<InventoryRow>((row) => ({
          id: `${row.franchiseId}:${row.productId}`,
          source: 'store',
          productId: row.productId,
          franchiseId: row.franchiseId,
          product: row.product,
          quantity: row.quantity,
          reserved: row.reserved,
          available: Math.max(0, row.quantity - row.reserved),
          lowStockThreshold: row.lowStockThreshold,
          stockingNodeId: node?.id ?? null,
          franchise: node?.franchise ?? null,
        })),
        ...inTransit.flatMap<InventoryRow>((transfer) =>
          transfer.lines.map((line) => ({
            id: `${transfer.id}:${line.id}`,
            source: 'inTransit',
            productId: line.productId,
            product: line.product,
            quantity: line.quantityShipped ?? line.quantityRequested,
            reserved: 0,
            available: line.quantityShipped ?? line.quantityRequested,
            transfer: {
              id: transfer.id,
              status: transfer.status,
              createdAt: transfer.createdAt,
              updatedAt: transfer.updatedAt,
              fromNode: transfer.fromNode,
              toNode: transfer.toNode,
            },
          })),
        ),
      );

      const filtered = inventoryRows.filter(matchesFilters);
      const total = filtered.length;
      const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
      const start = (page - 1) * limit;
      const data = filtered.slice(start, start + limit);

      return {
        scope: 'outlet' as const,
        stockingNodeId: node?.id ?? null,
        data,
        meta: {
          count: total,
          totalPages,
          page,
          limit,
        },
      };
    }

    return {
      scope: 'none' as const,
      data: [],
      meta: {
        count: 0,
        totalPages: 0,
        page,
        limit,
      },
    };
  }

  /** Rough ATP: DC on-hand + optional in-transit to this outlet + outlet on-hand (no cross-node reservations). */
  // async atp(user: JwtUser) {
  //   const fid =
  //     user.role === Role.SUPERADMIN
  //       ? franchiseId
  //       : franchiseHasReadAccess(user.role)
  //         ? user.franchiseId
  //         : null;

  //   if (!fid) throw new ForbiddenException();
  //   if (user.role === Role.SUPERADMIN && !franchiseId) {
  //     throw new BadRequestException(
  //       'franchiseId is required for superadmin ATP',
  //     );
  //   }
  //   const [ws, fs, node] = await Promise.all([
  //     this.prisma.warehouseStock.findUnique({
  //       where: { productId },
  //       include: { product: { select: { id: true, name: true, slug: true } } },
  //     }),
  //     this.prisma.franchiseStock.findUnique({
  //       where: { franchiseId_productId: { franchiseId: fid, productId } },
  //       include: { product: { select: { id: true, name: true, slug: true } } },
  //     }),
  //     this.prisma.stockingNode.findFirst({ where: { franchiseId: fid } }),
  //   ]);
  //   let inTransitQty = 0;
  //   if (node) {
  //     const lines = await this.prisma.stockTransferLine.findMany({
  //       where: {
  //         productId,
  //         transfer: {
  //           toNodeId: node.id,
  //           status: StockTransferStatus.IN_TRANSIT,
  //         },
  //       },
  //     });
  //     for (const l of lines) {
  //       inTransitQty += l.quantityShipped ?? l.quantityRequested;
  //     }
  //   }
  //   const dcPhysical = ws?.quantity ?? 0;
  //   const dcReserved = ws?.reserved ?? 0;
  //   const dcAvailable = Math.max(0, dcPhysical - dcReserved);
  //   const storePhysical = fs?.quantity ?? 0;
  //   const storeReserved = fs?.reserved ?? 0;
  //   const storeAvailable = Math.max(0, storePhysical - storeReserved);
  //   const atpTotal = dcAvailable + inTransitQty + storeAvailable;
  //   return {
  //     productId,
  //     franchiseId: fid,
  //     dcOnHand: dcPhysical,
  //     dcReserved,
  //     dcAvailable,
  //     inboundInTransit: inTransitQty,
  //     storeOnHand: storePhysical,
  //     storeReserved,
  //     storeAvailable,
  //     atpTotal,
  //     product: ws?.product ?? fs?.product ?? null,
  //   };
  // }

  async atpWithFilterPagination(user: JwtUser, query: AtpQueryDto) {
    const fid =
      user.role === Role.SUPERADMIN
        ? (query.franchiseId ?? null)
        : franchiseHasReadAccess(user.role)
          ? user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId
          : null;

    if (user.role === Role.SUPERADMIN && !fid) {
      throw new BadRequestException(
        'franchiseId is required for superadmin ATP',
      );
    }

    if (!fid && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }

    const page = Math.max(1, Math.floor(Number(query.page ?? 1) || 1));
    const limit = Math.max(1, Math.floor(Number(query.limit ?? 10) || 10));

    const node = fid
      ? await this.prisma.stockingNode.findFirst({
        where: { franchiseId: fid },
        select: { id: true, franchiseId: true },
      })
      : null;

    const [wsRows, fsRows, transferLines] = await Promise.all([
      this.prisma.warehouseStock.findMany({
        include: { product: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.franchiseStock.findMany({
        where: { franchiseId: fid! },
        include: {
          product: { select: { id: true, name: true, slug: true } },
        },
      }),
      node
        ? this.prisma.stockTransferLine.findMany({
          where: {
            transfer: {
              toNodeId: node.id,
              status: StockTransferStatus.IN_TRANSIT,
            },
          },
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        })
        : [],
    ]);

    const wsByProductId = new Map(wsRows.map((row) => [row.productId, row]));
    const fsByProductId = new Map(fsRows.map((row) => [row.productId, row]));
    const inTransitByProductId = new Map<string, number>();

    for (const line of transferLines) {
      const qty = line.quantityShipped ?? line.quantityRequested;
      inTransitByProductId.set(
        line.productId,
        (inTransitByProductId.get(line.productId) ?? 0) + qty,
      );
    }

    const productIds = new Set<string>([
      ...wsByProductId.keys(),
      ...fsByProductId.keys(),
      ...inTransitByProductId.keys(),
      ...(query.productId ? [query.productId] : []),
    ]);

    const products = productIds.size
      ? await this.prisma.product.findMany({
        where: { id: { in: [...productIds] } },
        select: {
          id: true,
          name: true,
          slug: true,
          stock: true,
          variants: {
            select: { id: true, sku: true, stock: true, isActive: true },
          },
        },
      })
      : [];

    const productById = new Map(products.map((row) => [row.id, row]));

    const rows = Array.from(productIds).map((productId) => {
      const product = productById.get(productId) ?? null;
      const ws = wsByProductId.get(productId) ?? null;
      const fs = fsByProductId.get(productId) ?? null;
      const inTransitQty = inTransitByProductId.get(productId) ?? 0;
      const dcPhysical = ws?.quantity ?? 0;
      const dcReserved = ws?.reserved ?? 0;
      const dcAvailable = Math.max(0, dcPhysical - dcReserved);
      const storePhysical = fs?.quantity ?? 0;
      const storeReserved = fs?.reserved ?? 0;
      const storeAvailable = Math.max(0, storePhysical - storeReserved);
      const variantStock = (product?.variants ?? [])
        .filter((variant) => variant.isActive !== false)
        .reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
      const baseStock = product?.stock ?? 0;
      const displayStock =
        (product?.variants?.length ?? 0) > 0 ? variantStock : baseStock;

      return {
        productId,
        franchiseId: fid,
        dcOnHand: dcPhysical,
        dcReserved,
        dcAvailable,
        inboundInTransit: inTransitQty,
        storeOnHand: storePhysical,
        storeReserved,
        storeAvailable,
        atpTotal: dcAvailable + inTransitQty + storeAvailable,
        product: product
          ? {
            id: product.id,
            name: product.name,
            slug: product.slug,
            stock: displayStock,
            baseStock,
            variantStock,
            warehouseStock: ws
              ? {
                quantity: ws.quantity,
                reserved: ws.reserved,
                available: dcAvailable,
                lowStockThreshold: ws.lowStockThreshold,
              }
              : null,
            franchiseStock: fs
              ? {
                franchiseId: fs.franchiseId,
                quantity: fs.quantity,
                reserved: fs.reserved,
                available: storeAvailable,
                lowStockThreshold: fs.lowStockThreshold,
              }
              : null,
            variants: product.variants,
          }
          : null,
      };
    });

    const search = query.search?.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (query.productId && row.productId !== query.productId) {
        return false;
      }

      if (search) {
        const haystack = [
          row.product?.name,
          row.product?.slug,
          row.productId,
          row.product?.variants?.map((variant) => variant.sku).join(' '),
        ]
          .filter((value): value is string => Boolean(value))
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (query.minQty !== null && query.minQty !== undefined) {
        if (row.atpTotal < query.minQty) return false;
      }

      if (query.maxQty !== null && query.maxQty !== undefined) {
        if (row.atpTotal > query.maxQty) return false;
      }

      return true;
    });

    const total = filtered.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const start = (page - 1) * limit;
    return {
      franchiseId: fid,
      data: filtered.slice(start, start + limit),
      meta: {
        count: total,
        totalPages,
        page,
        limit,
      },
    };
  }

  /**
   * Ranked sourcing options for a SKU into an outlet: active lanes to the store node,
   * ordered by allocationPriority (then lane code). Includes upstream available (physical − reserved).
   */
  async allocationLanes(user: JwtUser, query: AllocationWithoutFilterQueryDto) {
    const { productId, franchiseId } = query;

    const fid =
      user.role === Role.SUPERADMIN
        ? franchiseId
        : franchiseHasReadAccess(user.role)
          ? user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId
          : null;
    if (!fid) throw new ForbiddenException();
    if (user.role === Role.SUPERADMIN && !franchiseId) {
      throw new BadRequestException(
        'franchiseId is required for superadmin allocation',
      );
    }
    const storeNode = await this.prisma.stockingNode.findFirst({
      where: { franchiseId: fid, type: StockingNodeType.STORE, active: true },
    });
    if (!storeNode) {
      return {
        franchiseId: fid,
        productId,
        stockingNodeId: null as string | null,
        candidates: [] as {
          laneId: string;
          laneCode: string;
          allocationPriority: number;
          originNodeCode: string;
          originNodeType: StockingNodeType;
          sourcePhysical: number;
          sourceReserved: number;
          sourceAvailable: number;
        }[],
      };
    }
    const lanes = await this.prisma.transportLane.findMany({
      where: { destNodeId: storeNode.id, active: true },
      orderBy: [{ allocationPriority: 'desc' }, { code: 'asc' }],
      include: {
        originNode: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });
    const candidates: {
      laneId: string;
      laneCode: string;
      allocationPriority: number;
      originNodeCode: string;
      originNodeType: StockingNodeType;
      sourcePhysical: number;
      sourceReserved: number;
      sourceAvailable: number;
    }[] = [];
    for (const lane of lanes) {
      const on = lane.originNode;
      let physical = 0;
      let reserved = 0;
      if (on.type === StockingNodeType.CENTRAL_DC) {
        const ws = await this.prisma.warehouseStock.findUnique({
          where: { productId },
        });
        physical = ws?.quantity ?? 0;
        reserved = ws?.reserved ?? 0;
      } else if (on.type === StockingNodeType.REGIONAL_HUB) {
        const hi = await this.prisma.hubInventory.findUnique({
          where: {
            stockingNodeId_productId: { stockingNodeId: on.id, productId },
          },
        });
        physical = hi?.quantity ?? 0;
        reserved = hi?.reserved ?? 0;
      }
      candidates.push({
        laneId: lane.id,
        laneCode: lane.code,
        allocationPriority: lane.allocationPriority,
        originNodeCode: on.code,
        originNodeType: on.type,
        sourcePhysical: physical,
        sourceReserved: reserved,
        sourceAvailable: Math.max(0, physical - reserved),
      });
    }
    return {
      franchiseId: fid,
      productId,
      stockingNodeId: storeNode.id,
      candidates,
    };
  }

  async allocationLanesFilterWithPagination(
    user: JwtUser,
    query: AllocationQueryDto,
  ) {
    const {
      productId,
      franchiseId,
      page = 1,
      limit = 10,
      order = OrderType.DESC,
    } = query;

    // 🔹 Build store filter
    const storeWhere: Prisma.StockingNodeWhereInput = {
      type: StockingNodeType.STORE,
      active: true,
    };

    if (user.role !== Role.SUPERADMIN) {
      if (!franchiseHasReadAccess(user.role)) {
        throw new ForbiddenException();
      }
      storeWhere.franchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
    }

    // ✅ Optional filter for SUPERADMIN
    if (user.role === Role.SUPERADMIN && franchiseId) {
      storeWhere.franchiseId = franchiseId;
    }

    // 🔹 Get store nodes
    const storeNodes = await this.prisma.stockingNode.findMany({
      where: storeWhere,
      select: { id: true },
    });

    if (!storeNodes.length) {
      return {
        productId,
        candidates: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const storeNodeIds = storeNodes.map((s) => s.id);

    // 🔹 Lane filter
    const laneWhere: Prisma.TransportLaneWhereInput = {
      destNodeId: { in: storeNodeIds },
      active: true,
    };

    const skip = (page - 1) * limit;

    // 🔹 Fetch lanes
    const [total, lanes] = await Promise.all([
      this.prisma.transportLane.count({ where: laneWhere }),
      this.prisma.transportLane.findMany({
        where: laneWhere,
        skip,
        take: limit,
        orderBy: [{ allocationPriority: order }, { code: 'asc' }],
        include: {
          originNode: {
            select: { id: true, code: true, type: true },
          },
        },
      }),
    ]);

    // =========================================================
    // ✅ CASE 1: NO productId → RETURN SIMPLE (NO STOCK LOGIC)
    // =========================================================
    if (!productId) {
      const candidates = lanes.map((lane) => ({
        laneId: lane.id,
        laneCode: lane.code,
        allocationPriority: lane.allocationPriority,
        originNodeCode: lane.originNode.code,
        originNodeType: lane.originNode.type,
      }));

      return {
        productId: null,
        candidates,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // =========================================================
    // ✅ CASE 2: productId EXISTS → FULL STOCK LOGIC
    // =========================================================

    const regionalHubIds = lanes
      .filter((l) => l.originNode.type === StockingNodeType.REGIONAL_HUB)
      .map((l) => l.originNode.id);

    const [warehouseStock, hubInventories] = await Promise.all([
      this.prisma.warehouseStock.findUnique({
        where: { productId },
      }),
      this.prisma.hubInventory.findMany({
        where: {
          productId,
          stockingNodeId: { in: regionalHubIds },
        },
      }),
    ]);

    const hubMap = new Map(hubInventories.map((h) => [h.stockingNodeId, h]));

    const candidates = lanes.map((lane) => {
      const node = lane.originNode;

      let physical = 0;
      let reserved = 0;

      if (node.type === StockingNodeType.CENTRAL_DC) {
        physical = warehouseStock?.quantity ?? 0;
        reserved = warehouseStock?.reserved ?? 0;
      } else if (node.type === StockingNodeType.REGIONAL_HUB) {
        const hub = hubMap.get(node.id);
        physical = hub?.quantity ?? 0;
        reserved = hub?.reserved ?? 0;
      }

      return {
        laneId: lane.id,
        laneCode: lane.code,
        allocationPriority: lane.allocationPriority,
        originNodeCode: node.code,
        originNodeType: node.type,
        sourcePhysical: physical,
        sourceReserved: reserved,
        sourceAvailable: Math.max(0, physical - reserved),
      };
    });

    return {
      productId,
      candidates,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Suggested reorder lines when outlet qty is at or below reorderPoint (policy-driven). */
  async suggestedOrders(user: JwtUser, query: SuggessionQueryDto) {
    const { franchiseId } = query;
    const fid =
      user.role === Role.SUPERADMIN
        ? franchiseId
        : franchiseHasReadAccess(user.role)
          ? user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId
          : null;
    if (!fid) throw new ForbiddenException();
    if (user.role === Role.SUPERADMIN && !franchiseId) {
      throw new BadRequestException(
        'franchiseId is required for superadmin suggestions',
      );
    }
    const stocks = await this.prisma.franchiseStock.findMany({
      where: { franchiseId: fid },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });

    const policies = await this.prisma.replenishmentPolicy.findMany({
      where: {
        franchiseId: fid,
        active: true,
        productId: { in: stocks.map((s) => s.productId) },
      },
    });

    const policyMap = new Map(policies.map((p) => [p.productId, p]));

    const suggestions: {
      productId: string;
      productName: string;
      currentQty: number;
      physicalOnHand: number;
      reserved: number;
      reorderPoint: number;
      maxQty: number;
      suggestedQty: number;
    }[] = [];

    for (const fs of stocks) {
      const p = policyMap.get(fs.productId);
      const q = Math.max(0, (fs.quantity ?? 0) - (fs.reserved ?? 0));
      const lowStockThreshold = fs.lowStockThreshold ?? 0;

      const reorderPoint = p ? p.reorderPoint : lowStockThreshold;
      const maxQty = p ? p.maxQty : lowStockThreshold * 2;

      if (q <= reorderPoint || q <= lowStockThreshold) {
        const suggestedQty = Math.max(0, maxQty - q);
        if (suggestedQty > 0) {
          suggestions.push({
            productId: fs.productId,
            productName: fs.product.name,
            currentQty: q,
            physicalOnHand: fs.quantity ?? 0,
            reserved: fs.reserved ?? 0,
            reorderPoint,
            maxQty,
            suggestedQty,
          });
        }
      }
    }
    return { franchiseId: fid, suggestions };
  }

  async suggestedOrdersWithFilterPagination(
    user: JwtUser,
    query: SuggessionQueryDto,
  ): Promise<{ data: unknown; meta: IMeta }> {
    const {
      franchiseId,
      page = 1,
      limit = 10,
      search,
      minQty,
      maxQty,
      order = OrderType.DESC,
    } = query;

    if (user.role === Role.SUPERADMIN && !franchiseId) {
      throw new BadRequestException(
        'franchiseId is required for superadmin suggestions',
      );
    }

    const fid =
      user.role === Role.SUPERADMIN
        ? franchiseId
        : franchiseHasReadAccess(user.role)
          ? user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId
          : null;

    if (!fid) throw new ForbiddenException();

    console.log(
      '[SUGGESTIONS DEBUG] fid:',
      fid,
      'userRole:',
      user.role,
      'search:',
      search,
    );

    const stocks = await this.prisma.franchiseStock.findMany({
      where: {
        franchiseId: fid,
        product: search
          ? { name: { contains: search, mode: 'insensitive' } }
          : undefined,
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
      },
    });

    console.log(
      '[SUGGESTIONS DEBUG] Total stocks found for fid:',
      stocks.length,
    );
    if (stocks.length > 0) {
      console.log(
        '[SUGGESTIONS DEBUG] First 3 stocks:',
        stocks.slice(0, 3).map((s) => ({
          productId: s.productId,
          name: s.product.name,
          qty: s.quantity,
          lowStockThreshold: s.lowStockThreshold,
        })),
      );
    }

    const policies = await this.prisma.replenishmentPolicy.findMany({
      where: {
        franchiseId: fid,
        active: true,
        productId: { in: stocks.map((s) => s.productId) },
      },
    });

    const policyMap = new Map(policies.map((p) => [p.productId, p]));

    const suggestions = stocks
      .map((fs: any) => {
        const p = policyMap.get(fs.productId);

        const physicalOnHand = fs.quantity ?? 0;
        const reserved = fs.reserved ?? 0;
        const currentQty = Math.max(0, physicalOnHand - reserved);
        const lowStockThreshold = fs.lowStockThreshold ?? 0;

        const reorderPoint = p ? p.reorderPoint : lowStockThreshold;
        const maxQty = p ? p.maxQty : lowStockThreshold * 2;

        if (
          fs.product.name.toLowerCase().includes('wedding') ||
          fs.product.name.toLowerCase().includes('garland') ||
          fs.product.name.toLowerCase().includes('stool')
        ) {
          console.log('[SUGGESTIONS DEBUG] Product match found in mapping:', {
            productId: fs.productId,
            name: fs.product.name,
            currentQty,
            reorderPoint,
            lowStockThreshold,
            hasPolicy: !!p,
            maxQty,
            suggestedQty: Math.max(0, maxQty - currentQty),
          });
        }

        if (currentQty > reorderPoint && currentQty > lowStockThreshold)
          return null;

        const suggestedQty = Math.max(0, maxQty - currentQty);
        if (suggestedQty <= 0) return null;

        return {
          franchiseId: fid,
          productId: fs.productId,
          productName: fs.product.name,
          currentQty,
          physicalOnHand,
          reserved,
          reorderPoint,
          maxQty,
          suggestedQty,
        };
      })
      .filter(
        (
          item,
        ): item is {
          franchiseId: string;
          productId: string;
          productName: string;
          currentQty: number;
          physicalOnHand: number;
          reserved: number;
          reorderPoint: number;
          maxQty: number;
          suggestedQty: number;
        } => Boolean(item),
      )
      .filter((item) => {
        if (minQty !== undefined && item.currentQty < minQty) return false;
        if (maxQty !== undefined && item.currentQty > maxQty) return false;
        return true;
      });

    suggestions.sort((a, b) => {
      const diff =
        order === OrderType.ASC
          ? a.currentQty - b.currentQty
          : b.currentQty - a.currentQty;

      return diff !== 0 ? diff : a.productName.localeCompare(b.productName);
    });

    const total = suggestions.length;
    const currentPage = page ?? 1;
    const pageLimit = limit ?? 10;
    const skip = (currentPage - 1) * pageLimit;
    const data = suggestions.slice(skip, skip + pageLimit);

    return {
      data,
      meta: {
        count: total,
        page: currentPage,
        limit: pageLimit,
        totalPages: total > 0 ? Math.ceil(total / pageLimit) : 0,
      },
    };
  }

  async eventTimelineWithoutPagination(
    user: JwtUser,
    query: EventTimeLineQueryDto,
  ) {
    const take = Math.min(Math.max(query.taken ?? 100, 1), 500);
    const where: Prisma.SupplyChainEventWhereInput = {};
    if (query.productId) where.productId = query.productId;
    if (query.eventName) where.eventName = query.eventName;
    if (query.stockingNodeId) where.stockingNodeId = query.stockingNodeId;
    if (user.role !== Role.SUPERADMIN) {
      const allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      if (!franchiseHasReadAccess(user.role) || !allowedFranchiseId)
        throw new ForbiddenException();
      const node = await this.prisma.stockingNode.findFirst({
        where: { franchiseId: allowedFranchiseId },
      });
      const stocked = await this.prisma.franchiseStock.findMany({
        where: { franchiseId: allowedFranchiseId },
        select: { productId: true },
      });
      const pidSet = stocked.map((s) => s.productId);
      const or: Prisma.SupplyChainEventWhereInput[] = [];
      if (node) or.push({ stockingNodeId: node.id });
      if (pidSet.length) or.push({ productId: { in: pidSet } });
      if (!or.length) return [];
      const prevAnd = where.AND
        ? Array.isArray(where.AND)
          ? where.AND
          : [where.AND]
        : [];
      where.AND = [...prevAnd, { OR: or }];
    }
    return this.prisma.supplyChainEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        product: { select: { id: true, slug: true, name: true } },
        stockingNode: { select: { id: true, code: true, type: true } },
      },
    });
  }

  async eventTimeline(user: JwtUser, query: EventTimeLineQueryDto) {
    const { taken: takeQuery } = query;

    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
        OR: [
          {
            eventName: { contains: search, mode: 'insensitive' },
          },
        ],
      }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.productId) {
      clauses.push({ productId: q.productId });
    }

    if (query.stockingNodeId) {
      clauses.push({ stockingNodeId: q.stockingNodeId });
    }

    if (q.eventName) {
      clauses.push({
        eventName: {
          contains: q.eventName,
          mode: 'insensitive',
        },
      });
    }

    const take = Math.min(Math.max(takeQuery ?? 100, 1), 500);

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    // const limit = q.limit ?? 10;
    const orderBy = this.buildReplenishmentSortOrder(q.sortBy, q.order);

    if (user.role !== Role.SUPERADMIN) {
      const allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      if (!franchiseHasReadAccess(user.role) || !allowedFranchiseId) {
        throw new ForbiddenException();
      }

      const [node, stocked] = await Promise.all([
        this.prisma.stockingNode.findFirst({
          where: { franchiseId: allowedFranchiseId },
          select: { id: true },
        }),
        this.prisma.franchiseStock.findMany({
          where: { franchiseId: allowedFranchiseId },
          select: { productId: true },
        }),
      ]);

      const productIds = stocked.map((s) => s.productId);

      if (!node && productIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, take, totalPages: 0 },
        };
      }

      clauses.push({
        OR: [
          ...(node ? [{ stockingNodeId: node.id }] : []),
          ...(productIds.length ? [{ productId: { in: productIds } }] : []),
        ],
      });
    }

    const paged = await paginatePrisma<any>({
      model: this.prisma.supplyChainEvent as any,
      where,
      orderBy,
      page,
      limit: take,
      include: {
        variant: { select: { id: true, sku: true } },
        product: {
          select: { id: true, slug: true, name: true, variants: true },
        },
        stockingNode: { select: { id: true, code: true, type: true } },
      },
    });

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;
  }

  async listOutbox(
    user: JwtUser,
    query: OutboxQueryDto,
  ): Promise<{ data: DomainEventOutbox[]; meta: IMeta }> {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    if (user.role !== Role.SUPERADMIN) throw new ForbiddenException();
    const search = q.search?.trim();

    const searchFilter = search
      ? {
        OR: [
          {
            eventName: { contains: search, mode: 'insensitive' },
          },
        ],
      }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (query.franchiseId) {
      clauses.push({
        payload: {
          path: ['franchiseId'],
          equals: query.franchiseId,
        },
      });
    }

    if (query.stockRequestId) {
      clauses.push({
        payload: {
          path: ['stockRequestId'],
          equals: query.stockRequestId,
        },
      });
    }

    if (query.status) {
      clauses.push({ status: q.status });
    }

    if (query.fromDate || query.lastDate) {
      const createdAt = buildPrismaDateRangeFilter({
        fromDate: query.fromDate,
        toDate: query.lastDate,
      });

      clauses.push({ createdAt });
    }

    const allowedFranchiseId =
      (user.role as any) === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (
      (user.role as any) !== Role.SUPERADMIN &&
      franchiseHasReadAccess(user.role) &&
      allowedFranchiseId
    ) {
      clauses.push({ franchiseId: allowedFranchiseId });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 200;
    const orderBy = this.buildOutBoxSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.domainEventOutbox as any,
      where,
      orderBy,
      page,
      limit,
    });

    const result = {
      data: paged.data || [],
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;

    // if (user.role !== Role.SUPERADMIN) throw new ForbiddenException();
    // const lim = Math.min(Math.max(take, 1), 200);
    // const st =
    //   status && (Object.values(DomainOutboxStatus) as string[]).includes(status)
    //     ? (status as DomainOutboxStatus)
    //     : undefined;
    // return this.prisma.domainEventOutbox.findMany({
    //   where: st ? { status: st } : undefined,
    //   orderBy: { createdAt: 'desc' },
    //   take: lim,
    // });
  }
}
