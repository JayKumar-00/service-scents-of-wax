import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FranchiseStatus, Role } from '@prisma/client';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { FulfillmentPreference } from '../enums/order.enum';
import {
  AllocationDto,
  CheckoutPreviewQueryDto,
  CheckoutPreviewResponseDto,
  CheckoutPreviewResponseItemDto,
  EmergencyPartialResponseDto,
  FranchiseCoverageDto,
  MultiFranchiseResponseDto,
  OutOfStockResponseDto,
  SingleFranchiseResponseDto,
  SingleOnlyUnavailableResponseDto,
  UnfulfilledItemDto,
} from '../controllers/dto/checkout-preview.dto';

interface CartItemDetails {
  productId: string;
  variantId: string | null;
  quantity: number;
  productName: string;
  productPrice: number;
  variantName: string | null;
}

interface FranchiseStockInfo {
  franchiseId: string;
  productId: string;
  quantity: number;
  reserved: number;
}

interface FranchiseWithStock {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: FranchiseStatus;
  distanceKm: number;
  stockMap: Map<string, FranchiseStockInfo>;
}

interface CartContext {
  cartId: string;
  userId: string | null;
  cartItems: CartItemDetails[];
  franchisesWithStock: FranchiseWithStock[];
}

@Injectable()
export class FulfillmentPreviewService {
  constructor(private readonly prisma: PrismaService) {}

  async previewCheckout(
    cartId: string,
    user: JwtUser,
    query: CheckoutPreviewQueryDto,
  ): Promise<CheckoutPreviewResponseDto> {
    return this.resolveFulfillmentPlan(cartId, user, query);
  }

  async resolveFulfillmentPlan(
    cartId: string,
    user: JwtUser,
    query: CheckoutPreviewQueryDto & { targetFranchiseId?: string },
  ): Promise<CheckoutPreviewResponseDto> {
    const context = await this.loadCartContext(cartId, user);

    if (query.targetFranchiseId) {
      context.franchisesWithStock = context.franchisesWithStock.filter(
        (f) => f.id === query.targetFranchiseId,
      );
    }

    if (query.latitude == null || query.longitude == null) {
      throw new BadRequestException('Delivery coordinates are required');
    }

    const deliveryLat = query.latitude;
    const deliveryLng = query.longitude;
    const preference =
      query.fulfillmentPreference ?? FulfillmentPreference.ALLOW_SPLIT;

    const sortedFranchises = await this.getSortedFranchisesByDistance(
      deliveryLat,
      deliveryLng,
      context.franchisesWithStock,
    );

    if (preference === FulfillmentPreference.SINGLE_ONLY) {
      return this.buildSingleOnlyPlan(sortedFranchises, context.cartItems);
    }

    // For ALLOW_SPLIT and EMERGENCY_PARTIAL, first try to fulfill 100% of the cart using a single franchise
    if (
      preference === FulfillmentPreference.ALLOW_SPLIT ||
      preference === FulfillmentPreference.EMERGENCY_PARTIAL
    ) {
      const singleFranchisePlan = this.checkSingleFranchiseFulfillment(
        sortedFranchises,
        context.cartItems,
      );
      if (singleFranchisePlan) {
        return singleFranchisePlan;
      }
    }

    if (preference === FulfillmentPreference.EMERGENCY_PARTIAL) {
      return this.buildEmergencyPartialPlan(
        sortedFranchises,
        context.cartItems,
      );
    }

    return this.buildSplitPlan(sortedFranchises, context.cartItems);
  }

