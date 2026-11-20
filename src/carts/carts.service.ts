import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Cart,
  CartItem,
  CartStatus,
  CartSource,
  Prisma,
  CustomerActivityType,
} from '@prisma/client';
import { CreateAndAddCartDto, BulkAddCartDto } from './dto/create-cart.dto';
import { UpdateCartItemDto, RemoveCartItemDto } from './dto/update-cart.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { RetentionService } from 'src/retention/retention.service';

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retentionService: RetentionService,
  ) {}

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Ensure a user cart exists and return it (never null).
   * One active cart per user.
   */
  private async getOrCreateUserCart(
    userId: string,
  ): Promise<Cart & { items: CartItem[] }> {
    const cart =
      (await this.prisma.cart.findFirst({
        where: { userId, source: CartSource.USER, status: CartStatus.ACTIVE },
        include: { items: true },
      })) ||
      (await this.prisma.cart.create({
        data: { userId, source: CartSource.USER, status: CartStatus.ACTIVE },
        include: { items: true },
      }));

    return cart;
  }

  /**
   * Ensure a guest cart exists for a session and return it (never null).
   */
  private async getOrCreateGuestCart(
    sessionId: string,
  ): Promise<Cart & { items: CartItem[] }> {
    const cart =
      (await this.prisma.cart.findFirst({
        where: {
          sessionId,
          source: CartSource.GUEST,
          status: CartStatus.ACTIVE,
        },
        include: { items: true },
      })) ||
      (await this.prisma.cart.create({
        data: {
          sessionId,
          source: CartSource.GUEST,
          status: CartStatus.ACTIVE,
        },
        include: { items: true },
      }));

    return cart;
  }

  /**
   * Fetch the current selling price for a product or variant.
   * Returns as Prisma Decimal for storage.
   */
  private async fetchItemPrice(
    productId: string,
    variantId?: string | null,
  ): Promise<Prisma.Decimal> {
    if (variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      if (!variant) {
        throw new NotFoundException(
          `Product variant with ID ${variantId} not found`,
        );
      }
      return new Prisma.Decimal(variant.price);
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }
    return new Prisma.Decimal(product.price);
  }

  /**
   * Check stock availability for a product or variant.
   */
  private async checkStock(
    productId: string,
    quantity: number,
    variantId?: string | null,
  ): Promise<void> {
    if (variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      if (!variant) {
        throw new NotFoundException(
          `Product variant with ID ${variantId} not found`,
        );
      }
      if (variant.stock < quantity) {
        throw new BadRequestException(
          `Insufficient stock for variant ${variantId}. Available: ${variant.stock}, Requested: ${quantity}`,
        );
      }
      return;
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        warehouseStocks: { select: { quantity: true } },
        franchiseStocks: { select: { quantity: true } },
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const warehouseQty =
      product.warehouseStocks?.quantity ?? product.stock ?? 0;
    const franchiseQty =
      product.franchiseStocks?.reduce(
        (sum, fs) => sum + (fs.quantity ?? 0),
        0,
      ) ?? 0;
    const totalAvailable = warehouseQty + franchiseQty;

    if (totalAvailable < quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${productId}. Available: ${totalAvailable}, Requested: ${quantity}`,
      );
    }
  }

  /**
   * Recalculate and update cart summary (itemsCount & totalAmount).
   */
  private async updateCartSummary(
    cartId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    try {
      const prisma = tx || this.prisma;
      const items: CartItem[] = await prisma.cartItem.findMany({
        where: { cartId },
      });

      const itemsCount = items.length;
      const totalAmount = items.reduce(
        (sum: number, item: CartItem) =>
          sum + Number(item.priceAtAddition) * item.quantity,
        0,
      );

      await prisma.cart.update({
        where: { id: cartId },
        data: {
          itemsCount,
          totalAmount: new Prisma.Decimal(totalAmount),
        },
      });
    } catch (error) {
      console.error('Failed to update cart summary:', error);
    }
  }

  /**
   * Find a matching cart item by productId + variantId within a cart's items.
   */
  private findMatchingItem(
    items: CartItem[],
    productId: string,
    variantId?: string | null,
  ): CartItem | undefined {
    return items.find(
      (item) =>
        item.productId === productId && item.variantId === (variantId || null),
    );
  }

  // ============================================================
  // CUSTOMER ENDPOINTS (Authenticated)
  // ============================================================

  /**
   * Create a new cart or add item to existing cart.
   * Cart is per-user. Price snapshot stored at add time.
   */
  async createAndAdd(
    user: JwtUser,
    dto: CreateAndAddCartDto,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      await this.checkStock(
        dto.item.productId,
        dto.item.quantity,
        dto.item.variantId,
      );

      const priceAtAddition = await this.fetchItemPrice(
        dto.item.productId,
        dto.item.variantId,
      );

      const cart = await this.getOrCreateUserCart(user.sub);
      const existingItem = this.findMatchingItem(
        cart.items,
        dto.item.productId,
        dto.item.variantId,
      );

      await this.prisma.$transaction(async (tx) => {
        if (existingItem) {
          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: { increment: dto.item.quantity } },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: dto.item.productId,
              variantId: dto.item.variantId || null,
              quantity: dto.item.quantity,
              priceAtAddition,
            },
          });
        }

        await this.updateCartSummary(cart.id, tx);
      });

      if (user.customerId) {
        this.retentionService
          .trackActivity(
            user.customerId,
            CustomerActivityType.PRODUCT_ADD_TO_CART,
            {
              productId: dto.item.productId,
              variantId: dto.item.variantId || undefined,
              quantity: dto.item.quantity,
            },
          )
          .catch(() => {});
      }

      return this.findOne(user, cart.id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add item to cart');
    }
  }

  /**
   * Bulk add multiple items to cart.
   */
  async bulkCreateAndAdd(
    user: JwtUser,
    dto: BulkAddCartDto,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      await Promise.all(
        dto.items.map((item) =>
          this.checkStock(item.productId, item.quantity, item.variantId),
        ),
      );

      const prices = await Promise.all(
        dto.items.map((item) =>
          this.fetchItemPrice(item.productId, item.variantId),
        ),
      );

      const cart = await this.getOrCreateUserCart(user.sub);

      await this.prisma.$transaction(async (tx) => {
        for (let i = 0; i < dto.items.length; i++) {
          const item = dto.items[i];
          const existingItem = this.findMatchingItem(
            cart.items,
            item.productId,
            item.variantId,
          );

          if (existingItem) {
            await tx.cartItem.update({
              where: { id: existingItem.id },
              data: { quantity: { increment: item.quantity } },
            });
          } else {
            await tx.cartItem.create({
              data: {
                cartId: cart.id,
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                priceAtAddition: prices[i],
              },
            });
          }
        }

        await this.updateCartSummary(cart.id, tx);
      });

      if (user.customerId) {
        for (const item of dto.items) {
          this.retentionService
            .trackActivity(
              user.customerId,
              CustomerActivityType.PRODUCT_ADD_TO_CART,
              {
                productId: item.productId,
                variantId: item.variantId || undefined,
                quantity: item.quantity,
              },
            )
            .catch(() => {});
        }
      }

      return this.findOne(user, cart.id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to bulk add items to cart',
      );
    }
  }

  /**
   * Merge guest cart into authenticated user's cart on login.
   */
  async mergeGuestCartOnLogin(
    user: JwtUser,
    sessionId: string,
  ): Promise<{ mergedCartIds: string[]; skippedItems: any[] }> {
    try {
      const guestCarts = await this.prisma.cart.findMany({
        where: {
          sessionId,
          source: CartSource.GUEST,
          status: CartStatus.ACTIVE,
        },
        include: { items: true },
      });

      if (!guestCarts || guestCarts.length === 0) {
        return { mergedCartIds: [], skippedItems: [] };
      }

      const mergedCartIds: string[] = [];
      const skippedItems: any[] = [];

      const userCart = await this.getOrCreateUserCart(user.sub);

      for (const guestCart of guestCarts) {
        try {
          for (const guestItem of guestCart.items) {
            try {
              const existingItem = this.findMatchingItem(
                userCart.items,
                guestItem.productId,
                guestItem.variantId,
              );

              if (existingItem) {
                await this.prisma.cartItem.update({
                  where: { id: existingItem.id },
                  data: {
                    quantity: existingItem.quantity + guestItem.quantity,
                  },
                });
              } else {
                await this.prisma.cartItem.create({
                  data: {
                    cartId: userCart.id,
                    productId: guestItem.productId,
                    variantId: guestItem.variantId,
                    quantity: guestItem.quantity,
                    priceAtAddition: guestItem.priceAtAddition,
                  },
                });
              }
            } catch (itemError) {
              skippedItems.push({
                cartId: guestCart.id,
                productId: guestItem.productId,
                error:
                  itemError instanceof Error
                    ? itemError.message
                    : 'Failed to merge item',
              });
            }
          }

          await this.prisma.cart.update({
            where: { id: guestCart.id },
            data: {
              userId: user.sub,
              isMerged: true,
              mergedAt: new Date(),
              status: CartStatus.INACTIVE,
            },
          });

          mergedCartIds.push(guestCart.id);
        } catch (cartError) {
          skippedItems.push({
            cartId: guestCart.id,
            error:
              cartError instanceof Error
                ? cartError.message
                : 'Failed to merge cart',
          });
        }
      }

      await this.updateCartSummary(userCart.id);

      return { mergedCartIds, skippedItems };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to merge guest cart ${error instanceof Error ? error.message : ''}`,
      );
    }
  }

  /**
   * Get all carts for authenticated user.
   */
  async findAll(user: JwtUser): Promise<(Cart & { items: CartItem[] })[]> {
    try {
      return await this.prisma.cart.findMany({
        where: { userId: user.sub, status: CartStatus.ACTIVE },
        include: { items: true },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to fetch carts ${error instanceof Error ? error.message : ''}`,
      );
    }
  }

  /**
   * Get specific cart by ID for authenticated user.
   */
  async findOne(
    user: JwtUser,
    cartId: string,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        include: { items: true },
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cart.userId !== user.sub) {
        throw new NotFoundException('Cart not found');
      }

      return cart;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch cart');
    }
  }

  /**
   * Update cart item quantity.
   */
  async updateItem(
    user: JwtUser,
    cartId: string,
    dto: UpdateCartItemDto,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      const cart = await this.findOne(user, cartId);

      const item = cart.items.find((i) => i.id === dto.itemId);
      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      if (dto.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than 0');
      }

      await this.prisma.cartItem.update({
        where: { id: dto.itemId },
        data: { quantity: dto.quantity },
      });

      await this.updateCartSummary(cartId);

      return this.prisma.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
        include: { items: true },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update cart item');
    }
  }

  /**
   * Remove single item from cart.
   */
  async deleteOneByOne(
    user: JwtUser,
    cartId: string,
    dto: RemoveCartItemDto,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      const cart = await this.findOne(user, cartId);

      const item = cart.items.find((i) => i.id === dto.itemId);
      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      await this.prisma.cartItem.delete({ where: { id: dto.itemId } });
      await this.updateCartSummary(cartId);

      return this.prisma.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
        include: { items: true },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to remove cart item');
    }
  }

  /**
   * Delete entire cart.
   */
  async deleteComplete(
    user: JwtUser,
    cartId: string,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      await this.findOne(user, cartId);

      await this.prisma.cartItem.deleteMany({ where: { cartId } });

      const deletedCart = await this.prisma.cart.delete({
        where: { id: cartId },
      });

      return { ...deletedCart, items: [] } as Cart & { items: CartItem[] };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete cart');
    }
  }

  // ============================================================
  // GUEST / SESSION-BASED ENDPOINTS (No Authentication)
  // ============================================================

  /**
   * Create or add item to guest cart (session-based, no authentication).
   */
  async createAndAddGuest(
    sessionId: string,
    dto: CreateAndAddCartDto,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      if (!sessionId) {
        throw new BadRequestException('Session ID is required');
      }

      await this.checkStock(
        dto.item.productId,
        dto.item.quantity,
        dto.item.variantId,
      );

      const priceAtAddition = await this.fetchItemPrice(
        dto.item.productId,
        dto.item.variantId,
      );

      const cart = await this.getOrCreateGuestCart(sessionId);

      const existingItem = this.findMatchingItem(
        cart.items,
        dto.item.productId,
        dto.item.variantId,
      );

      if (existingItem) {
        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + dto.item.quantity,
            updatedAt: new Date(),
          },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: dto.item.productId,
            variantId: dto.item.variantId || null,
            quantity: dto.item.quantity,
            priceAtAddition,
          },
        });
      }

      const updatedCart = await this.prisma.cart.update({
        where: { id: cart.id },
        data: { updatedAt: new Date() },
        include: { items: true },
      });

      await this.updateCartSummary(updatedCart.id);

      return updatedCart;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to add item to guest cart',
      );
    }
  }

  /**
   * Bulk add items to guest cart (session-based).
   */
  async bulkAddGuest(
    sessionId: string,
    dto: BulkAddCartDto,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      if (!sessionId) {
        throw new BadRequestException('Session ID is required');
      }

      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('No items provided');
      }

      await Promise.all(
        dto.items.map((item) =>
          this.checkStock(item.productId, item.quantity, item.variantId),
        ),
      );

      const prices = await Promise.all(
        dto.items.map((item) =>
          this.fetchItemPrice(item.productId, item.variantId),
        ),
      );

      const cart = await this.getOrCreateGuestCart(sessionId);

      await this.prisma.$transaction(async (tx) => {
        for (let i = 0; i < dto.items.length; i++) {
          const item = dto.items[i];
          const existingItem = this.findMatchingItem(
            cart.items,
            item.productId,
            item.variantId,
          );

          if (existingItem) {
            await tx.cartItem.update({
              where: { id: existingItem.id },
              data: {
                quantity: existingItem.quantity + item.quantity,
                updatedAt: new Date(),
              },
            });
          } else {
            await tx.cartItem.create({
              data: {
                cartId: cart.id,
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                priceAtAddition: prices[i],
              },
            });
          }
        }

        await this.updateCartSummary(cart.id, tx);
      });

      const result = await this.prisma.cart.findUnique({
        where: { id: cart.id },
        include: { items: true },
      });

      if (!result) {
        throw new NotFoundException('Guest cart not found after bulk add');
      }

      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to bulk add items to guest cart',
      );
    }
  }

  /**
   * Get all active guest carts for a session.
   */
  async findGuestCarts(
    sessionId: string,
  ): Promise<(Cart & { items: CartItem[] })[]> {
    try {
      return await this.prisma.cart.findMany({
        where: {
          sessionId,
          source: CartSource.GUEST,
          status: CartStatus.ACTIVE,
        },
        include: { items: true },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to fetch guest carts ${error instanceof Error ? error.message : ''}`,
      );
    }
  }

  /**
   * Get specific guest cart by ID.
   */
  async findOneGuest(
    sessionId: string,
    cartId: string,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        include: { items: true },
      });

      if (!cart) {
        throw new NotFoundException('Guest cart not found');
      }

      if (cart.sessionId !== sessionId) {
        throw new NotFoundException('Guest cart not found');
      }

      return cart;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch guest cart');
    }
  }

  /**
   * Update guest cart item quantity.
   */
  async updateItemGuest(
    sessionId: string,
    cartId: string,
    dto: UpdateCartItemDto,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      const cart = await this.findOneGuest(sessionId, cartId);

      const item = cart.items.find((i) => i.id === dto.itemId);
      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      if (dto.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than 0');
      }

      await this.prisma.cartItem.update({
        where: { id: dto.itemId },
        data: { quantity: dto.quantity },
      });

      await this.updateCartSummary(cartId);

      return this.prisma.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
        include: { items: true },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update guest cart item',
      );
    }
  }

  /**
   * Remove item from guest cart.
   */
  async deleteOneByOneGuest(
    sessionId: string,
    cartId: string,
    dto: RemoveCartItemDto,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      const cart = await this.findOneGuest(sessionId, cartId);

      const item = cart.items.find((i) => i.id === dto.itemId);
      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      await this.prisma.cartItem.delete({ where: { id: dto.itemId } });
      await this.updateCartSummary(cartId);

      return this.prisma.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
        include: { items: true },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to remove guest cart item',
      );
    }
  }

  /**
   * Delete entire guest cart.
   */
  async deleteCompleteGuest(
    sessionId: string,
    cartId: string,
  ): Promise<Cart & { items: CartItem[] }> {
    try {
      await this.findOneGuest(sessionId, cartId);

      await this.prisma.cartItem.deleteMany({ where: { cartId } });

      const deletedCart = await this.prisma.cart.delete({
        where: { id: cartId },
      });

      return { ...deletedCart, items: [] } as Cart & { items: CartItem[] };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete guest cart');
    }
  }
}
