import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FranchiseStock,
  HubInventory,
  InventoryReservation,
  OrderItem,
  ProductStatus,
  PromotionProduct,
  ReplenishmentPolicy,
  StockRequest,
  StockTransferLine,
  SupplyChainEvent,
  WarehouseStock,
} from '@prisma/client';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateLocalProductDto } from './dto/update-product.dto';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { AttributesService } from '../attributes/attributes.service';
import {
  generateSkuWithoutVariant,
  generateSlug,
} from 'src/common/utils/generate-slug-sku.util';
import { CreateLocalProductDto } from './dto/create-local-product.dto';

class Seo {
  title!: string;
  sub_title?: string;
  keywords!: string[];
  tags?: string[];
}

export type ExplicitAttribute = {
  label?: string;
  value?: string;
};

export type Charges = {
  platformFee: number;
  packagingFee: number;
  taxPercent: number;
  otherCharges: number;
};

export type MOQ = {
  min?: number;
  price?: number;
};

export type VarientItem = {
  id: string;
  seo: Seo;
  price: number;
  mrpPrice: number;
  imageUrl?: string;
  imageUrls: string[];
  description: string;
};

export type ProductItem = {
  id: string;
  name: string;
  sub_title: string; //add
  seo: Seo; //add
  slug: string;
  sku: string; //add
  categoryId: string;
  brandId: string;
  brand?: string;
  hsnCode: string; //add
  stock: number; //add
  moq?: MOQ; // add - optional
  attributeIds?: string[]; //add
  explicitAttributes?: ExplicitAttribute[]; //add
  features?: string[]; //add
  varients: Record<string, string>; //add
  sellingPrice: number; //modify selling price
  mrpPrice: number; //maximum retail price
  charges: Charges; //add
  franchiseEarnings: number; //add
  description: string;
  thumbnail?: string;
  imageUrl?: string;
  imageUrls: string[];
  active: boolean;
  fastDelivery: boolean;
  isFeatured: boolean;
  occasions?: string;
  ratingAvg: number;
  reviewCount: number;
  clickCount: number;
  /// Default GST % shown on invoices / pricing tools (0 = use outlet default)
  defaultGstRatePercent: number;
  /// Product list MRP (can be null for legacy rows)
  franchiseStocks: FranchiseStock[];
  hubInventories: HubInventory[];
  reservations: InventoryReservation[];
  orderItems: OrderItem[];
  warehouseStocks?: WarehouseStock;
  promotionTargets: PromotionProduct[];
  replenPolicies: ReplenishmentPolicy[];
  stockRequests: StockRequest[];
  stockTransferLines: StockTransferLine[];
  supplyChainEvents: SupplyChainEvent[];

  // Some Required Additional Fields
  // deviceId?: string; //add
  // barCode?: string; //add
  // isReturnable: boolean; //add
  // isRefundable: boolean; //add
  // returnWindowDays: number; //add
  // warrantyPeriodMonths: number; //add
  // weight: number; // in grams
  // length: number; // in cm
  // width: number; // in cm
  // height: number; // in cm

  createdAt: Date;
  updatedAt?: Date;
};

const PRODUCT_STORAGE: Map<string, ProductItem> = new Map();
let COUNTER = 1;

