import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FranchiseReturnStatus,
  OrderChannel,
  Prisma,
  ProductStatus,
  Role,
} from '@prisma/client';
import { JwtUser } from '../auth/types/jwt-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProductReturnCreateDto,
  ReturnItemCondition,
  ReturnRequestRejectDto,
  ReturnRefundInventoryItemDto,
} from './dto/product-return-create.dto';
import {
  ProductReturnFilteredQueryDto,
  ReturnInventoryQueryDto,
} from './dto/product-return-filtered-query.dto';
import {
  ProductReturnListQueryDto,
  ProductReturnSourceType,
} from './dto/product-return-list-query.dto';
import { ReturnInventoryEnum } from './enums/return-inventory.enum';
import { OrderType } from '../common/dto/query.dto';
import {
  buildDateFilter,
  normalizePositiveInteger,
} from '../common/utils/pagination.util';

type Transaction = Prisma.TransactionClient;

type NormalizedReturnLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  condition?: ReturnItemCondition;
};

type OrderSourceItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
  productName: string | null;
  sku: string | null;
  variantName: string | null;
  unitPrice: Prisma.Decimal;
  mrpPrice: Prisma.Decimal | null;
  gstPercent: Prisma.Decimal | null;
  imageUrl: string | null;
};

type OrderSourceItemRecord = {
  productId: string;
  variantId: string | null;
  quantity: number;
  productName?: string | null;
  sku?: string | null;
  variantName?: string | null;
  unitPrice: Prisma.Decimal;
  mrpPrice?: Prisma.Decimal | null;
  gstPercent?: Prisma.Decimal | null;
  imageUrl?: string | null;
  product?: {
    name?: string | null;
    slug?: string | null;
    imageUrl?: string | null;
    mrpPrice?: Prisma.Decimal | null;
    price?: Prisma.Decimal | null;
  } | null;
};

type ReturnLineSnapshot = {
  productId: string;
  variantId: string | null;
  condition?: ReturnItemCondition;
  quantity: number;
  productName: string;
  sku: string;
  variantName: string | null;
  unitPrice: string;
  totalAmount: string;
  mrpPrice: string | null;
  gstPercent: string;
  imageUrl: string | null;
};

type VariantDisplayInfo = {
  displayName: string | null;
  attributeTitles: string[];
};

type ReturnProcessingResult = {
  returnRecord: any;
  defectiveInventory: unknown[];
  conflictInventory: unknown[];
  returnInventory: unknown[];
};

type PreparedReturnDraft = {
  order: Awaited<ReturnType<ProductReturnService['loadOrder']>> | null;
  stockRequest: Awaited<
    ReturnType<ProductReturnService['loadStockRequest']>
  > | null;
  sourceType: 'ORDER' | 'STOCK_REQUEST';
  sourceId: string;
  oldSnapshots: ReturnLineSnapshot[];
  newSnapshots: ReturnLineSnapshot[];
  oldTotal: Prisma.Decimal;
  newTotal: Prisma.Decimal;
  groupedOldItems: NormalizedReturnLine[];
  groupedNewItems: NormalizedReturnLine[];
};

@Injectable()
export class ProductReturnService {
  constructor(private readonly prisma: PrismaService) {}
  private stockRequestColumnSupported?: boolean;

  private isAdminUser(user: JwtUser) {
    return user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;
  }

  // ======================================
  // HELPERS
  // ======================================

  private decimal(value: Prisma.Decimal | number | string | null | undefined) {
    return new Prisma.Decimal(value ?? 0);
  }

  private money(value: Prisma.Decimal | number | string | null | undefined) {
    return this.decimal(value).toFixed(2);
  }

  private normalizeKey(productId: string, variantId?: string | null) {
    return `${productId}::${variantId ?? ''}`;
  }

  private getSnapshotVariantIds(
    items: Prisma.JsonValue | null | undefined,
  ): string[] {
    if (!Array.isArray(items)) {
      return [];
    }

    const variantIds = new Set<string>();

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const variantId = (item as { variantId?: unknown }).variantId;
      if (typeof variantId === 'string' && variantId.trim().length > 0) {
        variantIds.add(variantId);
      }
    }