  private async loadCartContext(
    cartId: string,
    user: JwtUser,
  ): Promise<CartContext> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      select: {
        id: true,
        userId: true,
        items: {
          select: {
            productId: true,
            variantId: true,
            quantity: true,
            priceAtAddition: true,
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (user.role === Role.CUSTOMER && cart.userId !== user.sub) {
      throw new NotFoundException('Cart not found');
    }

    if (!cart.items || cart.items.length === 0) {
      throw new NotFoundException('Cart is empty');
    }

    const rawItems = cart.items;
    const productIds = Array.from(new Set(rawItems.map((i) => i.productId)));
    const variantIds = Array.from(
      new Set(
        rawItems
          .map((i) => i.variantId)
          .filter((id): id is string => id !== null),
      ),
    );

    const [products, variants, franchises] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true },
      }),
      this.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, attributeSummary: true },
      }),
      this.prisma.franchise.findMany({
        where: { status: FranchiseStatus.ACTIVE },
        select: {
          id: true,
          name: true,
          code: true,
          latitude: true,
          longitude: true,
          status: true,
        },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const cartItems: CartItemDetails[] = rawItems.map((item) => {
      const product = productMap.get(item.productId);
      const snapshotPrice = Number(item.priceAtAddition);
      return {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        productName: product?.name ?? 'Unknown Product',
        productPrice: Number.isFinite(snapshotPrice)
          ? snapshotPrice
          : Number(product?.price ?? 0),
        variantName: item.variantId
          ? (variantMap.get(item.variantId)?.attributeSummary ?? null)
          : null,
      };
    });

    const franchisesWithStock = await this.fetchFranchiseStock(
      cartItems,
      franchises,
    );

    return {
      cartId: cart.id,
      userId: cart.userId,
      cartItems,
      franchisesWithStock,
    };
  }

  private async fetchFranchiseStock(
    cartItems: { productId: string }[],
    franchises: {
      id: string;
      name: string;
      code: string;
      latitude: number;
      longitude: number;
      status: FranchiseStatus;
    }[],
  ): Promise<FranchiseWithStock[]> {
    const productIds = Array.from(new Set(cartItems.map((i) => i.productId)));
    
    // Load both FranchiseStock and WarehouseStock
    const [stockRows, warehouseStockRows] = await Promise.all([
      this.prisma.franchiseStock.findMany({
        where: {
          productId: { in: productIds },
          franchise: { status: FranchiseStatus.ACTIVE },
        },
        select: {
          franchiseId: true,
          productId: true,
          quantity: true,
          reserved: true,
        },
      }),
      this.prisma.warehouseStock.findMany({
        where: {
          productId: { in: productIds },
        },
        select: {
          productId: true,
          quantity: true,
          reserved: true,
        },
      }),
    ]);

    const result: FranchiseWithStock[] = [];
    for (const franchise of franchises) {
      const stockMap = new Map<string, FranchiseStockInfo>();

      if (franchise.code === 'CENTRAL_WAREHOUSE') {
        for (const row of warehouseStockRows) {
          const available = row.quantity - row.reserved;
          if (available <= 0) continue;
          stockMap.set(row.productId, {
            franchiseId: franchise.id,
            productId: row.productId,
            quantity: row.quantity,
            reserved: row.reserved,
          });
        }
      } else {
        for (const row of stockRows) {
          if (row.franchiseId !== franchise.id) continue;
          const available = row.quantity - row.reserved;
          if (available <= 0) continue;
          stockMap.set(row.productId, {
            franchiseId: row.franchiseId,
            productId: row.productId,
            quantity: row.quantity,
            reserved: row.reserved,
          });
        }
      }

      if (stockMap.size > 0) {
        result.push({
          id: franchise.id,
          name: franchise.name,
          latitude: franchise.latitude,
          longitude: franchise.longitude,
          status: franchise.status,
          distanceKm: 0,
          stockMap,
        });
      }
    }

    return result;
  }

  private checkSingleFranchiseFulfillment(
    sorted: FranchiseWithStock[],
    cartItems: CartItemDetails[],
  ): SingleFranchiseResponseDto | null {
    for (const franchise of sorted) {
      const allAvailable = cartItems.every((item) => {
        const available = this.getAvailableStock(franchise, item.productId);
        return available >= item.quantity;
      });

      if (!allAvailable) continue;

      return {
        success: true,
        mode: 'SINGLE_FRANCHISE',
        franchiseId: franchise.id,
        franchiseName: franchise.name,
        items: cartItems.map((item) =>
          this.buildResponseItem(item, item.quantity, franchise, item.quantity),
        ),
        estimatedDelivery: this.estimateDeliveryTime(franchise.distanceKm),
        distanceKm: franchise.distanceKm,
      };
    }
    return null;
  }

  private async buildSingleOnlyPlan(
    sorted: FranchiseWithStock[],
    cartItems: CartItemDetails[],
  ): Promise<SingleFranchiseResponseDto | SingleOnlyUnavailableResponseDto> {
    const singlePlan = this.checkSingleFranchiseFulfillment(sorted, cartItems);
    if (singlePlan) {
      return singlePlan;
    }

    const coverage = sorted.map((franchise) =>
      this.buildCoverageEntry(franchise, cartItems),
    );
    const unfulfilledItems = this.buildGloballyUnfulfilledItems(
      sorted,
      cartItems,
    );

    return {
      success: false,
      mode: 'SINGLE_ONLY_UNAVAILABLE',
      coverage,
      unfulfilledItems,
    };
  }

  private async buildSplitPlan(
    sorted: FranchiseWithStock[],
    cartItems: CartItemDetails[],
  ): Promise<MultiFranchiseResponseDto | OutOfStockResponseDto> {
    const allocations: AllocationDto[] = [];
    const assigned = new Set<number>();
    const unfulfilled: UnfulfilledItemDto[] = [];

    for (const franchise of sorted) {
      const itemsHere: CheckoutPreviewResponseItemDto[] = [];

      for (let index = 0; index < cartItems.length; index += 1) {
        if (assigned.has(index)) continue;

        const item = cartItems[index];
        const available = this.getAvailableStock(franchise, item.productId);
        if (available >= item.quantity) {
          itemsHere.push(
            this.buildResponseItem(item, item.quantity, franchise),
          );
          assigned.add(index);
        }
      }

      if (itemsHere.length > 0) {
        allocations.push({
          franchiseId: franchise.id,
          franchiseName: franchise.name,
          distanceKm: franchise.distanceKm,
          items: itemsHere,
        });
      }
    }

    for (let index = 0; index < cartItems.length; index += 1) {
      if (assigned.has(index)) continue;
      const item = cartItems[index];
      const available = this.getBestAvailableStock(sorted, item.productId);
      unfulfilled.push({
        productId: item.productId,
        productName: item.productName,
        requiredQuantity: item.quantity,
        availableQuantity: available,
        reason:
          available > 0
            ? 'No single franchise can fulfill the full quantity'
            : 'No active franchise with sufficient stock available',
      });
    }

    if (unfulfilled.length > 0) {
      return {
        success: false,
        mode: 'OUT_OF_STOCK',
        unfulfilledItems: unfulfilled,
      };
    }

    return {
      success: true,
      mode: 'MULTI_FRANCHISE_REQUIRED',
      allocations,
      customerChoiceRequired: true,
    };
  }

  private async buildEmergencyPartialPlan(
    sorted: FranchiseWithStock[],
    cartItems: CartItemDetails[],
  ): Promise<EmergencyPartialResponseDto | OutOfStockResponseDto> {
    const allocationsMap = new Map<string, AllocationDto>();
    const remainingStock = new Map<string, Map<string, number>>();

    for (const franchise of sorted) {
      const stock = new Map<string, number>();
      for (const [productId, info] of franchise.stockMap.entries()) {
        stock.set(productId, info.quantity - info.reserved);
      }
      remainingStock.set(franchise.id, stock);
    }

    for (const item of cartItems) {
      let remainingQuantity = item.quantity;

      for (const franchise of sorted) {
        if (remainingQuantity <= 0) break;

        const stock = remainingStock.get(franchise.id);
        const available = stock?.get(item.productId) ?? 0;
        if (available <= 0) continue;

        const allocatedQuantity = Math.min(remainingQuantity, available);
        remainingQuantity -= allocatedQuantity;
        stock!.set(item.productId, available - allocatedQuantity);

        const allocation = this.ensureAllocationBucket(
          allocationsMap,
          franchise,
        );
        allocation.items.push(
          this.buildResponseItem(
            item,
            allocatedQuantity,
            franchise,
            item.quantity,
            remainingQuantity,
          ),
        );
      }
    }

    const allocations = Array.from(allocationsMap.values()).filter(
      (allocation) => allocation.items.length > 0,
    );

    const unfulfilledItems: UnfulfilledItemDto[] = [];
    for (const item of cartItems) {
      const allocated = allocations.reduce((sum, allocation) => {
        const found = allocation.items.find(
          (line) =>
            line.productId === item.productId &&
            line.variantId === (item.variantId ?? undefined),
        );
        return sum + (found?.allocatedQuantity ?? 0);
      }, 0);

      if (allocated < item.quantity) {
        const bestAvailable = this.getBestAvailableStock(
          sorted,
          item.productId,
        );
        unfulfilledItems.push({
          productId: item.productId,
          productName: item.productName,
          requiredQuantity: item.quantity - allocated,
          availableQuantity: bestAvailable,
          reason:
            allocated > 0
              ? 'Allocated partially and the remaining quantity could not be covered'
              : 'No active franchise with sufficient stock available',
        });
      }
    }

    if (allocations.length === 0) {
      return this.buildOutOfStockResponse(unfulfilledItems);
    }

    return {
      success: true,
      mode: 'EMERGENCY_PARTIAL',
      allocations,
      unfulfilledItems:
        unfulfilledItems.length > 0 ? unfulfilledItems : undefined,
    };
  }

  private ensureAllocationBucket(
    allocationsMap: Map<string, AllocationDto>,
    franchise: FranchiseWithStock,
  ): AllocationDto {
    const existing = allocationsMap.get(franchise.id);
    if (existing) {
      return existing;
    }

    const created: AllocationDto = {
      franchiseId: franchise.id,
      franchiseName: franchise.name,
      distanceKm: franchise.distanceKm,
      items: [],
    };
    allocationsMap.set(franchise.id, created);
    return created;
  }

  private buildCoverageEntry(
    franchise: FranchiseWithStock,
    cartItems: CartItemDetails[],
  ): FranchiseCoverageDto {
    const availableItems: CheckoutPreviewResponseItemDto[] = [];
    const missingItems: UnfulfilledItemDto[] = [];

    for (const item of cartItems) {
      const available = this.getAvailableStock(franchise, item.productId);
      if (available >= item.quantity) {
        availableItems.push(
          this.buildResponseItem(item, item.quantity, franchise, item.quantity),
        );
        continue;
      }

      missingItems.push({
        productId: item.productId,
        productName: item.productName,
        requiredQuantity: item.quantity,
        availableQuantity: available,
        reason:
          available > 0
            ? `Only ${available} available at ${franchise.name}`
            : `Not stocked at ${franchise.name}`,
      });
    }

    return {
      franchiseId: franchise.id,
      franchiseName: franchise.name,
      distanceKm: franchise.distanceKm,
      availableItems,
      missingItems,
    };
  }

  private buildGloballyUnfulfilledItems(
    sorted: FranchiseWithStock[],
    cartItems: CartItemDetails[],
  ): UnfulfilledItemDto[] {
    return cartItems
      .filter((item) => this.getBestAvailableStock(sorted, item.productId) <= 0)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        requiredQuantity: item.quantity,
        availableQuantity: 0,
        reason: 'No active franchise with sufficient stock available',
      }));
  }

  private getBestAvailableStock(
    sorted: FranchiseWithStock[],
    productId: string,
  ): number {
    return sorted.reduce(
      (best, franchise) =>
        Math.max(best, this.getAvailableStock(franchise, productId)),
      0,
    );
  }

  private getAvailableStock(
    franchise: FranchiseWithStock,
    productId: string,
  ): number {
    const info = franchise.stockMap.get(productId);
    return info ? info.quantity - info.reserved : 0;
  }

  private buildResponseItem(
    item: CartItemDetails,
    allocatedQuantity: number,
    franchise: FranchiseWithStock,
    requestedQuantity = item.quantity,
    shortfallQuantity = Math.max(0, requestedQuantity - allocatedQuantity),
  ): CheckoutPreviewResponseItemDto {
    return {
      productId: item.productId,
      productName: item.productName,
      variantId: item.variantId ?? undefined,
      variantName: item.variantName ?? undefined,
      quantity: requestedQuantity,
      requestedQuantity,
      allocatedQuantity,
      unitPrice: item.productPrice,
      availableStock: this.getAvailableStock(franchise, item.productId),
      shortfallQuantity: shortfallQuantity > 0 ? shortfallQuantity : undefined,
    };
  }

  private async getSortedFranchisesByDistance(
    deliveryLat: number,
    deliveryLng: number,
    franchisesWithStock: FranchiseWithStock[],
  ): Promise<FranchiseWithStock[]> {
    return franchisesWithStock
      .map((franchise) => ({
        ...franchise,
        distanceKm: this.calculateDistance(
          deliveryLat,
          deliveryLng,
          franchise.latitude,
          franchise.longitude,
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const radiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radiusKm * c;
  }

  private estimateDeliveryTime(distanceKm: number): string {
    if (distanceKm < 2) return '20-30 mins';
    if (distanceKm < 5) return '30-45 mins';
    if (distanceKm < 10) return '45-60 mins';
    return '60+ mins';
  }

  private buildOutOfStockResponse(
    unfulfilledItems: UnfulfilledItemDto[],
  ): OutOfStockResponseDto {
    return {
      success: false,
      mode: 'OUT_OF_STOCK',
      unfulfilledItems,
    };
  }
}
