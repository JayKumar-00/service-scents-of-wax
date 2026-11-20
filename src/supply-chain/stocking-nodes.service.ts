import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StockingNode, StockingNodeType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListNodeQueryDto } from './dto/list-node-query.dto';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { CreateStockingNodeDto } from './dto/create-stocking-node.dto';
import { franchiseHasReadAccess } from '../common/franchise-roles';
import { AuditService } from '../audit/audit.service';

// ─── case map: StockingNodeType → the Prisma model that holds the stock records ───
interface TypeModelEntry {
  model: string;
  /** path to the FK that links to Product / StockingNode; for join-reads */
  productIdKey: string;
  stockNodeIdKey?: string;
  /** true  → filter by stockNode.type = []; false / undefined → no type filter */
  filterByStockingNodeType?: StockingNodeType[];
  /** strategy key understood by _fetchRows */
  strategy: 'global' | 'nodeJoin' | 'byFranchise';
}

const STOCKING_NODE_TYPE_MODEL_MAP: ReadonlyMap<
  StockingNodeType,
  TypeModelEntry
> = new Map([
  [
    StockingNodeType.CENTRAL_DC,
    {
      model: 'warehouseStock',
      productIdKey: 'productId',
      strategy: 'global',
    },
  ],
  [
    StockingNodeType.REGIONAL_HUB,
    {
      model: 'hubInventory',
      productIdKey: 'productId',
      stockNodeIdKey: 'stockingNodeId',
      filterByStockingNodeType: [StockingNodeType.REGIONAL_HUB],
      strategy: 'nodeJoin',
    },
  ],
  [
    StockingNodeType.STORE,
    {
      model: 'franchiseStock',
      productIdKey: 'productId',
      strategy: 'byFranchise',
      // key = franchiseId resolved at call-time
    } as TypeModelEntry,
  ],
  [
    StockingNodeType.WAREHOUSE_STOCK,
    {
      model: 'warehouseStock',
      productIdKey: 'productId',
      strategy: 'global',
    },
  ],
]);

// ─── shared result shape ───
type StockInventoryRow = {
  id: string;
  source: StockingNodeType;
  productId: string;
  product: { id: string; name: string; slug: string } | null;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold?: number | null;
  stockNode?: {
    id: string;
    code: string;
    name: string;
    type: StockingNodeType;
  } | null;
  franchiseId?: string | null;
  franchise?: { id: string; code: string; name: string } | null;
  variant: { id: string; sku: string; attributeSummary: string } | null;
};

type StockingNodeInventoryItem = {
  stockingNodeId: string;
  productId: string;
  quantity: number;
  reserved: number;
  product?: { id: string; name: string; slug: string } | null;
};

type StockingNodeWithInventories = StockingNode & {
  hubInventories?: StockingNodeInventoryItem[];
};

type StockingNodeWithProducts = StockingNodeWithInventories & {
  products: Array<{
    productId: string;
    quantity: number;
    reserved: number;
    available: number;
    product?: { id: string; name: string; slug: string } | null;
  }>;
};