    return [...variantIds];
  }

  private async getVariantDisplayInfoMap(
    db:
      | Pick<PrismaService, 'productVariant'>
      | Pick<Transaction, 'productVariant'>,
    items: Prisma.JsonValue | null | undefined,
  ): Promise<Map<string, VariantDisplayInfo>> {
    const variantIds = this.getSnapshotVariantIds(items);
    if (variantIds.length === 0) {
      return new Map<string, VariantDisplayInfo>();
    }

    const variants = await db.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        attributes: {
          include: {
            attributeValue: {
              select: {
                id: true,
                title: true,
                attributeNameId: true,
              },
            },
          },
        },
      },
    });

    return new Map(
      variants.map(
        (variant: any) =>
          [variant.id, this.getVariantDisplayInfo(variant)] as [
            string,
            VariantDisplayInfo,
          ],
      ),
    );
  }

  private async hydrateSnapshotVariants(
    db:
      | Pick<PrismaService, 'productVariant'>
      | Pick<Transaction, 'productVariant'>,
    items: Prisma.JsonValue | null | undefined,
  ) {
    if (!Array.isArray(items)) {
      return items;
    }

    const variantDisplayInfoMap = await this.getVariantDisplayInfoMap(
      db,
      items,
    );

    return items.map((item) => {
      if (!item || typeof item !== 'object') {
        return item;
      }

      const snapshot = item as {
        variantId?: string | null;
        variantName?: string | null;
        productName?: string | null;
        sku?: string | null;
      };
      const variantId = snapshot.variantId;
      const displayInfo = variantId
        ? (variantDisplayInfoMap.get(variantId) ?? null)
        : null;
      const variantName = this.firstMeaningfulText(
        displayInfo?.displayName,
        snapshot.variantName,
        snapshot.sku,
      );
      const title = this.firstMeaningfulText(
        snapshot.productName,
        snapshot.sku,
        variantName,
      );

      return {
        ...snapshot,
        title,
        variantName,
        variantTitle: variantName,
        attributeValueTitles: displayInfo?.attributeTitles ?? [],
      };
    });
  }

  private async hydrateReturnRecordVariants<
    T extends {
      oldItems: Prisma.JsonValue | null;
      newItems: Prisma.JsonValue | null;
    },
  >(db: any, record: T) {
    /* db type we can
    db:
      | Pick<PrismaService, 'productVariant'>
      | Pick<Transaction, 'productVariant'>,
      */
    return {
      ...record,
      oldItems: await this.hydrateSnapshotVariants(db, record.oldItems),
      newItems: await this.hydrateSnapshotVariants(db, record.newItems),
    };
  }

  private async hydrateReturnRecordForRead<
    T extends {
      customerId?: string | null;
      oldItems: Prisma.JsonValue | null;
      newItems: Prisma.JsonValue | null;
      order?: {
        customerId?: string | null;
        customer?: {
          id: string;
          name: string | null;
          altEmail: string | null;
          user?: { email: string | null } | null;
        } | null;
        retailCustomer?: {
          name: string;
          email: string | null;
        } | null;
      } | null;
    },
  >(db: PrismaService | Transaction, record: T) {
    const hydrated = await this.hydrateReturnRecordVariants(db, record);

    let email =
      hydrated.order?.customer?.user?.email ??
      hydrated.order?.customer?.altEmail ??
      hydrated.order?.retailCustomer?.email ??
      null;

    if (!email && hydrated.order?.customerId) {
      try {
        // Fallback: fetch email directly if stripped from nested relation by Prisma extensions
        const user = await db.user.findUnique({
          where: { id: hydrated.order.customerId },
          select: { email: true },
        });
        if (user?.email) email = user.email;
      } catch (err) {}
    }

    return {
      ...hydrated,
      customerId: hydrated.customerId ?? hydrated.order?.customerId ?? null,
      customerName:
        hydrated.order?.retailCustomer?.name ??
        hydrated.order?.customer?.name ??
        null,
      email,
    };
  }

  private getVariantAttributeValueTitles(
    variant: {
      attributeSummary?: string | null;
      attributes?: Array<{
        attributeValue?: {
          title?: string | null;
        } | null;
      }>;
    } | null,
  ) {
    return (
      variant?.attributes
        ?.map((attribute) => attribute.attributeValue?.title?.trim())
        .filter((title): title is string => Boolean(title)) ?? []
    );
  }

  private isMeaningfulDisplayText(value?: string | null) {
    if (!value) {
      return false;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }

    return !/^[a-z0-9_-]{12,}(:[a-z0-9_-]{12,})+$/i.test(trimmed);
  }

  private firstMeaningfulText(...values: Array<string | null | undefined>) {
    for (const value of values) {
      if (this.isMeaningfulDisplayText(value)) {
        return value!.trim();
      }
    }

    return null;
  }

  private getVariantDisplayName(
    variant: {
      attributeSummary?: string | null;
      attributes?: Array<{
        attributeValue?: {
          title?: string | null;
        } | null;
      }>;
    } | null,
  ) {
    const summary = variant?.attributeSummary?.trim();
    if (this.isMeaningfulDisplayText(summary)) {
      return summary ?? null;
    }

    const titles = this.getVariantAttributeValueTitles(variant);
    return titles.length > 0 ? titles.join(' | ') : null;
  }

  private getVariantDisplayInfo(
    variant: {
      sku?: string | null;
      attributeSummary?: string | null;
      attributes?: Array<{
        attributeValue?: {
          title?: string | null;
        } | null;
      }>;
    } | null,
  ): VariantDisplayInfo {
    const attributeTitles = this.getVariantAttributeValueTitles(variant);
    const displayName =
      this.getVariantDisplayName(variant) ??
      this.firstMeaningfulText(variant?.sku) ??
      null;

    return {
      displayName,
      attributeTitles,
    };
  }

  private groupItems(items: ReturnRefundInventoryItemDto[]) {
    const grouped = new Map<string, NormalizedReturnLine>();

    for (const item of items) {
      const key = this.normalizeKey(item.productId, item.variantId ?? null);
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        continue;
      }

      grouped.set(key, {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        condition: item.condition,
      });
    }

    return [...grouped.values()];
  }

  private getOrderSourceItem(item: OrderSourceItemRecord): OrderSourceItem {
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      productName:
        item.productName ?? item.product?.name ?? item.product?.slug ?? null,
      sku: item.sku ?? item.product?.slug ?? item.product?.name ?? null,
      variantName: item.variantName ?? null,
      unitPrice: item.unitPrice,
      mrpPrice: item.mrpPrice ?? item.product?.mrpPrice ?? null,
      gstPercent: item.gstPercent ?? null,
      imageUrl: item.imageUrl ?? item.product?.imageUrl ?? null,
    };
  }

  private async loadOrder(tx: Transaction, orderNumber: string) {
    return tx.order.findUnique({
      where: { orderNumber },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            altEmail: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        retailCustomer: true,
        items: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                imageUrl: true,
                mrpPrice: true,
                price: true,
              },
            },
            variant: {
              include: {
                attributes: {
                  include: {
                    attributeValue: {
                      select: {
                        id: true,
                        title: true,
                        attributeNameId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        franchise: true,
      },
    });
  }

  private async loadStockRequest(tx: Transaction, stockRequestId: string) {
    return tx.stockRequest.findUnique({
      where: { id: stockRequestId },
      include: {
        franchise: true,
        product: true,
        variant: {
          include: {
            attributes: {
              include: {
                attributeValue: {
                  select: {
                    id: true,
                    title: true,
                    attributeNameId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private async loadCatalogItem(
    tx: Transaction,
    productId: string,
    variantId?: string | null,
  ) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException(`Product ${productId} not found or inactive`);
    }

    const variant = variantId
      ? await tx.productVariant.findUnique({
          where: { id: variantId },
          include: {
            attributes: {
              include: {
                attributeValue: {
                  select: {
                    id: true,
                    title: true,
                    attributeNameId: true,
                  },
                },
              },
            },
          },
        })
      : null;

    if (variantId) {
      if (!variant || variant.productId !== product.id || !variant.isActive) {
        throw new NotFoundException(
          `Variant ${variantId} not found or inactive for product ${productId}`,
        );
      }
    }

    const unitPrice = variant
      ? this.decimal(variant.price)
      : this.decimal(product.price);

    const mrpPrice = variant?.mrpPrice ?? product.mrpPrice ?? null;
    const gstPercent = variant
      ? this.decimal(variant.gstTax ?? product.defaultGstRatePercent ?? 0)
      : this.decimal(product.defaultGstRatePercent ?? 0);

    return {
      productName: product.name,
      sku: variant?.sku ?? product.slug,
      variantName: this.getVariantDisplayName(variant),
      unitPrice,
      mrpPrice,
      gstPercent,
      imageUrl: variant?.imageUrl ?? product.imageUrl ?? null,
    };
  }

  private snapshotLine(input: {
    productId: string;
    variantId: string | null;
    condition?: ReturnItemCondition;
    quantity: number;
    productName: string;
    sku: string;
    variantName: string | null;
    unitPrice: Prisma.Decimal;
    mrpPrice: Prisma.Decimal | null;
    gstPercent: Prisma.Decimal;
    imageUrl: string | null;
  }): ReturnLineSnapshot {
    const totalAmount = input.unitPrice.mul(input.quantity).toFixed(2);

    return {
      productId: input.productId,
      variantId: input.variantId,
      condition: input.condition,
      quantity: input.quantity,
      productName: input.productName,
      sku: input.sku,
      variantName: input.variantName,
      unitPrice: input.unitPrice.toFixed(2),
      totalAmount,
      mrpPrice: input.mrpPrice != null ? this.money(input.mrpPrice) : null,
      gstPercent: input.gstPercent.toFixed(2),
      imageUrl: input.imageUrl,
    };
  }

  private async incrementFranchiseStock(
    tx: Transaction,
    franchiseId: string,
    productId: string,
    quantity: number,
    variantId?: string | null,
  ) {
    const vId = variantId || '';
    await tx.franchiseStock.upsert({
      where: {
        franchiseId_productId_variantId: {
          franchiseId,
          productId,
          variantId: vId,
        },
      },
      create: {
        franchiseId,
        productId,
        variantId: vId,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
    });
  }

  private async incrementWarehouseStock(
    tx: Transaction,
    productId: string,
    quantity: number,
  ) {
    await tx.warehouseStock.upsert({
      where: { productId },
      create: { productId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  private async incrementCatalogStock(
    tx: Transaction,
    productId: string,
    quantity: number,
    variantId?: string | null,
  ) {
    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });

    if (variantId) {
      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: { increment: quantity } },
      });
    }
  }

  private async decrementFranchiseStock(
    user: JwtUser,
    tx: Transaction,
    franchiseId: string,
    productId: string,
    quantity: number,
    variantId?: string | null,
  ) {
    const vId = variantId || '';
    const stock = await tx.franchiseStock.findUnique({
      where: {
        franchiseId_productId_variantId: {
          franchiseId,
          productId,
          variantId: vId,
        },
      },
    });

    if (user.role === Role.ADMIN_STAFF || user.role === Role.SUPERADMIN) {
      const warehouseStock = await this.prisma.warehouseStock.findUniqueOrThrow(
        {
          where: { productId },
        },
      );
      if (warehouseStock.quantity < quantity) {
        throw new BadRequestException(
          `Insufficient warehouse stock for product ${productId}`,
        );
      }

      await tx.warehouseStock.update({
        where: { productId },
        data: { quantity: { decrement: quantity } },
      });
    } else if (
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF
    ) {
      if (!stock || stock.quantity - stock.reserved < quantity) {
        throw new BadRequestException(
          `Insufficient sellable stock for product ${productId}`,
        );
      }
    }

    if (stock) {
      await tx.franchiseStock.update({
        where: {
          franchiseId_productId_variantId: {
            franchiseId,
            productId,
            variantId: vId,
          },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });
    }
  }

  private async createDefectiveLedger(
    tx: Transaction,
    franchiseId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    sourceId: string,
    sourceType: 'ORDER' | 'STOCK_REQUEST',
  ) {
    return tx.returnInventory.create({
      data: {
        franchiseId,
        productId,
        variantId,
        quantity,
        sourceType,
        sourceId,
        kind: 'DEFECTIVE',
      },
    });
  }

  private async createReturnLedger(
    tx: Transaction,
    franchiseId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    sourceId: string,
    sourceType: 'ORDER' | 'STOCK_REQUEST',
  ) {
    return tx.returnInventory.create({
      data: {
        franchiseId,
        productId,
        variantId,
        quantity,
        sourceType,
        sourceId,
        kind: 'RETURN',
      },
    });
  }

  private async createConflictLedger(
    tx: Transaction,
    franchiseId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    sourceId: string,
    sourceType: 'ORDER' | 'STOCK_REQUEST',
  ) {
    return tx.returnInventory.create({
      data: {
        franchiseId,
        productId,
        variantId,
        quantity,
        sourceType,
        sourceId,
        kind: 'CONFLICT',
        status: 'OPEN',
      },
    });
  }

  // ======================================
  // SOURCE VALIDATION
  // ======================================

  private validateSourceRules(input: {
    order: Awaited<ReturnType<ProductReturnService['loadOrder']>>;
    stockRequest: Awaited<ReturnType<ProductReturnService['loadStockRequest']>>;
    type: ReturnInventoryEnum;
  }) {
    if (input.order) {
      if (
        input.order.channel === OrderChannel.POS &&
        input.type !== ReturnInventoryEnum.EXCHANGE
      ) {
        throw new BadRequestException('POS orders only allow exchanges');
      }

      return;
    }

    if (input.stockRequest && input.type !== ReturnInventoryEnum.RETURN) {
      throw new BadRequestException('Stock request returns only allow RETURN');
    }
  }

  private async supportsStockRequestField() {
    if (this.stockRequestColumnSupported !== undefined) {
      return this.stockRequestColumnSupported;
    }

    const result = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'FranchiseReturn'
          AND column_name = 'stockRequestId'
      )::boolean AS "exists"
    `;

    this.stockRequestColumnSupported = result[0]?.exists ?? false;
    return this.stockRequestColumnSupported;
  }

  private buildReturnSelect(supportsStockRequestField: boolean) {
    return {
      id: true,
      franchiseId: true,
      orderId: true,
      customerId: true,
      reason: true,
      resolutionNote: true,
      refundRequested: true,
      returnType: true,
      oldItems: true,
      newItems: true,
      oldTotalAmount: true,
      newTotalAmount: true,
      finalPayableAmount: true,
      processedAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      franchise: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          ownerFullName: true,
          ownerPhone: true,
          ownerEmail: true,
          businessName: true,
          state: true,
          city: true,
          gender: true,
          approvedAt: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          channel: true,
          franchiseId: true,
          customerId: true,
          customer: {
            select: {
              id: true,
              name: true,
              altEmail: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          retailCustomer: {
            select: {
              name: true,
              email: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      },
      ...(supportsStockRequestField
        ? {
            stockRequest: {
              select: {
                id: true,
                franchiseId: true,
                productId: true,
                variantId: true,
                quantity: true,
                status: true,
                createdAt: true,
              },
            },
          }
        : {}),
    } as const;
  }

  private getScopedWhere(
    query: ProductReturnListQueryDto,
    user: JwtUser,
    supportsStockRequestField: boolean,
  ) {
    const clauses: Prisma.FranchiseReturnWhereInput[] = [];
    clauses.push({
      deletedAt: null,
    } as unknown as Prisma.FranchiseReturnWhereInput);
    const search = query.search?.trim() || query.q?.trim();

    if (search) {
      const searchOr: Prisma.FranchiseReturnWhereInput[] = [
        { id: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
        { resolutionNote: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
      ];

      if (supportsStockRequestField) {
        searchOr.push({
          stockRequestId: { contains: search, mode: 'insensitive' },
        });
      }

      clauses.push({ OR: searchOr });
    }

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.returnType) {
      clauses.push({ returnType: query.returnType });
    }

    if (query.requestId) {
      clauses.push({ id: query.requestId });
    }

    if (query.sourceType === ProductReturnSourceType.ORDER) {
      clauses.push({ stockRequestId: null });
    }

    if (query.channel) {
      clauses.push({ order: { channel: query.channel } });
    }

    if (query.sourceType === ProductReturnSourceType.STOCK_REQUEST) {
      clauses.push({ stockRequestId: { not: null } });
    }

    if (query.orderNumber) {
      clauses.push({ order: { orderNumber: query.orderNumber } });
    }

    if (query.stockRequestId) {
      if (!supportsStockRequestField) {
        throw new BadRequestException(
          'stockRequestId filtering requires the database migration that adds FranchiseReturn.stockRequestId',
        );
      }

      clauses.push({ stockRequestId: query.stockRequestId });
    }

    const dateFilter = buildDateFilter(
      'createdAt',
      query.fromDate,
      query.lastDate,
    );
    if (Object.keys(dateFilter).length > 0) {
      clauses.push(dateFilter);
    }

    const isAdmin =
      user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;
    const effectiveFranchiseId =
      user.franchiseId ?? user.franchiseOwnerId ?? undefined;

    if (query.franchiseId) {
      if (!isAdmin && query.franchiseId !== effectiveFranchiseId) {
        throw new ForbiddenException(
          'You are not allowed to filter by this franchise',
        );
      }

      clauses.push({ franchiseId: query.franchiseId });
    } else if (user.role === Role.CUSTOMER) {
      if (!user.customerId) {
        throw new ForbiddenException('No customer linked to current user');
      }

      clauses.push({ order: { customerId: user.customerId } });
    } else if (!isAdmin) {
      if (!effectiveFranchiseId) {
        throw new ForbiddenException('No franchise linked to current user');
      }

      clauses.push({
        OR: [
          { franchiseId: effectiveFranchiseId },
          { order: { franchiseId: effectiveFranchiseId } },
          { stockRequest: { franchiseId: effectiveFranchiseId } },
        ],
      });
    }

    return clauses.length > 0 ? { AND: clauses } : {};
  }

  async list(query: ProductReturnListQueryDto, user: JwtUser) {
    const supportsStockRequestField = await this.supportsStockRequestField();
    const where = this.getScopedWhere(query, user, supportsStockRequestField);
    const page = normalizePositiveInteger(query.page, 1);
    const limit = normalizePositiveInteger(query.limit, 10);
    const skip = (page - 1) * limit;

    const select: Prisma.FranchiseReturnSelect = {
      id: true,
      franchiseId: true,
      orderId: true,
      customerId: true,
      reason: true,
      resolutionNote: true,
      refundRequested: true,
      returnType: true,
      oldItems: true,
      newItems: true,
      oldTotalAmount: true,
      newTotalAmount: true,
      processedAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      franchise: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          ownerFullName: true,
          ownerPhone: true,
          ownerEmail: true,
          businessName: true,
          state: true,
          city: true,
          gender: true,
          approvedAt: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          channel: true,
          franchiseId: true,
          customerId: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              altEmail: true,
              addresses: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          // customer: {
          //   id: true,
          //   email: true,
          //   select: {
          //     id: true,
          //     email: true,
          //     customer: {
          //       select: {
          //         id: true,
          //         name: true,
          //         altEmail: true,
          //       },
          //     },
          //   },
          // },
          retailCustomer: {
            select: {
              name: true,
              email: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      },
      ...(supportsStockRequestField
        ? {
            stockRequest: {
              select: {
                id: true,
                franchiseId: true,
                productId: true,
                variantId: true,
                quantity: true,
                status: true,
                createdAt: true,
              },
            },
          }
        : {}),
    };

    const total = await this.prisma.franchiseReturn.count({ where });
    const data =
      total > 0
        ? await this.prisma.franchiseReturn.findMany({
            where,
            select,
            orderBy: { createdAt: query.order ?? OrderType.DESC },
            skip,
            take: limit,
          })
        : [];

    const hydratedData =
      data.length > 0
        ? await Promise.all(
            data.map((record) =>
              this.hydrateReturnRecordForRead(this.prisma, record),
            ),
          )
        : [];

    return {
      data: hydratedData,
      meta: {
        count: total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
        page,
        limit,
      },
    };
  }

  async getFiltered(query: ProductReturnFilteredQueryDto, user: JwtUser) {
    const isAdmin =
      user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;

    const effectiveFranchiseId =
      user.role === Role.FRANCHISE_OWNER
        ? user.franchiseId
        : user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : undefined;

    if (!isAdmin && !effectiveFranchiseId) {
      throw new ForbiddenException('No franchise linked to current user');
    }

    const supportsStockRequestField = await this.supportsStockRequestField();

    const clauses: Prisma.FranchiseReturnWhereInput[] = [
      { deletedAt: null } as unknown as Prisma.FranchiseReturnWhereInput,
    ];

    if (query.sourceType === ProductReturnSourceType.ORDER) {
      clauses.push({ stockRequestId: null });
    } else if (query.sourceType === ProductReturnSourceType.STOCK_REQUEST) {
      if (!supportsStockRequestField) {
        throw new BadRequestException(
          'Stock request returns require database migration for stockRequestId column',
        );
      }
      clauses.push({ stockRequestId: { not: null } });
    }

    if (query.franchiseId) {
      if (!isAdmin) {
        throw new ForbiddenException(
          'You are not allowed to filter by franchiseId',
        );
      }
      clauses.push({ franchiseId: query.franchiseId });
    } else if (effectiveFranchiseId) {
      clauses.push({ franchiseId: effectiveFranchiseId });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const data = await this.prisma.franchiseReturn.findMany({
      where,
      select: this.buildReturnSelect(supportsStockRequestField),
      orderBy: { createdAt: 'desc' },
    });

    const hydratedData =
      data.length > 0
        ? await Promise.all(
            data.map((record) =>
              this.hydrateReturnRecordForRead(this.prisma, record as any),
            ),
          )
        : [];

    return { data: hydratedData, count: data.length };
  }

  async getByRequestId(requestId: string, user: JwtUser) {
    const supportsStockRequestField = await this.supportsStockRequestField();
    const where = this.getScopedWhere(
      { requestId } as ProductReturnListQueryDto,
      user,
      supportsStockRequestField,
    );

    const result = await this.prisma.franchiseReturn.findFirst({
      where,
      select: {
        id: true,
        franchiseId: true,
        orderId: true,
        customerId: true,
        reason: true,
        resolutionNote: true,
        refundRequested: true,
        returnType: true,
        oldItems: true,
        newItems: true,
        oldTotalAmount: true,
        newTotalAmount: true,
        processedAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        franchise: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            ownerFullName: true,
            ownerPhone: true,
            ownerEmail: true,
            businessName: true,
            state: true,
            city: true,
            gender: true,
            approvedAt: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            channel: true,
            franchiseId: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                name: true,
                altEmail: true,
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
            retailCustomer: {
              select: {
                name: true,
                email: true,
              },
            },
            createdAt: true,
            updatedAt: true,
          },
        },
        ...(supportsStockRequestField
          ? {
              stockRequest: {
                select: {
                  id: true,
                  franchiseId: true,
                  productId: true,
                  variantId: true,
                  quantity: true,
                  status: true,
                  createdAt: true,
                  variant: {
                    select: {
                      id: true,
                      sku: true,
                      attributeSummary: true,
                      imageUrl: true,
                      attributes: {
                        select: {
                          attributeValue: {
                            select: {
                              id: true,
                              title: true,
                              attributeNameId: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
    });

    if (!result) {
      throw new NotFoundException('Return request not found');
    }

    return this.hydrateReturnRecordForRead(this.prisma, result);
  }

  async listReturnInventory(query: ReturnInventoryQueryDto) {
    const page = normalizePositiveInteger(query.page, 1);
    const limit = normalizePositiveInteger(query.limit, 20);
    const skip = (page - 1) * limit;

    const clauses: Prisma.ReturnInventoryWhereInput[] = [];

    const dateFilter = buildDateFilter(
      'createdAt',
      query.fromDate,
      query.lastDate,
    );
    if (Object.keys(dateFilter).length > 0) clauses.push(dateFilter);

    if (query.franchiseId)
      clauses.push({ franchise: { id: query.franchiseId } });

    if (query.customerId) clauses.push({ customer: { id: query.customerId } });

    if (query.productId) clauses.push({ productId: query.productId });

    if (query.sourceType) clauses.push({ sourceType: query.sourceType });

    if (query.kind) clauses.push({ kind: query.kind });

    if (query.status) clauses.push({ status: query.status });

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const total = await this.prisma.returnInventory.count({ where });

    const result =
      total > 0
        ? await this.prisma.returnInventory.findMany({
            where,
            select: {
              id: true,
              productId: true,
              variantId: true,
              quantity: true,
              sourceType: true,
              sourceId: true,
              kind: true,
              status: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  user: { select: { id: true, email: true } },
                },
              },
              createdAt: true,
              product: {
                select: { id: true, name: true, slug: true, imageUrl: true },
              },
              variant: {
                select: {
                  id: true,
                  sku: true,
                  imageUrl: true,
                  imageUrls: true,
                  attributes: {
                    select: {
                      attributeValue: {
                        select: {
                          title: true,
                        },
                      },
                    },
                  },
                },
              },
              franchise: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  ownerEmail: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          })
        : [];

    return {
      data: result,
      meta: {
        count: total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
        page,
        limit,
      },
    };
  }

  private parseSnapshots(items: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(items)) {
      return [] as ReturnLineSnapshot[];
    }

    return items as ReturnLineSnapshot[];
  }

  private async loadReturnRequest(
    tx: Transaction,
    returnId: string,
    supportsStockRequestField: boolean,
  ) {
    return tx.franchiseReturn.findFirst({
      where: {
        id: returnId,
        deletedAt: null,
      },
      select: {
        id: true,
        franchiseId: true,
        orderId: true,
        customerId: true,
        stockRequestId: supportsStockRequestField ? true : false,
        reason: true,
        resolutionNote: true,
        refundRequested: true,
        returnType: true,
        oldItems: true,
        newItems: true,
        oldTotalAmount: true,
        newTotalAmount: true,
        processedAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        franchise: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            ownerFullName: true,
            ownerPhone: true,
            ownerEmail: true,
            businessName: true,
            state: true,
            city: true,
            gender: true,
            approvedAt: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            channel: true,
            franchiseId: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                name: true,
                altEmail: true,
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
            retailCustomer: {
              select: {
                name: true,
                email: true,
              },
            },
            createdAt: true,
            updatedAt: true,
            items: {
              select: {
                id: true,
                productId: true,
                variantId: true,
                quantity: true,
                productName: true,
                sku: true,
                variantName: true,
                unitPrice: true,
                mrpPrice: true,
                gstPercent: true,
                discountAmount: true,
                taxAmount: true,
                finalAmount: true,
                imageUrl: true,
              },
            },
          },
        },
        ...(supportsStockRequestField
          ? {
              stockRequest: {
                select: {
                  id: true,
                  franchiseId: true,
                  productId: true,
                  variantId: true,
                  quantity: true,
                  status: true,
                  createdAt: true,
                  unitPriceAtApproval: true,
                  gstRatePercent: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      price: true,
                      mrpPrice: true,
                      defaultGstRatePercent: true,
                      imageUrl: true,
                    },
                  },
                  variant: {
                    select: {
                      id: true,
                      sku: true,
                      attributeSummary: true,
                      price: true,
                      mrpPrice: true,
                      gstTax: true,
                      imageUrl: true,
                    },
                  },
                  franchise: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            }
          : {}),
      },
    });
  }

  private assertCustomerOwnership(
    request: Awaited<ReturnType<ProductReturnService['loadReturnRequest']>>,
    customerId: string | undefined,
  ) {
    if (!customerId) {
      throw new ForbiddenException('No customer linked to current user');
    }

    if (!request?.order || request.order.customerId !== customerId) {
      throw new ForbiddenException(
        'You are not allowed to manage this request',
      );
    }

    if (request.order.channel !== OrderChannel.ONLINE) {
      throw new BadRequestException(
        'Online request can only be created from online orders',
      );
    }
  }

  private assertFranchiseOwnership(
    request: Awaited<ReturnType<ProductReturnService['loadReturnRequest']>>,
    franchiseId: string | undefined,
  ) {
    if (!franchiseId) {
      throw new ForbiddenException('No franchise linked to current user');
    }

    const sourceFranchiseId =
      request?.order?.franchiseId ?? request?.stockRequest?.franchiseId;
    if (!sourceFranchiseId || sourceFranchiseId !== franchiseId) {
      throw new BadRequestException(
        'Request does not belong to this franchise',
      );
    }
  }

  private assertPendingRequest(
    request: Awaited<ReturnType<ProductReturnService['loadReturnRequest']>>,
  ) {
    if (!request) {
      throw new NotFoundException('Return request not found');
    }

    if (request.status !== FranchiseReturnStatus.PENDING) {
      throw new BadRequestException(
        'Only pending requests can be edited or deleted',
      );
    }
  }

  private async buildPreparedDraft(
    tx: Transaction,
    dto: ProductReturnCreateDto,
    franchiseId: string,
  ): Promise<PreparedReturnDraft> {
    const order = dto.orderNumber
      ? await this.loadOrder(tx, dto.orderNumber)
      : null;
    const stockRequest = dto.stockRequestId
      ? await this.loadStockRequest(tx, dto.stockRequestId)
      : null;

    if (!order && !stockRequest) {
      throw new NotFoundException('Source record not found');
    }

    if (order && order.franchiseId !== franchiseId) {
      throw new BadRequestException('Order does not belong to this franchise');
    }

    if (stockRequest && stockRequest.franchiseId !== franchiseId) {
      throw new BadRequestException(
        'Stock request does not belong to this franchise',
      );
    }

    this.validateSourceRules({ order, stockRequest, type: dto.type });

    if (dto.type === ReturnInventoryEnum.EXCHANGE && dto.newItems) {
      const invalidNewItem = dto.newItems.some(
        (item) => item.condition !== ReturnItemCondition.GOOD,
      );

      if (invalidNewItem) {
        throw new BadRequestException(
          'Exchange replacement items must use GOOD condition',
        );
      }
    }

    const sourceType = order ? 'ORDER' : 'STOCK_REQUEST';
    const sourceId = order?.id ?? stockRequest!.id;
    const groupedOldItems = this.groupItems(dto.oldItems);
    const groupedNewItems = dto.newItems ? this.groupItems(dto.newItems) : [];

    const oldSnapshots: ReturnLineSnapshot[] = [];
    const newSnapshots: ReturnLineSnapshot[] = [];

    let oldTotal = new Prisma.Decimal(0);
    let newTotal = new Prisma.Decimal(0);

    if (order) {
      const sourceMap = new Map<string, number>();
      const sourceLineMap = new Map<string, OrderSourceItem>();

      for (const item of order.items) {
        const key = this.normalizeKey(item.productId, item.variantId ?? null);
        sourceMap.set(key, (sourceMap.get(key) ?? 0) + item.quantity);

        if (!sourceLineMap.has(key)) {
          sourceLineMap.set(
            key,
            this.getOrderSourceItem({
              productId: item.productId,
              variantId: item.variantId ?? null,
              quantity: item.quantity,
              productName: item.productName ?? null,
              sku: item.sku ?? null,
              variantName: item.variantName ?? null,
              unitPrice: this.decimal(item.unitPrice),
              mrpPrice: item.mrpPrice ?? null,
              gstPercent: item.gstPercent ?? null,
              imageUrl: item.imageUrl ?? null,
              product: item.product
                ? {
                    name: item.product.name,
                    slug: item.product.slug,
                    imageUrl: item.product.imageUrl,
                    mrpPrice: item.product.mrpPrice,
                    price: item.product.price,
                  }
                : null,
            }),
          );
        }
      }

      for (const group of groupedOldItems) {
        const key = this.normalizeKey(group.productId, group.variantId);
        const sourceQty = sourceMap.get(key) ?? 0;
        if (sourceQty < group.quantity) {
          throw new BadRequestException(
            `Old item ${group.productId} does not belong to the selected order or exceeds ordered quantity`,
          );
        }

        const sourceLine = sourceLineMap.get(key);
        if (!sourceLine) {
          throw new BadRequestException(
            `Old item ${group.productId} does not belong to the selected order`,
          );
        }

        const snapshot = this.snapshotLine({
          productId: group.productId,
          variantId: group.variantId,
          condition: group.condition,
          quantity: group.quantity,
          productName: sourceLine.productName ?? 'UNKNOWN_PRODUCT',
          sku: sourceLine.sku ?? 'UNKNOWN_SKU',
          variantName: sourceLine.variantName,
          unitPrice: sourceLine.unitPrice,
          mrpPrice: sourceLine.mrpPrice,
          gstPercent: sourceLine.gstPercent ?? this.decimal(0),
          imageUrl: sourceLine.imageUrl,
        });

        oldSnapshots.push(snapshot);
        oldTotal = oldTotal.add(sourceLine.unitPrice.mul(group.quantity));
      }
    } else {
      if (groupedOldItems.length !== 1) {
        throw new BadRequestException(
          'Stock request returns must contain exactly one old item line',
        );
      }

      const group = groupedOldItems[0];
      if (group.quantity > stockRequest!.quantity) {
        throw new BadRequestException(
          'Returned quantity cannot exceed the stock request quantity',
        );
      }

      const unitPrice = this.decimal(
        stockRequest!.unitPriceAtApproval ??
          stockRequest!.variant?.price ??
          stockRequest!.product.price,
      );
      const gstPercent = this.decimal(
        stockRequest!.gstRatePercent ??
          stockRequest!.variant?.gstTax ??
          stockRequest!.product.defaultGstRatePercent ??
          0,
      );

      const snapshot = this.snapshotLine({
        productId: stockRequest!.productId,
        variantId: stockRequest!.variantId ?? null,
        condition: group.condition,
        quantity: group.quantity,
        productName: stockRequest!.product.name,
        sku: stockRequest!.variant?.sku ?? stockRequest!.product.slug,
        variantName: stockRequest!.variant?.attributeSummary ?? null,
        unitPrice,
        mrpPrice:
          stockRequest!.variant?.mrpPrice ?? stockRequest!.product.mrpPrice,
        gstPercent,
        imageUrl:
          stockRequest!.variant?.imageUrl ??
          stockRequest!.product.imageUrl ??
          null,
      });

      oldSnapshots.push(snapshot);
      oldTotal = oldTotal.add(unitPrice.mul(group.quantity));
    }

    for (const group of groupedNewItems) {
      const catalogItem = await this.loadCatalogItem(
        tx,
        group.productId,
        group.variantId,
      );

      const snapshot = this.snapshotLine({
        productId: group.productId,
        variantId: group.variantId,
        condition: group.condition,
        quantity: group.quantity,
        productName: catalogItem.productName,
        sku: catalogItem.sku,
        variantName: catalogItem.variantName,
        unitPrice: catalogItem.unitPrice,
        mrpPrice: catalogItem.mrpPrice,
        gstPercent: catalogItem.gstPercent,
        imageUrl: catalogItem.imageUrl,
      });

      newSnapshots.push(snapshot);
      newTotal = newTotal.add(catalogItem.unitPrice.mul(group.quantity));
    }

    if (dto.type === ReturnInventoryEnum.EXCHANGE && newTotal.lt(oldTotal)) {
      throw new BadRequestException(
        'Exchange replacement value must be greater than or equal to the returned value',
      );
    }

    return {
      order,
      stockRequest,
      sourceType,
      sourceId,
      oldSnapshots,
      newSnapshots,
      oldTotal,
      newTotal,
      groupedOldItems,
      groupedNewItems,
    };
  }

  private async applyPreparedDraftEffects(
    user: JwtUser,
    tx: Transaction,
    draft: PreparedReturnDraft,
    franchiseId: string,
  ) {
    const defectiveInventory: unknown[] = [];
    const conflictInventory: unknown[] = [];
    const returnInventory: unknown[] = [];

    if (draft.order) {
      for (const group of draft.groupedOldItems) {
        if (group.condition === ReturnItemCondition.GOOD) {
          await this.incrementFranchiseStock(
            tx,
            franchiseId,
            group.productId,
            group.quantity,
          );
          returnInventory.push(
            await this.createReturnLedger(
              tx,
              franchiseId,
              group.productId,
              group.variantId,
              group.quantity,
              draft.sourceId,
              draft.sourceType,
            ),
          );
        } else if (group.condition === ReturnItemCondition.DEFECTIVE) {
          defectiveInventory.push(
            await this.createDefectiveLedger(
              tx,
              franchiseId,
              group.productId,
              group.variantId,
              group.quantity,
              draft.sourceId,
              draft.sourceType,
            ),
          );
        } else {
          conflictInventory.push(
            await this.createConflictLedger(
              tx,
              franchiseId,
              group.productId,
              group.variantId,
              group.quantity,
              draft.sourceId,
              draft.sourceType,
            ),
          );
        }
      }
    } else {
      for (const group of draft.groupedOldItems) {
        await this.decrementFranchiseStock(
          user,
          tx,
          franchiseId,
          group.productId,
          group.quantity,
        );

        if (group.condition === ReturnItemCondition.GOOD) {
          await this.incrementWarehouseStock(
            tx,
            group.productId,
            group.quantity,
          );
          returnInventory.push(
            await this.createReturnLedger(
              tx,
              franchiseId,
              group.productId,
              group.variantId,
              group.quantity,
              draft.sourceId,
              draft.sourceType,
            ),
          );
        } else if (group.condition === ReturnItemCondition.DEFECTIVE) {
          defectiveInventory.push(
            await this.createDefectiveLedger(
              tx,
              franchiseId,
              group.productId,
              group.variantId,
              group.quantity,
              draft.sourceId,
              draft.sourceType,
            ),
          );
        } else {
          conflictInventory.push(
            await this.createConflictLedger(
              tx,
              franchiseId,
              group.productId,
              group.variantId,
              group.quantity,
              draft.sourceId,
              draft.sourceType,
            ),
          );
        }
      }
    }

    if (draft.groupedNewItems.length > 0) {
      for (const group of draft.groupedNewItems) {
        await this.decrementFranchiseStock(
          user,
          tx,
          franchiseId,
          group.productId,
          group.quantity,
        );
      }
    }

    return { defectiveInventory, conflictInventory, returnInventory };
  }

  private async persistReturnRequest(
    tx: Transaction,
    payload: {
      franchiseId: string;
      orderId: string | null;
      customerId: string | null;
      stockRequestId: string | null;
      returnType: ReturnInventoryEnum;
      reason: string;
      refundRequested: boolean;
      status: FranchiseReturnStatus;
      oldItems: ReturnLineSnapshot[];
      newItems: ReturnLineSnapshot[];
      oldTotalAmount: Prisma.Decimal;
      newTotalAmount: Prisma.Decimal | null;
      processedAt: Date | null;
      supportsStockRequestField: boolean;
    },
  ) {
    const finalPayableAmount =
      payload.newTotalAmount !== null
        ? payload.newTotalAmount.minus(payload.oldTotalAmount)
        : null;

    return tx.franchiseReturn.create({
      select: this.buildReturnSelect(payload.supportsStockRequestField),
      data: {
        franchiseId: payload.franchiseId,
        orderId: payload.orderId,
        customerId: payload.customerId,
        ...(payload.supportsStockRequestField
          ? { stockRequestId: payload.stockRequestId }
          : {}),
        returnType: payload.returnType,
        reason: payload.reason,
        refundRequested: payload.refundRequested,
        status: payload.status,
        oldItems: payload.oldItems as Prisma.InputJsonValue,
        newItems:
          payload.newItems.length > 0
            ? (payload.newItems as Prisma.InputJsonValue)
            : undefined,
        oldTotalAmount: payload.oldTotalAmount,
        newTotalAmount: payload.newTotalAmount,
        finalPayableAmount,
        processedAt: payload.processedAt,
      },
    });
  }

  private async logRequestAudit(
    tx: Transaction,
    input: {
      userId: string;
      action: string;
      resourceId: string;
      metadata: Prisma.InputJsonValue;
      ip?: string;
    },
  ) {
    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        resource: 'FranchiseReturn',
        resourceId: input.resourceId,
        metadata: input.metadata,
        ip: input.ip,
      },
    });
  }

  // ======================================
  // MAIN FLOW
  // ======================================

  async create(
    dto: ProductReturnCreateDto,
    user: JwtUser,
    ip?: string,
  ): Promise<ReturnProcessingResult> {
    return this.prisma.$transaction(async (tx) => {
      const order = dto.orderNumber
        ? await this.loadOrder(tx, dto.orderNumber)
        : null;
      const stockRequest = dto.stockRequestId
        ? await this.loadStockRequest(tx, dto.stockRequestId)
        : null;
      const isAdmin = this.isAdminUser(user);
      const franchiseId =
        user.franchiseId ??
        user.franchiseOwnerId ??
        (isAdmin
          ? (order?.franchiseId ?? stockRequest?.franchiseId)
          : undefined);

      if (!order && !stockRequest) {
        throw new NotFoundException('Source record not found');
      }

      if (!franchiseId) {
        throw new ForbiddenException('No franchise linked to current user');
      }

      if (!isAdmin && order && order.franchiseId !== franchiseId) {
        throw new BadRequestException(
          'Order does not belong to this franchise',
        );
      }

      if (
        !isAdmin &&
        stockRequest &&
        stockRequest.franchiseId !== franchiseId
      ) {
        throw new BadRequestException(
          'Stock request does not belong to this franchise',
        );
      }

      this.validateSourceRules({ order, stockRequest, type: dto.type });

      if (dto.type === ReturnInventoryEnum.EXCHANGE && dto.newItems) {
        const invalidNewItem = dto.newItems.some(
          (item) => item.condition !== ReturnItemCondition.GOOD,
        );

        if (invalidNewItem) {
          throw new BadRequestException(
            'Exchange replacement items must use GOOD condition',
          );
        }
      }

      const sourceType = order ? 'ORDER' : 'STOCK_REQUEST';
      const sourceId = order?.id ?? stockRequest!.id;

      const groupedOldItems = this.groupItems(dto.oldItems);
      const groupedNewItems = dto.newItems ? this.groupItems(dto.newItems) : [];

      const oldSnapshots: ReturnLineSnapshot[] = [];
      const newSnapshots: ReturnLineSnapshot[] = [];
      const defectiveLedgerRows: unknown[] = [];
      const conflictLedgerRows: unknown[] = [];
      const returnLedgerRows: unknown[] = [];

      let oldTotal = new Prisma.Decimal(0);
      let newTotal = new Prisma.Decimal(0);

      if (order) {
        const sourceMap = new Map<string, number>();
        const sourceLineMap = new Map<string, OrderSourceItem>();

        for (const item of order.items) {
          const key = this.normalizeKey(item.productId, item.variantId ?? null);
          sourceMap.set(key, (sourceMap.get(key) ?? 0) + item.quantity);

          if (!sourceLineMap.has(key)) {
            sourceLineMap.set(
              key,
              this.getOrderSourceItem({
                productId: item.productId,
                variantId: item.variantId ?? null,
                quantity: item.quantity,
                productName: item.productName ?? null,
                sku: item.sku ?? null,
                variantName: this.getVariantDisplayName(item.variant),
                unitPrice: this.decimal(item.unitPrice),
                mrpPrice: item.mrpPrice ?? null,
                gstPercent: item.gstPercent ?? null,
                imageUrl: item.imageUrl ?? null,
                product: item.product
                  ? {
                      name: item.product.name,
                      slug: item.product.slug,
                      imageUrl: item.product.imageUrl,
                      mrpPrice: item.product.mrpPrice,
                      price: item.product.price,
                    }
                  : null,
              }),
            );
          }
        }

        for (const group of groupedOldItems) {
          const key = this.normalizeKey(group.productId, group.variantId);
          const sourceQty = sourceMap.get(key) ?? 0;
          if (sourceQty < group.quantity) {
            throw new BadRequestException(
              `Old item ${group.productId} does not belong to the selected order or exceeds ordered quantity`,
            );
          }

          const sourceLine = sourceLineMap.get(key);
          if (!sourceLine) {
            throw new BadRequestException(
              `Old item ${group.productId} does not belong to the selected order`,
            );
          }

          const snapshot = this.snapshotLine({
            productId: group.productId,
            variantId: group.variantId,
            condition: group.condition,
            quantity: group.quantity,
            productName: sourceLine.productName ?? 'UNKNOWN_PRODUCT',
            sku: sourceLine.sku ?? 'UNKNOWN_SKU',
            variantName: sourceLine.variantName,
            unitPrice: sourceLine.unitPrice,
            mrpPrice: sourceLine.mrpPrice,
            gstPercent: sourceLine.gstPercent ?? this.decimal(0),
            imageUrl: sourceLine.imageUrl,
          });

          oldSnapshots.push(snapshot);
          oldTotal = oldTotal.add(sourceLine.unitPrice.mul(group.quantity));
        }
      } else {
        if (groupedOldItems.length !== 1) {
          throw new BadRequestException(
            'Stock request returns must contain exactly one old item line',
          );
        }

        const group = groupedOldItems[0];
        if (group.quantity > stockRequest!.quantity) {
          throw new BadRequestException(
            'Returned quantity cannot exceed the stock request quantity',
          );
        }

        const unitPrice = this.decimal(
          stockRequest!.unitPriceAtApproval ??
            stockRequest!.variant?.price ??
            stockRequest!.product.price,
        );
        const gstPercent = this.decimal(
          stockRequest!.gstRatePercent ??
            stockRequest!.variant?.gstTax ??
            stockRequest!.product.defaultGstRatePercent ??
            0,
        );

        const snapshot = this.snapshotLine({
          productId: group.productId,
          variantId: group.variantId,
          condition: group.condition,
          quantity: group.quantity,
          productName: stockRequest!.product.name,
          sku: stockRequest!.variant?.sku ?? stockRequest!.product.slug,
          variantName: this.getVariantDisplayName(stockRequest!.variant),
          unitPrice,
          mrpPrice:
            stockRequest!.variant?.mrpPrice ?? stockRequest!.product.mrpPrice,
          gstPercent,
          imageUrl:
            stockRequest!.variant?.imageUrl ??
            stockRequest!.product.imageUrl ??
            null,
        });

        oldSnapshots.push(snapshot);
        oldTotal = oldTotal.add(unitPrice.mul(group.quantity));
      }

      for (const group of groupedNewItems) {
        const catalogItem = await this.loadCatalogItem(
          tx,
          group.productId,
          group.variantId,
        );

        const snapshot = this.snapshotLine({
          productId: group.productId,
          variantId: group.variantId,
          condition: group.condition,
          quantity: group.quantity,
          productName: catalogItem.productName,
          sku: catalogItem.sku,
          variantName: catalogItem.variantName,
          unitPrice: catalogItem.unitPrice,
          mrpPrice: catalogItem.mrpPrice,
          gstPercent: catalogItem.gstPercent,
          imageUrl: catalogItem.imageUrl,
        });

        newSnapshots.push(snapshot);
        newTotal = newTotal.add(catalogItem.unitPrice.mul(group.quantity));
      }

      if (dto.type === ReturnInventoryEnum.EXCHANGE && newTotal.lt(oldTotal)) {
        throw new BadRequestException(
          'Exchange replacement value must be greater than or equal to the returned value',
        );
      }

      if (order) {
        for (const group of groupedOldItems) {
          if (group.condition === ReturnItemCondition.GOOD) {
            await this.incrementFranchiseStock(
              tx,
              franchiseId,
              group.productId,
              group.quantity,
            );
            returnLedgerRows.push(
              await this.createReturnLedger(
                tx,
                franchiseId,
                group.productId,
                group.variantId,
                group.quantity,
                sourceId,
                sourceType,
              ),
            );
          } else if (group.condition === ReturnItemCondition.DEFECTIVE) {
            defectiveLedgerRows.push(
              await this.createDefectiveLedger(
                tx,
                franchiseId,
                group.productId,
                group.variantId,
                group.quantity,
                sourceId,
                sourceType,
              ),
            );
          } else {
            conflictLedgerRows.push(
              await this.createConflictLedger(
                tx,
                franchiseId,
                group.productId,
                group.variantId,
                group.quantity,
                sourceId,
                sourceType,
              ),
            );
          }
        }
      } else {
        for (const group of groupedOldItems) {
          if (group.condition === ReturnItemCondition.GOOD) {
            await this.incrementWarehouseStock(
              tx,
              group.productId,
              group.quantity,
            );
            await this.incrementCatalogStock(
              tx,
              group.productId,
              group.quantity,
              group.variantId,
            );
            returnLedgerRows.push(
              await this.createReturnLedger(
                tx,
                franchiseId,
                group.productId,
                group.variantId,
                group.quantity,
                sourceId,
                sourceType,
              ),
            );
          } else if (group.condition === ReturnItemCondition.DEFECTIVE) {
            defectiveLedgerRows.push(
              await this.createDefectiveLedger(
                tx,
                franchiseId,
                group.productId,
                group.variantId,
                group.quantity,
                sourceId,
                sourceType,
              ),
            );
          } else {
            conflictLedgerRows.push(
              await this.createConflictLedger(
                tx,
                franchiseId,
                group.productId,
                group.variantId,
                group.quantity,
                sourceId,
                sourceType,
              ),
            );
          }
        }
      }

      if (dto.type === ReturnInventoryEnum.EXCHANGE) {
        for (const group of groupedNewItems) {
          await this.decrementFranchiseStock(
            user,
            tx,
            franchiseId,
            group.productId,
            group.quantity,
          );
        }
      }

      const supportsStockRequestField = await this.supportsStockRequestField();

      if (dto.stockRequestId && !supportsStockRequestField) {
        throw new BadRequestException(
          'Stock-request returns require the database migration that adds FranchiseReturn.stockRequestId',
        );
      }

      const hasNewItems = groupedNewItems.length > 0;
      const isStockRequestWithReplacement = Boolean(
        dto.stockRequestId && hasNewItems,
      );

      const finalPayableAmount = isStockRequestWithReplacement
        ? newTotal.minus(oldTotal)
        : dto.type === ReturnInventoryEnum.EXCHANGE
          ? newTotal.minus(oldTotal)
          : null;

      const returnRecord = await tx.franchiseReturn.create({
        select: this.buildReturnSelect(supportsStockRequestField),
        data: {
          franchiseId,
          orderId: order?.id ?? null,
          customerId: order?.customerId ?? null,
          ...(supportsStockRequestField
            ? { stockRequestId: stockRequest?.id ?? null }
            : {}),
          returnType: dto.type,
          reason: dto.reason ?? '',
          refundRequested: dto.type === ReturnInventoryEnum.REFUND,
          status: dto.stockRequestId
            ? FranchiseReturnStatus.PENDING
            : FranchiseReturnStatus.RESOLVED,
          oldItems: oldSnapshots as Prisma.InputJsonValue,
          newItems:
            dto.type === ReturnInventoryEnum.EXCHANGE || hasNewItems
              ? (newSnapshots as Prisma.InputJsonValue)
              : undefined,
          oldTotalAmount: oldTotal,
          newTotalAmount:
            dto.type === ReturnInventoryEnum.EXCHANGE ||
            isStockRequestWithReplacement
              ? newTotal
              : null,
          finalPayableAmount,
          processedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.sub,
          action: 'product_return.create',
          resource: 'FranchiseReturn',
          resourceId: returnRecord.id,
          metadata: {
            sourceType,
            orderNumber: order?.orderNumber ?? null,
            stockRequestId: stockRequest?.id ?? null,
            type: dto.type,
            reason: dto.reason ?? null,
            oldItems: oldSnapshots,
            newItems: hasNewItems ? newSnapshots : [],
            oldTotalAmount: oldTotal.toFixed(2),
            newTotalAmount:
              dto.type === ReturnInventoryEnum.EXCHANGE ||
              isStockRequestWithReplacement
                ? newTotal.toFixed(2)
                : null,
          } as Prisma.InputJsonValue,
          ip,
        },
      });

      return {
        returnRecord,
        defectiveInventory: defectiveLedgerRows,
        conflictInventory: conflictLedgerRows,
        returnInventory: returnLedgerRows,
      };
    });
  }

  async createOnlineRequest(
    dto: ProductReturnCreateDto,
    user: JwtUser,
    ip?: string,
  ): Promise<ReturnProcessingResult> {
    if (!user.customerId) {
      throw new ForbiddenException('No customer linked to current user');
    }

    if (dto.stockRequestId) {
      throw new BadRequestException(
        'Online customer requests must be created from an order only',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const order = dto.orderNumber
        ? await this.loadOrder(tx, dto.orderNumber)
        : null;

      if (!order) {
        throw new NotFoundException('Source record not found');
      }

      if (order.customerId !== user.customerId) {
        throw new ForbiddenException(
          'You are not allowed to create this request',
        );
      }

      if (order.channel !== OrderChannel.ONLINE) {
        throw new BadRequestException(
          'Online customer requests require an online order',
        );
      }

      const draft = await this.buildPreparedDraft(tx, dto, order.franchiseId);

      const supportsStockRequestField = await this.supportsStockRequestField();

      const returnRecord = await this.persistReturnRequest(tx, {
        franchiseId: order.franchiseId,
        orderId: order.id,
        customerId: order.customerId ?? null,
        stockRequestId: null,
        returnType: dto.type,
        reason: dto.reason ?? '',
        refundRequested: dto.type === ReturnInventoryEnum.REFUND,
        status: FranchiseReturnStatus.PENDING,
        oldItems: draft.oldSnapshots,
        newItems:
          dto.type === ReturnInventoryEnum.EXCHANGE ? draft.newSnapshots : [],
        oldTotalAmount: draft.oldTotal,
        newTotalAmount:
          dto.type === ReturnInventoryEnum.EXCHANGE ? draft.newTotal : null,
        processedAt: null,
        supportsStockRequestField,
      });

      await this.logRequestAudit(tx, {
        userId: user.sub,
        action: 'product_return.online_request.create',
        resourceId: returnRecord.id,
        metadata: {
          orderNumber: order.orderNumber,
          type: dto.type,
          reason: dto.reason ?? null,
          oldItems: draft.oldSnapshots,
          newItems:
            dto.type === ReturnInventoryEnum.EXCHANGE ? draft.newSnapshots : [],
          oldTotalAmount: draft.oldTotal.toFixed(2),
          newTotalAmount:
            dto.type === ReturnInventoryEnum.EXCHANGE
              ? draft.newTotal.toFixed(2)
              : null,
        } as Prisma.InputJsonValue,
        ip,
      });

      return {
        returnRecord,
        defectiveInventory: [],
        conflictInventory: [],
        returnInventory: [],
      };
    });
  }

  async updateOnlineRequest(
    returnId: string,
    dto: ProductReturnCreateDto,
    user: JwtUser,
    ip?: string,
  ): Promise<ReturnProcessingResult> {
    if (!user.customerId) {
      throw new ForbiddenException('No customer linked to current user');
    }

    return this.prisma.$transaction(async (tx) => {
      const supportsStockRequestField = await this.supportsStockRequestField();
      const request = await this.loadReturnRequest(
        tx,
        returnId,
        supportsStockRequestField,
      );
      this.assertPendingRequest(request);
      this.assertCustomerOwnership(request, user.customerId);

      if (dto.stockRequestId) {
        throw new BadRequestException(
          'Online customer requests cannot be converted to stock request returns',
        );
      }

      if (!request?.order?.orderNumber) {
        throw new BadRequestException('Request is missing the source order');
      }

      const draft = await this.buildPreparedDraft(
        tx,
        {
          ...dto,
          orderNumber: request.order.orderNumber,
          stockRequestId: undefined,
        },
        request.order.franchiseId,
      );

      const returnRecord = await tx.franchiseReturn.update({
        where: { id: returnId },
        select: this.buildReturnSelect(supportsStockRequestField),
        data: {
          returnType: dto.type,
          reason: dto.reason ?? '',
          refundRequested: dto.type === ReturnInventoryEnum.REFUND,
          status: FranchiseReturnStatus.PENDING,
          oldItems: draft.oldSnapshots as Prisma.InputJsonValue,
          newItems:
            dto.type === ReturnInventoryEnum.EXCHANGE
              ? (draft.newSnapshots as Prisma.InputJsonValue)
              : undefined,
          oldTotalAmount: draft.oldTotal,
          newTotalAmount:
            dto.type === ReturnInventoryEnum.EXCHANGE ? draft.newTotal : null,
          processedAt: null,
        },
      });

      await this.logRequestAudit(tx, {
        userId: user.sub,
        action: 'product_return.online_request.update',
        resourceId: returnRecord.id,
        metadata: {
          orderNumber: request.order.orderNumber,
          type: dto.type,
          reason: dto.reason ?? null,
          oldItems: draft.oldSnapshots,
          newItems:
            dto.type === ReturnInventoryEnum.EXCHANGE ? draft.newSnapshots : [],
          oldTotalAmount: draft.oldTotal.toFixed(2),
          newTotalAmount:
            dto.type === ReturnInventoryEnum.EXCHANGE
              ? draft.newTotal.toFixed(2)
              : null,
        } as Prisma.InputJsonValue,
        ip,
      });

      return {
        returnRecord,
        defectiveInventory: [],
        conflictInventory: [],
        returnInventory: [],
      };
    });
  }

  async deleteOnlineRequest(returnId: string, user: JwtUser, ip?: string) {
    if (!user.customerId) {
      throw new ForbiddenException('No customer linked to current user');
    }

    return this.prisma.$transaction(async (tx) => {
      const supportsStockRequestField = await this.supportsStockRequestField();
      const request = await this.loadReturnRequest(
        tx,
        returnId,
        supportsStockRequestField,
      );
      this.assertPendingRequest(request);
      this.assertCustomerOwnership(request, user.customerId);

      const deleted = await tx.franchiseReturn.update({
        where: { id: returnId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      await this.logRequestAudit(tx, {
        userId: user.sub,
        action: 'product_return.online_request.delete',
        resourceId: deleted.id,
        metadata: {
          orderNumber: request?.order?.orderNumber ?? null,
          stockRequestId: request?.stockRequestId ?? null,
        } as Prisma.InputJsonValue,
        ip,
      });

      return { deletedId: deleted.id };
    });
  }

  async approveOnlineRequest(
    returnId: string,
    user: JwtUser,
    ip?: string,
  ): Promise<ReturnProcessingResult> {
    return this.prisma.$transaction(async (tx) => {
      const supportsStockRequestField = await this.supportsStockRequestField();
      const request = await this.loadReturnRequest(
        tx,
        returnId,
        supportsStockRequestField,
      );
      this.assertPendingRequest(request);
      const isAdmin = this.isAdminUser(user);
      const franchiseId =
        user.franchiseId ?? user.franchiseOwnerId ?? request.order?.franchiseId;

      if (!franchiseId) {
        throw new ForbiddenException('No franchise linked to current user');
      }

      if (!isAdmin) {
        this.assertFranchiseOwnership(request, franchiseId);
      }

      if (!request?.order) {
        throw new BadRequestException(
          'Only order-based online requests can be approved through this endpoint',
        );
      }

      const draft: PreparedReturnDraft = {
        order: request.order,
        stockRequest: request.stockRequest,
        sourceType: request.order ? 'ORDER' : 'STOCK_REQUEST',
        sourceId: request.order?.id ?? request.stockRequest!.id,
        oldSnapshots: this.parseSnapshots(request.oldItems as Prisma.JsonValue),
        newSnapshots: this.parseSnapshots(request.newItems as Prisma.JsonValue),
        oldTotal: this.decimal(request.oldTotalAmount ?? 0),
        newTotal: this.decimal(request.newTotalAmount ?? 0),
        groupedOldItems: this.parseSnapshots(
          request.oldItems as Prisma.JsonValue,
        ).map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          condition: item.condition,
        })),
        groupedNewItems: this.parseSnapshots(
          request.newItems as Prisma.JsonValue,
        ).map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          condition: item.condition,
        })),
      };

      const effects = await this.applyPreparedDraftEffects(
        user,
        tx,
        draft,
        franchiseId,
      );

      const result = await this.prisma.franchiseReturn.findUniqueOrThrow({
        where: { id: returnId },
        select: { status: true },
      });

      let resultStatus;
      if (result.status === FranchiseReturnStatus.PENDING) {
        resultStatus = FranchiseReturnStatus.APPROVED;
      } else if (result.status === FranchiseReturnStatus.APPROVED) {
        resultStatus = FranchiseReturnStatus.RESOLVED;
      } else {
        resultStatus = result.status;
      }

      const returnRecord = await tx.franchiseReturn.update({
        where: { id: returnId },
        select: this.buildReturnSelect(supportsStockRequestField),
        data: {
          status: FranchiseReturnStatus.APPROVED,
          processedAt: new Date(),
        },
      });

      await this.logRequestAudit(tx, {
        userId: user.sub,
        action: 'product_return.online_request.approve',
        resourceId: returnRecord.id,
        metadata: {
          orderNumber: request.order.orderNumber,
          processedAt: returnRecord.processedAt,
        } as Prisma.InputJsonValue,
        ip,
      });

      return {
        returnRecord,
        defectiveInventory: effects.defectiveInventory,
        conflictInventory: effects.conflictInventory,
        returnInventory: effects.returnInventory,
      };
    });
  }

  async approveStockRequestRequest(
    returnId: string,
    user: JwtUser,
    ip?: string,
  ): Promise<ReturnProcessingResult> {
    return this.prisma.$transaction(async (tx) => {
      const supportsStockRequestField = await this.supportsStockRequestField();

      if (!supportsStockRequestField) {
        throw new BadRequestException(
          'Stock-request approval requires the database migration that adds FranchiseReturn.stockRequestId',
        );
      }

      const request = await this.loadReturnRequest(
        tx,
        returnId,
        supportsStockRequestField,
      );
      this.assertPendingRequest(request);

      if (!request?.stockRequest) {
        throw new BadRequestException(
          'Only stock-request based requests can be approved through this endpoint',
        );
      }

      const isAdmin = this.isAdminUser(user);
      const franchiseId =
        user.franchiseId ??
        user.franchiseOwnerId ??
        request.stockRequest.franchiseId;

      if (!franchiseId) {
        throw new ForbiddenException('No franchise linked to current user');
      }

      if (!isAdmin) {
        this.assertFranchiseOwnership(request, franchiseId);
      }

      const draft: PreparedReturnDraft = {
        order: request.order,
        stockRequest: request.stockRequest,
        sourceType: 'STOCK_REQUEST',
        sourceId: request.stockRequest.id,
        oldSnapshots: this.parseSnapshots(request.oldItems as Prisma.JsonValue),
        newSnapshots: this.parseSnapshots(request.newItems as Prisma.JsonValue),
        oldTotal: this.decimal(request.oldTotalAmount ?? 0),
        newTotal: this.decimal(request.newTotalAmount ?? 0),
        groupedOldItems: this.parseSnapshots(
          request.oldItems as Prisma.JsonValue,
        ).map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          condition: item.condition,
        })),
        groupedNewItems: this.parseSnapshots(
          request.newItems as Prisma.JsonValue,
        ).map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          condition: item.condition,
        })),
      };

      const sourceFranchiseId = request.stockRequest.franchiseId;
      const effects = await this.applyPreparedDraftEffects(
        user,
        tx,
        draft,
        sourceFranchiseId,
      );

      const result = await this.prisma.franchiseReturn.findUniqueOrThrow({
        where: { id: returnId },
        select: { status: true },
      });

      let resultStatus;
      if (result.status === FranchiseReturnStatus.PENDING) {
        resultStatus = FranchiseReturnStatus.APPROVED;
      } else if (result.status === FranchiseReturnStatus.APPROVED) {
        resultStatus = FranchiseReturnStatus.RESOLVED;
      } else {
        resultStatus = result.status;
      }

      const returnRecord = await tx.franchiseReturn.update({
        where: { id: returnId },
        select: this.buildReturnSelect(supportsStockRequestField),
        data: {
          status: resultStatus,
          processedAt: new Date(),
        },
      });

      await this.logRequestAudit(tx, {
        userId: user.sub,
        action: 'product_return.stock_request.approve',
        resourceId: returnRecord.id,
        metadata: {
          stockRequestId: request.stockRequest.id,
          processedAt: returnRecord.processedAt,
        } as Prisma.InputJsonValue,
        ip,
      });

      return {
        returnRecord,
        defectiveInventory: effects.defectiveInventory,
        conflictInventory: effects.conflictInventory,
        returnInventory: effects.returnInventory,
      };
    });
  }

  async rejectOnlineRequest(
    returnId: string,
    dto: ReturnRequestRejectDto,
    user: JwtUser,
    ip?: string,
  ): Promise<ReturnProcessingResult> {
    return this.prisma.$transaction(async (tx) => {
      const supportsStockRequestField = await this.supportsStockRequestField();
      const request = await this.loadReturnRequest(
        tx,
        returnId,
        supportsStockRequestField,
      );
      this.assertPendingRequest(request);

      if (!request?.order) {
        throw new BadRequestException(
          'Only order-based online requests can be rejected through this endpoint',
        );
      }

      const isAdmin = this.isAdminUser(user);
      const franchiseId =
        user.franchiseId ??
        user.franchiseOwnerId ??
        request?.order?.franchiseId ??
        request?.stockRequest?.franchiseId;

      if (!franchiseId) {
        throw new ForbiddenException('No franchise linked to current user');
      }

      if (!isAdmin) {
        this.assertFranchiseOwnership(request, franchiseId);
      }

      const returnRecord = await tx.franchiseReturn.update({
        where: { id: returnId },
        select: this.buildReturnSelect(supportsStockRequestField),
        data: {
          status: FranchiseReturnStatus.REJECTED,
          resolutionNote: dto.reason,
        },
      });

      await this.logRequestAudit(tx, {
        userId: user.sub,
        action: 'product_return.online_request.reject',
        resourceId: returnRecord.id,
        metadata: {
          orderNumber: request?.order?.orderNumber ?? null,
          reason: dto.reason,
        } as Prisma.InputJsonValue,
        ip,
      });

      return {
        returnRecord,
        defectiveInventory: [],
        conflictInventory: [],
        returnInventory: [],
      };
    });
  }

  async rejectStockRequestRequest(
    returnId: string,
    dto: ReturnRequestRejectDto,
    user: JwtUser,
    ip?: string,
  ): Promise<ReturnProcessingResult> {
    return this.prisma.$transaction(async (tx) => {
      const supportsStockRequestField = await this.supportsStockRequestField();

      if (!supportsStockRequestField) {
        throw new BadRequestException(
          'Stock-request rejection requires the database migration that adds FranchiseReturn.stockRequestId',
        );
      }

      const request = await this.loadReturnRequest(
        tx,
        returnId,
        supportsStockRequestField,
      );
      this.assertPendingRequest(request);

      if (!request?.stockRequest) {
        throw new BadRequestException(
          'Only stock-request based requests can be rejected through this endpoint',
        );
      }

      if (!this.isAdminUser(user)) {
        throw new ForbiddenException(
          'Only SUPERADMIN and ADMIN_STAFF can reject stock-request returns',
        );
      }

      const returnRecord = await tx.franchiseReturn.update({
        where: { id: returnId },
        select: this.buildReturnSelect(supportsStockRequestField),
        data: {
          status: FranchiseReturnStatus.REJECTED,
          resolutionNote: dto.reason,
        },
      });

      await this.logRequestAudit(tx, {
        userId: user.sub,
        action: 'product_return.stock_request.reject',
        resourceId: returnRecord.id,
        metadata: {
          stockRequestId: request.stockRequest.id,
          reason: dto.reason,
        } as Prisma.InputJsonValue,
        ip,
      });

      return {
        returnRecord,
        defectiveInventory: [],
        conflictInventory: [],
        returnInventory: [],
      };
    });
  }

  // async listReturnInventory(query: ReturnInventoryQueryDto) {
  // }
}