@Injectable()
export class LocalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly attributesService: AttributesService,
  ) {}

  private generateVariantKey(variant: Record<string, string>) {
    return Object.keys(variant)
      .sort()
      .map((k) => `${k}:${variant[k]}`)
      .join('|');
  }

  /**
   * Generate all possible variant combinations from attribute IDs
   * @param attributeIds - Array of attribute IDs to generate variants from
   * @returns Array of variant combinations or null if no valid attributes found
   */
  private async generateVariants(
    attributeIds: string[],
  ): Promise<Record<string, string>[] | null> {
    // Check if attributeIds is provided and not empty
    if (!attributeIds || attributeIds.length === 0) {
      return null;
    }

    try {
      // Fetch all attributes with their values
      const attributes: Record<string, string[]> = {};

      for (const attributeId of attributeIds) {
        const attribute = await this.attributesService.findOne(attributeId);

        // Check if attribute has values
        if (attribute.values && attribute.values.length > 0) {
          // Store attribute values indexed by attribute title (slug)
          attributes[attribute.slug] = attribute.values.map(
            (v) => v.slug || v.title,
          );
        }
      }

      // If no valid attributes with values found, return null
      if (Object.keys(attributes).length === 0) {
        return null;
      }

      // Generate all possible combinations using cartesian product
      const attributeNames = Object.keys(attributes);
      let combinations: Record<string, string>[] = [{}];

      for (const attrName of attributeNames) {
        const attrValues = attributes[attrName];
        const temp: Record<string, string>[] = [];

        for (const combo of combinations) {
          for (const value of attrValues) {
            temp.push({
              ...combo,
              [attrName]: value,
            });
          }
        }

        combinations = temp;
      }

      return combinations.length > 0 ? combinations : null;
    } catch (error) {
      // If attribute lookup fails, return null
      console.error('Error generating variants from attributes:', error);
      return null;
    }
  }

  private generateSKU(name: string, variant: Record<string, string>) {
    const base = name.substring(0, 4).toUpperCase();
    const suffix = Object.values(variant)
      .map((v) => v.toUpperCase())
      .join('-');

    return `${base}-${suffix}`;
  }

  // ---------------- CREATE SINGLE ----------------
  async create(dto: CreateLocalProductDto) {
    const id = String(COUNTER++);

    let varients: any[] | null = null;

    // Generate variants only if attributeIds are provided
    if (dto.attributeIds && dto.attributeIds.length > 0) {
      const combos = await this.generateVariants(dto.attributeIds);

      if (combos && combos.length > 0) {
        const map = new Map();

        for (const combo of combos) {
          const key = this.generateVariantKey(combo);

          if (!map.has(key)) {
            map.set(key, {
              id: `${id}-${map.size + 1}`,
              attributes: combo,
              sku: this.generateSKU(dto.name, combo),
              price: dto.price.sellingPrice,
              mrpPrice: dto.price.mrpPrice,
              stock: dto.stock,
            });
          }
        }

        varients = Array.from(map.values());
      }
    }

    const newProduct: ProductItem = {
      id,
      name: dto.name,
      sub_title: dto.sub_title || '',
      slug: dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name),
      sku: dto.sku
        ? dto.sku
            .trim()
            .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with "-"
            .replace(/-+/g, '-') // collapse multiple "-"
            .replace(/^-+|-+$/g, '') // trim leading/trailing "-"
        : generateSkuWithoutVariant(dto.name, dto.stock),
      hsnCode: String(dto.hsnCode || ''),
      stock: dto.stock,
      moq: dto.moq,
      attributeIds: dto.attributeIds,
      explicitAttributes: dto.explicitAttributes,
      features: dto.features,
      varients: (varients as any) || {},
      sellingPrice: dto.price.sellingPrice,
      mrpPrice: dto.price.mrpPrice,
      charges: {
        platformFee: 0,
        packagingFee: 0,
        taxPercent: 0,
        otherCharges: 0,
      },
      franchiseEarnings: dto.franchiseEarnings || 0,
      description: dto.description || '',
      thumbnail: dto.thumbnail,
      imageUrl: dto.imageUrl,
      imageUrls: dto.imageUrls || [],
      active: dto.active !== undefined ? dto.active : true,
      fastDelivery: dto.fastDelivery || false,
      isFeatured: dto.isFeatured || false,
      occasions: dto.occasions,
      ratingAvg: 0,
      reviewCount: 0,
      clickCount: 0,
      defaultGstRatePercent: 0,
      categoryId: dto.categoryId || '',
      brandId: dto.brandId || '',
      seo: dto.seo,
      createdAt: new Date(),
      franchiseStocks: [],
      hubInventories: [],
      reservations: [],
      orderItems: [],
      promotionTargets: [],
      replenPolicies: [],
      stockRequests: [],
      stockTransferLines: [],
      supplyChainEvents: [],
    };

    PRODUCT_STORAGE.set(id, newProduct);

    return newProduct;
  }

  // ---------------- CREATE BULK ----------------
  createBulk(products: CreateLocalProductDto[]) {
    return products.map((p) => this.create(p));
  }

  // ---------------- FIND ALL ----------------
  list(query: ProductQueryDto): Promise<{ data: ProductItem[]; meta: IMeta }> {
    const result = Array.from(PRODUCT_STORAGE.values());

    console.log(query);
    return Promise.resolve({
      data: result,
      meta: {
        total: result.length,
        count: result.length,
        page: 1,
        pages: 1,
      },
    });
  }

  // ---------------- FIND ONE ----------------
  findOne(id: string) {
    const product = PRODUCT_STORAGE.get(id);

    if (!product) throw new NotFoundException('Product not found');

    return product;
  }

  // ---------------- UPDATE SINGLE ----------------
  async update(id: string, updateData: UpdateLocalProductDto) {
    const existing = this.findOne(id);

    // Prepare updated product with proper property mapping
    const updated: ProductItem = {
      ...existing,
      // Only update fields that exist in updateData
      ...(updateData.name && { name: updateData.name }),
      ...(updateData.sub_title && { sub_title: updateData.sub_title }),
      ...(updateData.slug && { slug: updateData.slug }),
      ...(updateData.sku && { sku: updateData.sku }),
      ...(updateData.hsnCode && { hsnCode: String(updateData.hsnCode) }),
      ...(updateData.stock !== undefined && { stock: updateData.stock }),
      ...(updateData.moq && { moq: updateData.moq }),
      ...(updateData.attributeIds && { attributeIds: updateData.attributeIds }),
      ...(updateData.explicitAttributes && {
        explicitAttributes: updateData.explicitAttributes,
      }),
      ...(updateData.features && { features: updateData.features }),
      ...(updateData.price && {
        sellingPrice: updateData.price.sellingPrice,
        mrpPrice: updateData.price.mrpPrice,
      }),
      ...(updateData.franchiseEarnings && {
        franchiseEarnings: updateData.franchiseEarnings,
      }),
      ...(updateData.description && { description: updateData.description }),
      ...(updateData.thumbnail && { thumbnail: updateData.thumbnail }),
      ...(updateData.imageUrl && { imageUrl: updateData.imageUrl }),
      ...(updateData.imageUrls && { imageUrls: updateData.imageUrls }),
      ...(updateData.active !== undefined && { active: updateData.active }),
      ...(updateData.fastDelivery !== undefined && {
        fastDelivery: updateData.fastDelivery,
      }),
      ...(updateData.isFeatured !== undefined && {
        isFeatured: updateData.isFeatured,
      }),
      ...(updateData.occasions && { occasions: updateData.occasions }),
      updatedAt: new Date(),
    };

    // Regenerate variants if attributeIds changed
    if (updateData.attributeIds) {
      const combos = await this.generateVariants(updateData.attributeIds);

      if (combos && combos.length > 0) {
        const map = new Map();

        for (const combo of combos) {
          const key = this.generateVariantKey(combo);

          if (!map.has(key)) {
            map.set(key, {
              id: `${id}-${map.size + 1}`,
              attributes: combo,
              sku: this.generateSKU(updated.name, combo),
              price: updateData.price?.sellingPrice || existing.sellingPrice,
              mrpPrice: updateData.price?.mrpPrice || existing.mrpPrice,
              stock: updateData.stock || existing.stock,
            });
          }
        }

        updated.varients = Array.from(map.values()) as any;
      } else {
        // No valid variants found
        updated.varients = {};
      }
    }

    PRODUCT_STORAGE.set(id, updated);

    return updated;
  }

  updateStatus(id: string, status: ProductStatus) {
    const existing = this.findOne(id);

    const updated = {
      ...existing,
      status,
      id,
      updatedAt: new Date(),
    };

    const result = PRODUCT_STORAGE.set(id, updated);
    return result;
  }

  updateVisibility(id: string, visibility: ['publish' | 'unpublish']) {
    const existing = this.findOne(id);

    const updated = {
      ...existing,
      visibility,
      id,
      updatedAt: new Date(),
    };

    const result = PRODUCT_STORAGE.set(id, updated);
    return result;
  }

  // ---------------- UPDATE BULK ----------------
  updateBulk(items: { id: string; data: UpdateLocalProductDto }[]) {
    return items.map((item) => this.update(item.id, item.data));
  }

  // ---------------- DELETE SINGLE ----------------
  delete(id: string) {
    const exists = PRODUCT_STORAGE.has(id);

    if (!exists) throw new NotFoundException('Product not found');

    PRODUCT_STORAGE.delete(id);

    return { message: 'Deleted successfully', id };
  }

  // ---------------- DELETE BULK ----------------
  deleteBulk(ids: string[]) {
    const result = [];

    for (const id of ids) {
      if (PRODUCT_STORAGE.has(id)) {
        PRODUCT_STORAGE.delete(id);
        result.push(id);
      }
    }

    return {
      message: 'Bulk delete completed',
      deletedIds: result,
    };
  }
}