@Injectable()
export class StockingNodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) { }

  private buildStockChainSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'code', 'name', 'type']);

  /**
   * **case-map aware**: reads STOCKING_NODE_TYPE_MODEL_MAP for the given node type(s)
   * and returns inventory rows, each carrying the full product.
   *
   * Usage:
   *   this.withProducts([WAREHOUSE_STOCK, REGIONAL_HUB, STORE])
   *   this.withProducts([WAREHOUSE_STOCK])           // DC / WAREHOUSE_STOCK only
   *   this.withProducts()                            // all four types
   */
  async withProducts(
    types: StockingNodeType | StockingNodeType[] = Object.values(
      StockingNodeType,
    ) as StockingNodeType[],
    user?: JwtUser,
    query?: any,
  ): Promise<StockInventoryRow[]> {
    const targetTypes = Array.isArray(types) ? types : [types];
    const allRows: StockInventoryRow[] = [];

    // Resolve allowedFranchiseId at the very beginning of the function
    let allowedFranchiseId: string | undefined = undefined;
    if (user && franchiseHasReadAccess(user.role)) {
      allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
    } else if (query?.franchiseId) {
      allowedFranchiseId = query.franchiseId;
    }

    // CENTRAL_DC and WAREHOUSE_STOCK both read 'warehouseStock' in global mode
    const typesNeedingNodeFilter = targetTypes.filter(
      (t) =>
        STOCKING_NODE_TYPE_MODEL_MAP.get(t)?.filterByStockingNodeType?.length,
    );

    // Hub types: pre-load StockingNode rows so we know which node IDs are hubs
    let hubNodesById: Map<string, StockingNode> | null = null;
    if (typesNeedingNodeFilter.length) {
      const hubNodeRows = await this.prisma.stockingNode.findMany({
        where: {
          type: { in: typesNeedingNodeFilter.flatMap((t) => t) },
          active: true,
        },
        include: {
          franchise: { select: { id: true, code: true, name: true } },
        },
      });
      hubNodesById = new Map(hubNodeRows.map((n) => [n.id, n]));
    }

    // Store types: pre-load franchise nodes
    let storeNodesByFranchiseId: Map<string, any> | null = null;
    if (targetTypes.includes(StockingNodeType.STORE)) {
      const storeNodeRows = await this.prisma.stockingNode.findMany({
        where: {
          type: StockingNodeType.STORE,
          active: true,
          ...(allowedFranchiseId ? { franchiseId: allowedFranchiseId } : {}),
        },
        include: {
          franchise: { select: { id: true, code: true, name: true } },
        },
      });
      storeNodesByFranchiseId = new Map(
        storeNodeRows.map((n) => [n.franchiseId!, n]),
      );
    }

    for (const nodeType of targetTypes) {
      const entry = STOCKING_NODE_TYPE_MODEL_MAP.get(nodeType);
      if (!entry) continue;

      if (entry.strategy === 'global') {
        // CENTRAL_DC / WAREHOUSE_STOCK → one-row-per-product WarehouseStock
        // If allowedFranchiseId is set, global strategy has no franchiseId, so skip it entirely
        if (allowedFranchiseId) {
          continue;
        }

        const rows = await this.prisma.warehouseStock.findMany({
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                variants: {
                  take: 1,
                  where: { isActive: true },
                  select: {
                    id: true,
                    sku: true,
                    attributeSummary: true,
                  },
                },
              },
            },
          },
        });
        allRows.push(
          ...rows.map((r) => ({
            id: r.productId,
            source: nodeType,
            productId: r.productId,
            product: r.product
              ? { id: r.product.id, name: r.product.name, slug: r.product.slug }
              : null,
            quantity: r.quantity,
            reserved: r.reserved,
            available: Math.max(0, r.quantity - r.reserved),
            lowStockThreshold: r.lowStockThreshold,
            variant: r.product?.variants?.[0] ?? null,
          })),
        );
      } else if (entry.strategy === 'nodeJoin' && hubNodesById) {
        // REGIONAL_HUB → HubInventory joined with StockingNode = hub
        const allHubs = await this.prisma.hubInventory.findMany({
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                variants: {
                  take: 1,
                  where: { isActive: true },
                  select: {
                    id: true,
                    sku: true,
                    attributeSummary: true,
                  },
                },
              },
            },
            stockingNode: true,
          },
        });
        const hubTypeSet = new Set(
          (entry.filterByStockingNodeType ?? []).map((t) => t),
        );
        for (const hub of allHubs) {
          const matchedNode = hubNodesById.get(hub.stockingNodeId);
          if (!matchedNode || !hubTypeSet.has(matchedNode.type)) continue;

          // If the hub node is associated with a franchise, filter by allowedFranchiseId
          if (
            allowedFranchiseId &&
            matchedNode.franchiseId &&
            matchedNode.franchiseId !== allowedFranchiseId
          ) {
            continue;
          }

          allRows.push({
            id: `${hub.stockingNodeId}:${hub.productId}`,
            source: nodeType,
            productId: hub.productId,
            product: hub.product
              ? {
                id: hub.product.id,
                name: hub.product.name,
                slug: hub.product.slug,
              }
              : null,
            quantity: hub.quantity,
            reserved: hub.reserved,
            available: Math.max(0, hub.quantity - hub.reserved),
            stockNode: {
              id: matchedNode.id,
              code: matchedNode.code,
              name: matchedNode.name,
              type: matchedNode.type,
            },
            franchiseId: matchedNode.franchiseId,
            franchise: (matchedNode as any).franchise ?? null,
            variant: hub.product?.variants?.[0] ?? null,
          });
        }
      } else if (entry.strategy === 'byFranchise' && storeNodesByFranchiseId) {
        // STORE → FranchiseStock joined with frozen store-node list
        const franchiseIds = [...storeNodesByFranchiseId.keys()];
        const storeStocks =
          franchiseIds.length > 0
            ? await this.prisma.franchiseStock.findMany({
              where: { franchiseId: { in: franchiseIds } },
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    variants: {
                      take: 1,
                      where: { isActive: true },
                      select: {
                        id: true,
                        sku: true,
                        attributeSummary: true,
                      },
                    },
                  },
                },
              },
            })
            : [];
        for (const s of storeStocks) {
          const node = storeNodesByFranchiseId.get(s.franchiseId);
          allRows.push({
            id: `${s.franchiseId}:${s.productId}`,
            source: nodeType,
            productId: s.productId,
            product: s.product
              ? { id: s.product.id, name: s.product.name, slug: s.product.slug }
              : null,
            quantity: s.quantity,
            reserved: s.reserved,
            available: Math.max(0, s.quantity - s.reserved),
            lowStockThreshold: s.lowStockThreshold,
            franchiseId: s.franchiseId,
            franchise: node?.franchise ?? null,
            variant: s.product?.variants?.[0] ?? null,
          });
        }
      }
    }

    return allRows;
  }

  /**
   * Existing per-node helper (works on a single node's hubInventories join).
   * Kept for backward compatibility with the `GET /nodes/:id` endpoint.
   */
  private _withProducts(
    node: StockingNodeWithInventories,
  ): StockingNodeWithProducts {
    return {
      ...node,
      products: (node.hubInventories ?? []).map((inventory) => ({
        productId: inventory.productId,
        quantity: inventory.quantity,
        reserved: inventory.reserved,
        available: Math.max(0, inventory.quantity - inventory.reserved),
        product: inventory.product ?? null,
      })),
    };
  }

  async list(
    user: JwtUser,
    query: ListNodeQueryDto,
  ): Promise<{ data: StockingNode[]; meta: IMeta }> {
    const q: any = query ?? {};
    const clauses: Record<string, unknown>[] = [];

    const search = q.search?.trim();

    const searchFilter = search
      ? {
        OR: [
          {
            name: { contains: search, mode: 'insensitive' },
          },
          {
            franchise: {
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

    if (query.type) {
      clauses.push({ type: q.type });
    }

    if (query.parentId) {
      clauses.push({ parentId: q.parentId });
    }

    if (user.role !== Role.SUPERADMIN) {
      const allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      clauses.push({ franchise: { id: allowedFranchiseId } });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const orderBy = this.buildStockChainSortOrder(q.sortBy, q.order);

    const paged = await paginatePrisma<any>({
      model: this.prisma.stockingNode as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        franchise: { select: { id: true, code: true, name: true } },
        hubInventories: {
          include: {
            product: true,
          },
        },
      },
    });

    const result = {
      data: (paged.data || []).map((node: StockingNodeWithProducts) =>
        this._withProducts(node),
      ),
      meta: paged.meta,
    };

    // await this.redisService.set(cacheKey, result);

    return result;

    // return this.prisma.stockingNode.findMany({
    //   orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    //   include: { franchise: { select: { id: true, code: true, name: true } } },
    // });
  }

  async ensureCentralDc(actor?: {
    userId: string;
    ip?: string | null;
  }): Promise<{ id: string }> {
    const existing = await this.prisma.stockingNode.findFirst({
      where: { type: StockingNodeType.CENTRAL_DC, code: 'CENTRAL' },
    });
    if (existing) return existing;
    const node = await this.prisma.stockingNode.create({
      data: {
        type: StockingNodeType.CENTRAL_DC,
        name: 'National DC',
        code: 'CENTRAL',
        sortOrder: 0,
      },
    });
    if (actor) {
      await this.audit.log({
        userId: actor.userId,
        action: 'stocking_node.create_central',
        resource: 'Warehouse',
        resourceId: node.id,
        metadata: { name: node.name, code: node.code, type: node.type },
        ip: actor.ip,
      });
    }
    return node;
  }

  async create(
    user: JwtUser,
    data: CreateStockingNodeDto,
    ip: string
  ) {
    if (data.type === StockingNodeType.STORE && !data.franchiseId) {
      throw new BadRequestException('STORE nodes require franchiseId');
    }
    if (data.type !== StockingNodeType.STORE && data.franchiseId) {
      throw new BadRequestException(
        'franchiseId is only valid for STORE nodes',
      );
    }
    if (data.parentId) {
      const p = await this.prisma.stockingNode.findUnique({
        where: { id: data.parentId },
      });
      if (!p) throw new BadRequestException('Parent node not found');
    }
    try {
      const node = await this.prisma.stockingNode.create({
        data: {
          type: data.type,
          name: data.name,
          code: data.code.trim(),
          parentId: data.parentId ?? undefined,
          franchiseId: data.franchiseId ?? undefined,
          sortOrder: data.sortOrder ?? 0,
        },
        include: {
          franchise: { select: { id: true, code: true, name: true } },
        },
      });

      if (user.sub) {
        const resource =
          data.type === StockingNodeType.STORE ? 'Franchise' : 'Warehouse';
        await this.audit.log({
          userId: user.sub,
          action: 'stocking_node.create',
          resource,
          resourceId: node.id,
          metadata: {
            name: node.name,
            code: node.code,
            type: node.type,
            franchiseId: node.franchiseId,
          },
          ip: ip,
        });
      }

      return node;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Code or franchise already mapped to a node',
        );
      }
      throw e;
    }
  }

  async get(id: string) {
    const row = await this.prisma.stockingNode.findUnique({
      where: { id },
      include: {
        franchise: { select: { id: true, code: true, name: true } },
        parent: true,
        hubInventories: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Node not found');
    return this._withProducts(row as StockingNodeWithInventories);
  }

  /** Paginate all inventory rows (global + hub + store) with full product detail. */
  async listNodeInventory(
    user: JwtUser,
    query: any,
  ): Promise<{ data: StockInventoryRow[]; meta: IMeta }> {
    const q: any = query ?? {};
    const page = Math.max(1, Math.floor(Number(q.page ?? 1) || 1));
    const limit = Math.max(1, Math.floor(Number(q.limit ?? 10) || 10));

    let targetTypes: StockingNodeType[] = Object.values(StockingNodeType);

    // FILTER by StockingNodeType if provided
    if (q.type) {
      if (!Object.values(StockingNodeType).includes(q.type)) {
        throw new NotFoundException(`Unknown StockingNodeType: ${q.type}`);
      }
      targetTypes = [q.type];
    }

    const allRows = await this.withProducts(targetTypes, user, query);

    // SEARCH
    const search = q.search?.trim().toLowerCase();
    let filtered = allRows.filter((row) => {
      if (!search) return true;
      const haystack = [
        row.product?.name,
        row.product?.slug,
        row.productId,
        row.stockNode?.code,
        row.stockNode?.name,
        row.franchise?.code,
        row.franchise?.name,
      ]
        .filter((v): v is string => Boolean(v))
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });

    // minQty / maxQty filter
    if (q.minQty !== null && q.minQty !== undefined) {
      const minVal = Number(q.minQty);
      filtered = filtered.filter((r) => r.quantity >= minVal);
    }
    if (q.maxQty !== null && q.maxQty !== undefined) {
      const maxVal = Number(q.maxQty);
      filtered = filtered.filter((r) => r.quantity <= maxVal);
    }

    const total = filtered.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, meta: { count: total, totalPages, page, limit } };
  }
}
