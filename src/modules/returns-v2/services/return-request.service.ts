import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import {
  CreatePosReturnDto,
  CreateOnlineReturnDto,
  CreateStockReturnDto,
} from '../dto/create-return.dto';
import { UpdateRefundPreferenceDto } from '../dto/update-refund-preference.dto';
import {
  ListReturnsQueryDto,
  WithoutReturnPaginationDto,
} from '../dto/list-returns-query.dto';
import {
  ListInventoryQueryDto,
  InventoryType,
} from '../dto/list-inventory-query.dto';
import { JwtUser } from '../../../auth/types/jwt-user.type';
import {
  ReturnSourceType,
  ReturnStatus,
  Role,
  ReturnCondition,
  OrderChannel,
  ReturnType,
  ReturnInventoryKind,
  ReturnConflictInventoryStatus,
  ReturnMediaType,
  ReturnMovementType,
  DefectiveSource,
  InspectionResult,
  RefundReceivingSource,
  PaymentModeEnum,
  OnlinePaymentStatus,
  Prisma,
} from '@prisma/client';
import { UploadsService } from 'src/uploads/uploads.service';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { NotificationType } from 'src/notification/enums/notification-type.enum';
import { ReturnReasonEnum } from '../enums/return-reason.enum';

@Injectable()
export class ReturnRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uploadService: UploadsService,
    private readonly roleBasedNotificationService: RoleBasedNotificationService,
  ) {}

  /**
   * Reusable utility to compute dynamic metrics for an order item.
   */
  async getOrderItemMetrics(
    orderId: string,
    productId: string,
    variantId: string | null,
  ) {
    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        orderId,
        productId,
        variantId: variantId ?? null,
      },
    });

    if (!orderItem) {
      return {
        orderedQty: 0,
        returnedQty: 0,
        refundedQty: 0,
        exchangeQty: 0,
        availableReturnQty: 0,
      };
    }

    // Fetch all V2 return request items for this order item
    const returnItems = await this.prisma.returnItem.findMany({
      where: {
        returnRequest: {
          orderId,
          status: { not: ReturnStatus.REJECTED },
        },
        productId,
        variantId: variantId ?? null,
      },
      include: {
        returnRequest: true,
      },
    });

    let returnedQty = 0;
    let refundedQty = 0;
    let exchangeQty = 0;

    for (const rItem of returnItems) {
      const qty = rItem.approvedQty ?? rItem.receivedQty ?? rItem.requestedQty;
      const status = rItem.returnRequest.status;
      const rType = rItem.returnRequest.returnType;

      if (
        status !== ReturnStatus.REQUESTED &&
        status !== ReturnStatus.REJECTED
      ) {
        returnedQty += qty;
        if (
          rType === ReturnType.REFUND &&
          (status === ReturnStatus.REFUND_PROCESSED ||
            status === ReturnStatus.CLOSED)
        ) {
          refundedQty += qty;
        } else if (
          (rType === ReturnType.EXCHANGE ||
            rType === ReturnType.SAME_PRODUCT_EXCHANGE) &&
          (status === ReturnStatus.EXCHANGE_ORDER_CREATED ||
            status === ReturnStatus.EXCHANGE_ORDER_DELIVERED ||
            status === ReturnStatus.CLOSED)
        ) {
          exchangeQty += qty;
        }
      }
    }

    const availableReturnQty = Math.max(orderItem.quantity - returnedQty, 0);

    return {
      orderedQty: orderItem.quantity,
      returnedQty,
      refundedQty,
      exchangeQty,
      availableReturnQty,
    };
  }

  /**
   * Reusable utility for calculating the available return quantity of an order item.
   */
  async calculateAvailableReturnQty(orderItemId: string): Promise<number> {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Order item with ID ${orderItemId} not found.`,
      );
    }

    const metrics = await this.getOrderItemMetrics(
      orderItem.orderId,
      orderItem.productId,
      orderItem.variantId,
    );

    return metrics.availableReturnQty;
  }

  /**
   * Computes available return quantity specifically for validation during request creation.
   * Includes pending REQUESTED returns to prevent over-requesting before approvals.
   */
  private async calculateAvailableReturnQtyForCreationTx(
    tx: any,
    orderItemId: string,
  ): Promise<number> {
    const orderItem = await tx.orderItem.findUnique({
      where: { id: orderItemId },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Order item with ID ${orderItemId} not found.`,
      );
    }

    const returnItems = await tx.returnItem.findMany({
      where: {
        returnRequest: {
          orderId: orderItem.orderId,
          status: { not: ReturnStatus.REJECTED },
        },
        productId: orderItem.productId,
        variantId: orderItem.variantId ?? null,
      },
    });

    const totalReservedOrApproved = returnItems.reduce(
      (sum: number, item: any) =>
        sum + (item.approvedQty ?? item.receivedQty ?? item.requestedQty),
      0,
    );

    return Math.max(orderItem.quantity - totalReservedOrApproved, 0);
  }

  /**
   * Creates a customer POS/offline return request (EXCHANGE only).
   */
  async createPosReturn(
    dto: CreatePosReturnDto,
    user: JwtUser,
    ip?: string | null,
  ) {
    if (!dto.orderNumber) {
      throw new BadRequestException(
        'orderNumber is required for POS return requests.',
      );
    }
    if (
      dto.returnType === ReturnType.SAME_PRODUCT_EXCHANGE &&
      (!dto.exchangeItems || dto.exchangeItems.length === 0)
    ) {
      dto.exchangeItems = dto.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.requestedQty,
      }));
    }

    if (!dto.exchangeItems || dto.exchangeItems.length === 0) {
      throw new BadRequestException(
        'exchangeItems are required for POS exchange requests.',
      );
    }

    // Find franchise ID from the original order
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: dto.orderNumber },
    });
    if (!order) {
      throw new NotFoundException(
        `Order with number ${dto.orderNumber} not found.`,
      );
    }

    const franchiseId = order.franchiseId;
    if (!franchiseId) {
      throw new BadRequestException('Order does not have a franchise linked.');
    }

    // Validate replacement items: variants check and franchise stock availability
    for (const exItem of dto.exchangeItems) {
      const dbProduct = await this.prisma.product.findUnique({
        where: { id: exItem.productId },
        include: { variants: true },
      });
      if (!dbProduct) {
        throw new NotFoundException(
          `Exchange product with ID ${exItem.productId} not found.`,
        );
      }

      if (dbProduct.variants.length > 0 && !exItem.variantId) {
        throw new BadRequestException(
          `variantId is required for product "${dbProduct.name}" because it has variants.`,
        );
      }

      // Check store's FranchiseStock (which supports variantId)
      const vId = exItem.variantId || '';
      const fsStock = await this.prisma.franchiseStock.findUnique({
        where: {
          franchiseId_productId_variantId: {
            franchiseId,
            productId: exItem.productId,
            variantId: vId,
          },
        },
      });

      const availableStock =
        (fsStock?.quantity ?? 0) - (fsStock?.reserved ?? 0);
      if (availableStock < exItem.quantity) {
        throw new BadRequestException(
          `Insufficient stock for replacement product "${dbProduct.name}" at this franchise. Available: ${availableStock}, Required: ${exItem.quantity}`,
        );
      }
    }

    // Perform immediate FranchiseStock deduction and request creation inside a transaction
    return this.prisma.$transaction(async (tx) => {
      const returnRequest = await this.createCustomerReturnTx(
        tx,
        dto,
        user,
        OrderChannel.POS,
        ip,
      );

      for (const exItem of dto.exchangeItems) {
        // Decrement stock
        const vId = exItem.variantId || '';
        await tx.franchiseStock.update({
          where: {
            franchiseId_productId_variantId: {
              franchiseId,
              productId: exItem.productId,
              variantId: vId,
            },
          },
          data: {
            quantity: { decrement: exItem.quantity },
          },
        });

        // Log movement FRANCHISE_TO_CUSTOMER
        await tx.inventoryMovement.create({
          data: {
            returnRequestId: returnRequest.id,
            productId: exItem.productId,
            variantId: exItem.variantId ?? null,
            quantity: exItem.quantity,
            type: 'FRANCHISE_TO_CUSTOMER',
          },
        });

        await tx.returnInventoryMovement.create({
          data: {
            returnRequestId: returnRequest.id,
            productId: exItem.productId,
            variantId: exItem.variantId ?? null,
            quantity: exItem.quantity,
            movementType: ReturnMovementType.FRANCHISE_TO_CUSTOMER,
          },
        });
      }

      return returnRequest;
    });
  }

  /**
   * Creates a customer Online return request.
   */
  async createOnlineReturn(
    dto: CreateOnlineReturnDto,
    user: JwtUser,
    ip?: string | null,
  ) {
    if (!dto.orderNumber) {
      throw new BadRequestException(
        'orderNumber is required for Online return requests.',
      );
    }
    return this.createCustomerReturnTx(
      this.prisma,
      dto,
      user,
      OrderChannel.ONLINE,
      ip,
    );
  }

  /**
   * Helper function to compute dynamic metrics during findOne response mapping.
   */
  async calculateItemReturnMetrics(
    orderId: string | null,
    productId: string,
    variantId: string | null,
  ) {
    if (!orderId) {
      return {
        orderedQty: 0,
        returnedQty: 0,
        refundedQty: 0,
        exchangeQty: 0,
        availableReturnQty: 0,
      };
    }
    return this.getOrderItemMetrics(orderId, productId, variantId);
  }

  /**
   * Creates a customer order return request in transactional context.
   */
  private async createCustomerReturnTx(
    tx: any,
    dto: CreatePosReturnDto | CreateOnlineReturnDto,
    user: JwtUser,
    expectedChannel: OrderChannel,
    ip?: string | null,
  ) {
    if (dto.images) {
      dto.images = dto.images.filter(
        (img) => !img.toLowerCase().includes('proof_image_placeholder.png'),
      );
    }
    // 1. Fetch original order
    const order = await tx.order.findUnique({
      where: { orderNumber: dto.orderNumber },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with number ${dto.orderNumber} not found.`,
      );
    }

    // Validate channel match
    if (order.channel !== expectedChannel) {
      throw new BadRequestException(
        `Order channel must be ${expectedChannel} for this endpoint.`,
      );
    }

    // Validate refund preference if returnType is REFUND
    const isRefund = dto.returnType === ReturnType.REFUND;
    const onlineDto = dto as CreateOnlineReturnDto;
    let refundReceivingSource = null;
    let refundPreference: any = null;

    if (isRefund) {
      if (!onlineDto.refundReceivingSource) {
        throw new BadRequestException(
          'refundReceivingSource is required when returnType is REFUND.',
        );
      }
      refundReceivingSource = onlineDto.refundReceivingSource;

      if (refundReceivingSource === RefundReceivingSource.UPI) {
        refundPreference = { upiId: onlineDto.upiId };
      } else if (
        refundReceivingSource === RefundReceivingSource.BANK_TRANSFER
      ) {
        refundPreference = {
          accountHolderName: onlineDto.accountHolderName,
          bankName: onlineDto.bankName,
          accountNumber: onlineDto.accountNumber,
          ifscCode: onlineDto.ifscCode,
        };
      }

      this.validateRefundPreference(
        refundReceivingSource,
        refundPreference,
        order.paymentMode,
        order.onlinePaymentStatus,
      );
    }

    // 2. Enforce POS channel exchange-only rule
    if (
      order.channel === OrderChannel.POS &&
      dto.returnType !== ReturnType.EXCHANGE &&
      dto.returnType !== ReturnType.SAME_PRODUCT_EXCHANGE
    ) {
      throw new BadRequestException('POS orders only allow exchanges.');
    }

    // 3. Validate requested items against original order items and quantities
    for (const itemDto of dto.items) {
      const originalItem = order.items.find(
        (oItem: any) =>
          oItem.productId === itemDto.productId &&
          oItem.variantId === (itemDto.variantId || null),
      );

      if (!originalItem) {
        throw new BadRequestException(
          `Product ID ${itemDto.productId} (Variant ${itemDto.variantId}) is not part of original order ${dto.orderNumber}.`,
        );
      }

      // Check cumulative returns against ordered quantity
      const availableQty = await this.calculateAvailableReturnQtyForCreationTx(
        tx,
        originalItem.id,
      );
      if (itemDto.requestedQty > availableQty) {
        throw new BadRequestException(
          `Requested return quantity (${itemDto.requestedQty}) exceeds the available return quantity (${availableQty}) for product ${itemDto.productId}.`,
        );
      }
    }

    let exchangeItemsData =
      'exchangeItems' in dto ? (dto as CreatePosReturnDto).exchangeItems : [];

    if (dto.returnType === ReturnType.SAME_PRODUCT_EXCHANGE) {
      if (!exchangeItemsData || exchangeItemsData.length === 0) {
        exchangeItemsData = dto.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.requestedQty,
        }));
      } else {
        if (exchangeItemsData.length !== dto.items.length) {
          throw new BadRequestException(
            'For SAME_PRODUCT_EXCHANGE, replacement items must match returned items.',
          );
        }
        for (const exItem of exchangeItemsData) {
          const matchingItem = dto.items.find(
            (i) =>
              i.productId === exItem.productId &&
              (i.variantId || null) === (exItem.variantId || null),
          );
          if (!matchingItem || matchingItem.requestedQty !== exItem.quantity) {
            throw new BadRequestException(
              `Replacement item for product ${exItem.productId} does not match returned item quantity or variant.`,
            );
          }
        }
      }
    }

    // Exchange Pricing and Variant validation
    if (
      dto.returnType === ReturnType.EXCHANGE ||
      dto.returnType === ReturnType.SAME_PRODUCT_EXCHANGE
    ) {
      let returnedTotal = 0;
      for (const itemDto of dto.items) {
        const originalItem = order.items.find(
          (oItem: any) =>
            oItem.productId === itemDto.productId &&
            oItem.variantId === (itemDto.variantId || null),
        );
        if (originalItem) {
          const unitPrice = Number(originalItem.unitPrice);
          returnedTotal += unitPrice * itemDto.requestedQty;
        }
      }

      if (exchangeItemsData && exchangeItemsData.length > 0) {
        let replacementTotal = 0;
        for (const exItem of exchangeItemsData) {
          const dbProduct = await tx.product.findUnique({
            where: { id: exItem.productId },
            include: { variants: true },
          });
          if (!dbProduct) {
            throw new NotFoundException(
              `Exchange product with ID ${exItem.productId} not found.`,
            );
          }

          if (dbProduct.variants.length > 0 && !exItem.variantId) {
            throw new BadRequestException(
              `variantId is required for product "${dbProduct.name}" because it has variants.`,
            );
          }

          let price = Number(dbProduct.price);
          if (exItem.variantId) {
            const variant = dbProduct.variants.find(
              (v: any) => v.id === exItem.variantId,
            );
            if (!variant) {
              throw new NotFoundException(
                `Variant ${exItem.variantId} not found for product ${exItem.productId}`,
              );
            }
            price = Number(variant.price);
          }

          replacementTotal += price * exItem.quantity;
        }

        if (replacementTotal < returnedTotal) {
          throw new BadRequestException(
            `Replacement order value (${replacementTotal}) must be greater than or equal to the returned items value (${returnedTotal}).`,
          );
        }
      }
    }

    // 4. Create the return request record
    const returnNumber = `RET-CS-${Date.now().toString(36).toUpperCase()}`;

    const returnRequest = await tx.returnRequest.create({
      data: {
        returnNumber,
        sourceType: ReturnSourceType.CUSTOMER_ORDER,
        orderId: order.id,
        returnType: dto.returnType as ReturnType,
        status: ReturnStatus.REQUESTED,
        requestedById: user.sub,
        requestedByUserId: user.sub,
        franchiseId: order.franchiseId,
        reason: dto.reason ?? null,
        remarks: dto.remarks ?? null,
        images: dto.images ?? [],
        refundReceivingSource,
        refundPreference,
        items: {
          create: dto.items.map((itemDto) => ({
            productId: itemDto.productId,
            variantId: itemDto.variantId ?? null,
            requestedQty: itemDto.requestedQty,
            remarks: itemDto.remarks ?? null,
          })),
        },
        exchangeItems: {
          create: exchangeItemsData.map((exItem) => ({
            productId: exItem.productId,
            variantId: exItem.variantId ?? null,
            quantity: exItem.quantity,
          })),
        },
        media:
          dto.images && dto.images.length > 0
            ? {
                create: [
                  {
                    uploadedById: user.sub,
                    type: ReturnMediaType.CUSTOMER_PROOF,
                    files: dto.images,
                  },
                ],
              }
            : undefined,
      },
      include: {
        items: true,
        exchangeItems: true,
      },
    });

    // 5. Log audit trail
    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'return.created',
        resource: 'ReturnRequest',
        resourceId: returnRequest.id,
        metadata: {
          returnNumber: returnRequest.returnNumber,
          orderNumber: dto.orderNumber,
        },
        ip: ip ?? null,
      }),
      'return.created',
    );

    if (expectedChannel === OrderChannel.ONLINE) {
      const isDamage = dto.reason === ReturnReasonEnum.DAMAGE;
      if (isDamage) {
        void this.roleBasedNotificationService.notifySuperAdmins(
          'New Damage Return Request',
          `A new damage return request #${returnRequest.returnNumber} has been created for order #${order.orderNumber}.`,
          {
            returnRequestId: returnRequest.id,
            returnNumber: returnRequest.returnNumber,
            orderNumber: order.orderNumber,
          },
        );
      } else {
        if (order.franchiseId) {
          void this.roleBasedNotificationService.notifyFranchiseAll(
            order.franchiseId,
            'New Return Request',
            `A new return request #${returnRequest.returnNumber} has been created for order #${order.orderNumber}.`,
            NotificationType.ORDER,
            {
              returnRequestId: returnRequest.id,
              returnNumber: returnRequest.returnNumber,
              orderNumber: order.orderNumber,
              franchiseId: order.franchiseId,
            },
          );
        } else {
          void this.roleBasedNotificationService.notifySuperAdmins(
            'New Return Request',
            `A new return request #${returnRequest.returnNumber} has been created for order #${order.orderNumber}.`,
            {
              returnRequestId: returnRequest.id,
              returnNumber: returnRequest.returnNumber,
              orderNumber: order.orderNumber,
            },
          );
        }
      }
    }

    return returnRequest;
  }

  /**
   * Creates a franchise stock return request.
   */
  async createStockReturn(
    dto: CreateStockReturnDto,
    user: JwtUser,
    ip?: string | null,
  ) {
    if (dto.images) {
      dto.images = dto.images.filter(
        (img) => !img.toLowerCase().includes('proof_image_placeholder.png'),
      );
    }
    // 1. Fetch stock request
    const stockRequest = await this.prisma.stockRequest.findUnique({
      where: { id: dto.stockRequestId },
    });

    if (!stockRequest) {
      throw new NotFoundException(
        `StockRequest with ID ${dto.stockRequestId} not found.`,
      );
    }

    // 2. Franchise stock returns only allow RETURN returnType
    if (dto.returnType !== ReturnType.RETURN) {
      throw new BadRequestException('Stock request returns only allow RETURN.');
    }

    // 3. Validate items match the stock request's product/variant and quantities
    for (const itemDto of dto.items) {
      const matchesProduct = stockRequest.productId === itemDto.productId;
      const matchesVariant =
        stockRequest.variantId === (itemDto.variantId || null);

      if (!matchesProduct || !matchesVariant) {
        throw new BadRequestException(
          `Requested return item does not match the items in stock request ${dto.stockRequestId}.`,
        );
      }

      if (itemDto.requestedQty > stockRequest.quantity) {
        throw new BadRequestException(
          `Requested return quantity (${itemDto.requestedQty}) exceeds the stock request quantity (${stockRequest.quantity}).`,
        );
      }

      // Check franchise stock availability
      const vId = itemDto.variantId || '';
      const fsStock = await this.prisma.franchiseStock.findUnique({
        where: {
          franchiseId_productId_variantId: {
            franchiseId: stockRequest.franchiseId,
            productId: itemDto.productId,
            variantId: vId,
          },
        },
      });

      if (!fsStock || fsStock.quantity < itemDto.requestedQty) {
        throw new BadRequestException(
          `Insufficient franchise stock to return. Available: ${fsStock?.quantity ?? 0}, Required: ${itemDto.requestedQty}`,
        );
      }
    }

    // 4. Create return request inside a transaction, decrement FranchiseStock and increment ReturnInventory
    return this.prisma.$transaction(async (tx) => {
      const returnNumber = `RET-FR-${Date.now().toString(36).toUpperCase()}`;

      const returnRequest = await tx.returnRequest.create({
        data: {
          returnNumber,
          sourceType: ReturnSourceType.STOCK_REQUEST,
          stockRequestId: stockRequest.id,
          returnType: ReturnType.RETURN,
          status: ReturnStatus.REQUESTED,
          requestedById: user.sub,
          requestedByUserId: user.sub,
          franchiseId: stockRequest.franchiseId,
          reason: dto.reason ?? null,
          remarks: dto.remarks ?? null,
          images: dto.images ?? [],
          items: {
            create: dto.items.map((itemDto) => ({
              productId: itemDto.productId,
              variantId: itemDto.variantId ?? null,
              requestedQty: itemDto.requestedQty,
              remarks: itemDto.remarks ?? null,
            })),
          },
          media:
            dto.images && dto.images.length > 0
              ? {
                  create: [
                    {
                      uploadedById: user.sub,
                      type: ReturnMediaType.CUSTOMER_PROOF,
                      files: dto.images,
                    },
                  ],
                }
              : undefined,
        },
        include: {
          items: true,
        },
      });

      // Update stocks and log movement type FRANCHISE_TO_RETURN
      for (const itemDto of dto.items) {
        const vId = itemDto.variantId || '';
        await tx.franchiseStock.update({
          where: {
            franchiseId_productId_variantId: {
              franchiseId: stockRequest.franchiseId,
              productId: itemDto.productId,
              variantId: vId,
            },
          },
          data: {
            quantity: { decrement: itemDto.requestedQty },
          },
        });

        await tx.returnInventory.create({
          data: {
            productId: itemDto.productId,
            variantId: itemDto.variantId ?? null,
            franchiseId: stockRequest.franchiseId,
            quantity: itemDto.requestedQty,
            sourceType: ReturnSourceType.STOCK_REQUEST,
            sourceId: returnRequest.id,
            kind: ReturnInventoryKind.RETURN,
            status: ReturnConflictInventoryStatus.OPEN,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            returnRequestId: returnRequest.id,
            productId: itemDto.productId,
            variantId: itemDto.variantId ?? null,
            quantity: itemDto.requestedQty,
            type: 'FRANCHISE_TO_RETURN',
          },
        });
      }

      // 5. Log audit trail
      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'return.created',
          resource: 'ReturnRequest',
          resourceId: returnRequest.id,
          metadata: {
            returnNumber: returnRequest.returnNumber,
            stockRequestId: dto.stockRequestId,
          },
          ip: ip ?? null,
        }),
        'return.created',
      );

      return returnRequest;
    });
  }

  async updateRefundPreference(
    id: string,
    dto: UpdateRefundPreferenceDto,
    user: JwtUser,
  ) {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!returnRequest) {
      throw new NotFoundException(`Return request with ID ${id} not found.`);
    }

    if (returnRequest.returnType !== ReturnType.REFUND) {
      throw new BadRequestException(
        'Refund preferences can only be updated for REFUND requests.',
      );
    }

    const order = returnRequest.order;
    if (!order) {
      throw new BadRequestException(
        'No order associated with this return request.',
      );
    }

    let refundPreference: any = null;
    if (dto.refundReceivingSource === RefundReceivingSource.UPI) {
      refundPreference = { upiId: dto.upiId };
    } else if (
      dto.refundReceivingSource === RefundReceivingSource.BANK_TRANSFER
    ) {
      refundPreference = {
        accountHolderName: dto.accountHolderName,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        ifscCode: dto.ifscCode,
      };
    }

    this.validateRefundPreference(
      dto.refundReceivingSource,
      refundPreference,
      order.paymentMode,
      order.onlinePaymentStatus,
    );

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        refundReceivingSource: dto.refundReceivingSource,
        refundPreference: refundPreference ?? Prisma.JsonNull,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'return.refund_preference_updated',
        resource: 'ReturnRequest',
        resourceId: returnRequest.id,
        metadata: {
          returnNumber: returnRequest.returnNumber,
          refundReceivingSource: dto.refundReceivingSource,
        },
      }),
      'return.refund_preference_updated',
    );

    return updated;
  }

  validateRefundPreference(
    source: RefundReceivingSource,
    preference: any,
    paymentMode: PaymentModeEnum,
    onlinePaymentStatus: OnlinePaymentStatus | null,
  ) {
    if (paymentMode === PaymentModeEnum.COD) {
      if (source === RefundReceivingSource.ORIGINAL_SOURCE) {
        throw new BadRequestException(
          'ORIGINAL_SOURCE is not selectable for COD orders.',
        );
      }
    }

    if (
      paymentMode === PaymentModeEnum.ONLINE &&
      onlinePaymentStatus === OnlinePaymentStatus.PAID
    ) {
      if (
        source === RefundReceivingSource.UPI ||
        source === RefundReceivingSource.BANK_TRANSFER
      ) {
        throw new BadRequestException(
          'Direct UPI or bank-transfer refunds for prepaid orders are not currently supported. Please select ORIGINAL_SOURCE or REWARDS.',
        );
      }
    }

    if (source === RefundReceivingSource.UPI) {
      if (
        !preference ||
        !preference.upiId ||
        typeof preference.upiId !== 'string' ||
        !preference.upiId.trim()
      ) {
        throw new BadRequestException('UPI refunds require a valid upiId.');
      }
    }

    if (source === RefundReceivingSource.BANK_TRANSFER) {
      if (!preference) {
        throw new BadRequestException(
          'Bank transfer refunds require bank account details.',
        );
      }
      const { accountHolderName, bankName, accountNumber, ifscCode } =
        preference;
      if (
        !accountHolderName ||
        typeof accountHolderName !== 'string' ||
        !accountHolderName.trim()
      ) {
        throw new BadRequestException(
          'Bank transfer refunds require accountHolderName.',
        );
      }
      if (!bankName || typeof bankName !== 'string' || !bankName.trim()) {
        throw new BadRequestException(
          'Bank transfer refunds require bankName.',
        );
      }
      if (
        !accountNumber ||
        typeof accountNumber !== 'string' ||
        !accountNumber.trim()
      ) {
        throw new BadRequestException(
          'Bank transfer refunds require accountNumber.',
        );
      }
      if (!ifscCode || typeof ifscCode !== 'string' || !ifscCode.trim()) {
        throw new BadRequestException(
          'Bank transfer refunds require ifscCode.',
        );
      }
    }

    if (source === RefundReceivingSource.ORIGINAL_SOURCE) {
      if (paymentMode !== PaymentModeEnum.ONLINE) {
        throw new BadRequestException(
          'Original source refund is only allowed for ONLINE orders.',
        );
      }
      if (onlinePaymentStatus !== OnlinePaymentStatus.PAID) {
        throw new BadRequestException(
          'Original source refund requires the online payment status to be PAID.',
        );
      }
    }
  }

  private buildListWhere(query: ListReturnsQueryDto, user: JwtUser) {
    const clauses: any[] = [];

    if (query.search) {
      clauses.push({
        OR: [
          { returnNumber: { contains: query.search, mode: 'insensitive' } },
          { reason: { contains: query.search, mode: 'insensitive' } },
          {
            order: {
              orderNumber: { contains: query.search, mode: 'insensitive' },
            },
          },
          { stockRequestId: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.returnType) {
      clauses.push({ returnType: query.returnType });
    }

    if (query.sourceType) {
      clauses.push({ sourceType: query.sourceType });
    }

    if (query.orderNumber) {
      clauses.push({ order: { orderNumber: query.orderNumber } });
    }

    if (query.channel) {
      clauses.push({ order: { channel: query.channel } });
    }

    if (query.stockRequestId) {
      clauses.push({ stockRequestId: query.stockRequestId });
    }

    if (query.fromDate || query.lastDate) {
      const dateRange: any = {};
      if (query.fromDate) {
        dateRange.gte = new Date(query.fromDate);
      }
      if (query.lastDate) {
        dateRange.lte = new Date(query.lastDate);
      }
      clauses.push({ createdAt: dateRange });
    }

    const isAdmin =
      user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;
    const effectiveFranchiseId =
      user.franchiseId ?? user.franchiseOwnerId ?? null;

    if (query.franchiseId) {
      if (!isAdmin && query.franchiseId !== effectiveFranchiseId) {
        throw new ForbiddenException(
          'You are not allowed to view other franchise returns.',
        );
      }
      clauses.push({ franchiseId: query.franchiseId });
    } else if (user.role === Role.CUSTOMER) {
      if (!user.customerId) {
        throw new ForbiddenException(
          'No customer profile linked to this user account.',
        );
      }
      clauses.push({ order: { customerId: user.customerId } });
    } else if (!isAdmin) {
      if (!effectiveFranchiseId) {
        throw new ForbiddenException(
          'No franchise linked to this user account.',
        );
      }
      clauses.push({ franchiseId: effectiveFranchiseId });
    }

    return clauses.length > 0 ? { AND: clauses } : {};
  }

  /**
   * Fetches list of return requests with pagination, sorting, and user-scoping.
   */
  async list(query: ListReturnsQueryDto, user: JwtUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildListWhere(query, user);
    const sortBy = query.sortBy || 'createdAt';
    const orderBy = { [sortBy]: query.order || 'desc' };

    const [total, data] = await Promise.all([
      this.prisma.returnRequest.count({ where }),
      this.prisma.returnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, slug: true, price: true } },
              variant: {
                select: { id: true, sku: true, attributeSummary: true, price: true },
              },
            },
          },
          refunds: true,
          refundsV2: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              channel: true,
              total: true,
              billingSnapshot: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  altEmail: true,
                  user: {
                    select: {
                      id: true,
                      email: true,
                    },
                  },
                },
              },
              retailCustomer: {
                select: {
                  id: true,
                  name: true,
                  phoneNorm: true,
                  email: true,
                },
              },
            },
          },
          franchise: {
            select: { id: true, name: true, code: true, ownerEmail: true },
          },
          media: true,
        },
      }),
    ]);

    const formattedData = data.map((item) =>
      this.formatReturnRequestListItem(item, user),
    );

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Fetches list of return requests without pagination, including overall and franchise-wise metrics in meta.
   */
  async listAll(query: WithoutReturnPaginationDto, user: JwtUser) {
    const where = this.buildListWhere(query, user);
    const sortBy = query.sortBy || 'createdAt';
    const orderBy = { [sortBy]: query.order || 'desc' };

    const data = await this.prisma.returnRequest.findMany({
      where,
      orderBy,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, price: true } },
            variant: {
              select: { id: true, sku: true, attributeSummary: true, price: true },
            },
          },
        },
        refunds: true,
        refundsV2: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            channel: true,
            total: true,
            billingSnapshot: true,
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
                altEmail: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
            retailCustomer: {
              select: {
                id: true,
                name: true,
                phoneNorm: true,
                email: true,
              },
            },
          },
        },
        franchise: {
          select: { id: true, name: true, code: true, ownerEmail: true },
        },
        media: true,
      },
    });

    const count = data.length;
    let posCount = 0;
    let onlineCount = 0;

    const franchiseMap = new Map<
      string,
      {
        id: string;
        name: string;
        code: string;
        count: number;
        posCount: number;
        onlineCount: number;
      }
    >();

    for (const item of data) {
      const isPos = item.order?.channel === OrderChannel.POS;
      const isOnline = item.order?.channel === OrderChannel.ONLINE;

      if (isPos) posCount++;
      if (isOnline) onlineCount++;

      if (item.franchiseId) {
        const franchiseId = item.franchiseId;
        const franchiseName = item.franchise?.name || 'Unknown Franchise';
        const franchiseCode = item.franchise?.code || '';

        if (!franchiseMap.has(franchiseId)) {
          franchiseMap.set(franchiseId, {
            id: franchiseId,
            name: franchiseName,
            code: franchiseCode,
            count: 0,
            posCount: 0,
            onlineCount: 0,
          });
        }

        const fStats = franchiseMap.get(franchiseId)!;
        fStats.count++;
        if (isPos) fStats.posCount++;
        if (isOnline) fStats.onlineCount++;
      }
    }

    const franchiseStats = Array.from(franchiseMap.values());

    const formattedData = data.map((item) =>
      this.formatReturnRequestListItem(item, user),
    );

    return {
      data: formattedData,
      meta: {
        count,
        posCount,
        onlineCount,
        franchises: franchiseStats,
      },
    };
  }

  /**
   * List defective and blocked (conflict) inventory with filtering, searching, and pagination.
   */
  async listInventory(query: ListInventoryQueryDto, user: JwtUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const clauses: any[] = [];

    // Role verification and franchise isolation
    const isAdmin =
      user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;
    let franchiseIdToFilter: string | null = null;
    if (user.role === Role.FRANCHISE_OWNER) {
      franchiseIdToFilter = user.franchiseId ?? null;
    } else if (user.role === Role.FRANCHISE_STAFF) {
      franchiseIdToFilter = user.franchiseOwnerId ?? null;
    }

    if (!isAdmin) {
      if (!franchiseIdToFilter) {
        throw new ForbiddenException(
          'No franchise linked to this user account.',
        );
      }
      clauses.push({ franchiseId: franchiseIdToFilter });
    } else if (query.franchiseId) {
      clauses.push({ franchiseId: query.franchiseId });
    }

    const inventoryType = query.type ?? InventoryType.DEFECTIVE;

    // Search query
    if (query.search) {
      clauses.push({
        OR: [
          {
            product: { name: { contains: query.search, mode: 'insensitive' } },
          },
          {
            product: { slug: { contains: query.search, mode: 'insensitive' } },
          },
          { variant: { sku: { contains: query.search, mode: 'insensitive' } } },
          {
            variant: {
              attributeSummary: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            franchise: {
              name: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            franchise: {
              code: { contains: query.search, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    // Filters
    if (query.productId) {
      clauses.push({ productId: query.productId });
    }
    if (query.variantId) {
      clauses.push({ variantId: query.variantId });
    }
    if (inventoryType === InventoryType.DEFECTIVE && query.source) {
      clauses.push({ source: query.source });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};
    const sortBy = query.sortBy || 'createdAt';
    const orderBy = { [sortBy]: query.order || 'desc' };

    const include = {
      product: { select: { id: true, name: true, slug: true } },
      variant: { select: { id: true, sku: true, attributeSummary: true } },
      franchise: { select: { id: true, name: true, code: true } },
    };

    let total = 0;
    let data = [];

    if (inventoryType === InventoryType.DEFECTIVE) {
      const dbRecords = await this.prisma.defectiveInventory.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include,
      });
      total = await this.prisma.defectiveInventory.count({ where });
      data = dbRecords.map((item) => ({
        ...item,
        type: InventoryType.DEFECTIVE,
      }));
    } else {
      const dbRecords = await this.prisma.blockedInventory.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include,
      });
      total = await this.prisma.blockedInventory.count({ where });
      data = dbRecords.map((item) => ({
        ...item,
        type: InventoryType.BLOCKED,
      }));
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private formatActor(user: any) {
    if (!user) return null;
    let name = 'N/A';
    if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF) {
      name = user.adminProfile?.name || 'Admin User';
    } else if (user.role === Role.FRANCHISE_OWNER) {
      name =
        user.franchiseOwner?.ownerFullName ||
        user.franchise?.ownerFullName ||
        'Franchise Owner';
    } else if (user.role === Role.FRANCHISE_STAFF) {
      name = user.staffFranchise?.name || 'Franchise Staff';
    } else if (user.role === Role.CUSTOMER) {
      name = user.customer?.name || 'Customer';
    }

    let mappedRole = user.role;
    if (user.role === 'FRANCHISE_AUDITOR') {
      mappedRole = 'FRANCHISE_STAFF';
    }

    return {
      id: user.id,
      name,
      email: user.email,
      role: mappedRole,
    };
  }

  private getImageUrl(file: string): string {
    if (!file) return '';
    if (file.startsWith('http://') || file.startsWith('https://')) {
      return file;
    }
    const prefix = process.env.AWS_PREFIX_URL;
    if (prefix) {
      const cleanPrefix = prefix.replace(/\/+$/, '');
      const cleanFile = file.replace(/^\/+/, '');
      return `${cleanPrefix}/${cleanFile}`;
    }
    return this.uploadService.getObjectUrl(file);
  }

  private computeReturnAmount(returnRequest: any): number {
    if (!returnRequest) return 0;

    // 1. Check if a Refund or ReturnRefund record exists in DB
    const refundRecord =
      returnRequest.refundsV2?.find((r: any) => r.amount != null) ||
      returnRequest.refunds?.find((r: any) => r.amount != null);

    if (refundRecord && refundRecord.amount != null) {
      return Number(refundRecord.amount);
    }

    // 2. Compute return amount based on items and order unit prices
    let total = 0;
    const order = returnRequest.order;
    const billingLines = (order?.billingSnapshot as any)?.lines;

    if (Array.isArray(returnRequest.items)) {
      for (const item of returnRequest.items) {
        const qty =
          item.approvedQty ??
          item.receivedQty ??
          item.requestedQty ??
          0;
        if (qty <= 0) continue;

        let unitPrice = 0;

        // Try finding line in billingSnapshot
        if (Array.isArray(billingLines)) {
          const line = billingLines.find(
            (l: any) =>
              l.productId === item.productId &&
              (l.variantId || null) === (item.variantId || null),
          );
          if (line) {
            unitPrice = Number(line.unitPrice || line.price || 0);
          }
        }

        // Fallback to order items, variant price, or product price
        if (!unitPrice && order?.items && Array.isArray(order.items)) {
          const oi = order.items.find(
            (o: any) =>
              o.productId === item.productId &&
              (o.variantId || null) === (item.variantId || null),
          );
          if (oi) {
            unitPrice =
              oi.finalAmount != null && oi.quantity > 0
                ? Number(oi.finalAmount) / oi.quantity
                : Number(oi.unitPrice || 0);
          }
        }

        if (!unitPrice) {
          if (item.variant?.price != null) {
            unitPrice = Number(item.variant.price);
          } else if (item.product?.price != null) {
            unitPrice = Number(item.product.price);
          }
        }

        total += unitPrice * qty;
      }
    }

    return Number(total.toFixed(2));
  }

  private formatReturnRequestListItem(returnRequest: any, user: JwtUser) {
    if (!returnRequest) return null;
    let parsedImages: string[] = [];
    if (returnRequest.images) {
      try {
        const parsed =
          typeof returnRequest.images === 'string'
            ? JSON.parse(returnRequest.images)
            : returnRequest.images;
        if (Array.isArray(parsed)) {
          parsedImages = parsed;
        }
      } catch (e) {
        console.error('Failed to parse return images:', e);
      }
    }

    const mediaFiles: string[] = [];
    if (returnRequest.media && Array.isArray(returnRequest.media)) {
      for (const mediaItem of returnRequest.media) {
        if (mediaItem.files && Array.isArray(mediaItem.files)) {
          mediaFiles.push(...mediaItem.files);
        }
      }
    }

    const allFiles = Array.from(new Set([...parsedImages, ...mediaFiles]));

    const order = returnRequest.order;
    const customerName =
      order?.customer?.name ||
      order?.retailCustomer?.name ||
      (order?.billingSnapshot as any)?.customer?.name ||
      (order?.billingSnapshot as any)?.buyerName ||
      null;

    const customerEmail =
      order?.customer?.user?.email ||
      order?.customer?.altEmail ||
      order?.retailCustomer?.email ||
      (order?.billingSnapshot as any)?.customer?.email ||
      (order?.billingSnapshot as any)?.buyerEmail ||
      null;

    const customerPhone =
      order?.customer?.phone ||
      order?.retailCustomer?.phoneNorm ||
      (order?.billingSnapshot as any)?.customer?.phone ||
      (order?.billingSnapshot as any)?.buyerPhone ||
      null;

    const returnAmount = this.computeReturnAmount(returnRequest);

    const response = {
      ...returnRequest,
      returnAmount,
      customerName,
      customerEmail,
      customerPhone,
      images: allFiles.map((file: string) => this.getImageUrl(file)),
      customerEvidanceImages: parsedImages.map((file: string) =>
        this.getImageUrl(file),
      ),
      media: returnRequest.media
        ? returnRequest.media.map((mediaItem: any) => ({
            ...mediaItem,
            files:
              mediaItem?.files?.map((file: string) => this.getImageUrl(file)) ||
              [],
          }))
        : [],
    };

    if (user.role === Role.CUSTOMER) {
      delete response.media;
    }

    return response;
  }

  /**
   * Retrieves single return request with safety guards, exposing item cumulative metrics.
   */
  async findOne(returnNumber: string, user: JwtUser) {
    const includeParams: any = {
      items: {
        include: {
          product: {
            select: { id: true, name: true, slug: true, price: true },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              attributeSummary: true,
              price: true,
            },
          },
        },
      },
      exchangeItems: {
        include: {
          product: {
            select: { id: true, name: true, slug: true, price: true },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              attributeSummary: true,
              price: true,
            },
          },
        },
      },
      inspections: {
        include: {
          inspectedBy: { select: { id: true, email: true } },
        },
      },
      refunds: true,
      refundsV2: true,
      invoices: true,
      order: {
        include: {
          customer: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          retailCustomer: true,
        },
      },
      franchise: { select: { id: true, name: true, code: true } },
      media: true,
    };

    let returnRequest: any = await this.prisma.returnRequest.findUnique({
      where: { returnNumber },
      include: includeParams,
    });

    if (!returnRequest) {
      returnRequest = await this.prisma.returnRequest.findUnique({
        where: { id: returnNumber },
        include: includeParams,
      });
    }

    if (!returnRequest) {
      throw new NotFoundException(
        `Return request with Return Number or ID "${returnNumber}" not found.`,
      );
    }

    const isAdmin =
      user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;
    const effectiveFranchiseId =
      user.franchiseId ?? user.franchiseOwnerId ?? null;

    if (user.role === Role.CUSTOMER) {
      if (
        !user.customerId ||
        returnRequest.order?.customerId !== user.customerId
      ) {
        throw new ForbiddenException(
          'You are not allowed to view this return request.',
        );
      }
    } else if (!isAdmin) {
      if (
        !effectiveFranchiseId ||
        returnRequest.franchiseId !== effectiveFranchiseId
      ) {
        throw new ForbiddenException(
          'You are not allowed to view other franchise return requests.',
        );
      }
    }

    // Expose return quantity metrics on each item
    const itemsWithMetrics = await Promise.all(
      returnRequest.items.map(async (item: any) => {
        const metrics = await this.calculateItemReturnMetrics(
          returnRequest.orderId,
          item.productId,
          item.variantId,
        );
        return {
          ...item,
          ...metrics,
        };
      }),
    );

    // Fetch related audit logs for the timeline
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        resource: 'ReturnRequest',
        resourceId: returnRequest.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const auditUserIds = auditLogs.map((log) => log.userId).filter(Boolean);

    const actorUserIds = Array.from(
      new Set([
        returnRequest.requestedByUserId,
        returnRequest.requestedById,
        returnRequest.approvedByUserId,
        returnRequest.receivedByUserId,
        returnRequest.inspectedByUserId,
        returnRequest.closedByUserId,
        ...auditUserIds,
      ]),
    ).filter(Boolean) as string[];

    const actorUsers = await this.prisma.user.findMany({
      where: { id: { in: actorUserIds } },
      include: {
        customer: true,
        adminProfile: true,
        staffFranchise: true,
        franchise: true,
        franchiseOwner: true,
      },
    });

    const actorUsersMap = new Map<string, any>();
    for (const u of actorUsers) {
      actorUsersMap.set(u.id, u);
    }

    // Format actors
    const requestedByUser =
      returnRequest.requestedByUserId || returnRequest.requestedById
        ? actorUsersMap.get(
            returnRequest.requestedByUserId || returnRequest.requestedById,
          )
        : null;
    const approvedByUser = returnRequest.approvedByUserId
      ? actorUsersMap.get(returnRequest.approvedByUserId)
      : null;
    const receivedByUser = returnRequest.receivedByUserId
      ? actorUsersMap.get(returnRequest.receivedByUserId)
      : null;
    const inspectedByUser = returnRequest.inspectedByUserId
      ? actorUsersMap.get(returnRequest.inspectedByUserId)
      : null;
    const closedByUser = returnRequest.closedByUserId
      ? actorUsersMap.get(returnRequest.closedByUserId)
      : null;

    // Construct workflow timeline
    const timeline: any[] = [];
    for (const log of auditLogs) {
      let status: string | null = null;
      let remarks: string | null = null;

      const logPerformer = actorUsersMap.get(log.userId);
      const performedBy = logPerformer ? this.formatActor(logPerformer) : null;

      const metadata = log.metadata
        ? typeof log.metadata === 'string'
          ? JSON.parse(log.metadata)
          : log.metadata
        : {};

      if (log.action === 'return.created') {
        status = ReturnStatus.REQUESTED;
        remarks = returnRequest.remarks;
      } else if (log.action.startsWith('return.status_')) {
        status = (metadata as any)?.toStatus || (metadata as any)?.status;
        if (!status) {
          const suffix = log.action.replace('return.status_', '').toUpperCase();
          status =
            Object.values(ReturnStatus).find(
              (s) => s.toUpperCase() === suffix,
            ) || null;
        }
        remarks = (metadata as any)?.remarks || null;
      }

      if (status) {
        timeline.push({
          status,
          timestamp: log.createdAt,
          remarks,
          performedBy,
        });
      }
    }

    // Fallback/Hybrid mechanism if timeline is empty
    if (timeline.length === 0) {
      if (returnRequest.createdAt) {
        const creator = actorUsersMap.get(
          returnRequest.requestedByUserId || returnRequest.requestedById,
        );
        timeline.push({
          status: ReturnStatus.REQUESTED,
          timestamp: returnRequest.createdAt,
          remarks: returnRequest.remarks,
          performedBy: creator ? this.formatActor(creator) : null,
        });
      }
      if (returnRequest.approvedAt && returnRequest.approvedByUserId) {
        const userObj = actorUsersMap.get(returnRequest.approvedByUserId);
        timeline.push({
          status: ReturnStatus.APPROVED,
          timestamp: returnRequest.approvedAt,
          remarks: null,
          performedBy: userObj ? this.formatActor(userObj) : null,
        });
      }
      if (returnRequest.receivedAt && returnRequest.receivedByUserId) {
        const userObj = actorUsersMap.get(returnRequest.receivedByUserId);
        const receivedStatus =
          returnRequest.sourceType === ReturnSourceType.STOCK_REQUEST
            ? ReturnStatus.RECEIVED_AT_WAREHOUSE
            : ReturnStatus.RECEIVED_AT_FRANCHISE;
        timeline.push({
          status: receivedStatus,
          timestamp: returnRequest.receivedAt,
          remarks: null,
          performedBy: userObj ? this.formatActor(userObj) : null,
        });
      }
      if (returnRequest.inspectedAt && returnRequest.inspectedByUserId) {
        const userObj = actorUsersMap.get(returnRequest.inspectedByUserId);
        const inspection = returnRequest.inspections?.[0];
        let qStatus: ReturnStatus = ReturnStatus.UNDER_INSPECTION;
        if (inspection) {
          if (inspection.result === InspectionResult.PASSED)
            qStatus = ReturnStatus.QC_PASSED;
          else if (inspection.result === InspectionResult.FAILED)
            qStatus = ReturnStatus.QC_FAILED;
          else if (inspection.result === InspectionResult.CONFLICT)
            qStatus = ReturnStatus.QC_CONFLICT;
        }
        timeline.push({
          status: qStatus,
          timestamp: returnRequest.inspectedAt,
          remarks: inspection?.remarks || null,
          performedBy: userObj ? this.formatActor(userObj) : null,
        });
      }
      if (returnRequest.closedAt && returnRequest.closedByUserId) {
        const userObj = actorUsersMap.get(returnRequest.closedByUserId);
        timeline.push({
          status: ReturnStatus.CLOSED,
          timestamp: returnRequest.closedAt,
          remarks: null,
          performedBy: userObj ? this.formatActor(userObj) : null,
        });
      }
    }

    let parsedImages: string[] = [];
    if (returnRequest.images) {
      try {
        const parsed =
          typeof returnRequest.images === 'string'
            ? JSON.parse(returnRequest.images)
            : returnRequest.images;
        if (Array.isArray(parsed)) {
          parsedImages = parsed;
        }
      } catch (e) {
        console.error('Failed to parse return images:', e);
      }
    }

    const mediaFiles: string[] = [];
    if (returnRequest.media && Array.isArray(returnRequest.media)) {
      for (const mediaItem of returnRequest.media) {
        if (mediaItem.files && Array.isArray(mediaItem.files)) {
          mediaFiles.push(...mediaItem.files);
        }
      }
    }

    const allFiles = Array.from(new Set([...parsedImages, ...mediaFiles]));
    const images = allFiles.map((file: string) => this.getImageUrl(file));
    const customerEvidanceImages = parsedImages.map((file: string) =>
      this.getImageUrl(file),
    );

    const creditNote = returnRequest.invoices?.find(
      (inv: any) => inv.type === 'CREDIT_NOTE' && !inv.isDeleted,
    );
    const refundReceipts =
      returnRequest.invoices?.filter(
        (inv: any) => inv.type === 'REFUND_RECEIPT' && !inv.isDeleted,
      ) || [];

    const order = returnRequest.order;
    const customerName =
      order?.customer?.name ||
      order?.retailCustomer?.name ||
      (order?.billingSnapshot as any)?.customer?.name ||
      (order?.billingSnapshot as any)?.buyerName ||
      null;

    const customerEmail =
      order?.customer?.user?.email ||
      order?.customer?.altEmail ||
      order?.retailCustomer?.email ||
      (order?.billingSnapshot as any)?.customer?.email ||
      (order?.billingSnapshot as any)?.buyerEmail ||
      null;

    const customerPhone =
      order?.customer?.phone ||
      order?.retailCustomer?.phoneNorm ||
      (order?.billingSnapshot as any)?.customer?.phone ||
      (order?.billingSnapshot as any)?.buyerPhone ||
      null;

    const returnAmount = this.computeReturnAmount(returnRequest);

    const response = {
      ...returnRequest,
      returnAmount,
      customerName,
      customerEmail,
      customerPhone,
      images,
      customerEvidanceImages,
      ...(returnRequest.media
        ? {
            media: returnRequest.media.map((mediaItem: any) => ({
              ...mediaItem,
              files: mediaItem?.files?.map((file: string) =>
                this.getImageUrl(file),
              ),
            })),
          }
        : {}),
      inspections: returnRequest.inspections
        ? returnRequest.inspections.map((insp: any) => {
            let parsedInspImages: string[] = [];
            if (insp.images) {
              try {
                const parsed =
                  typeof insp.images === 'string'
                    ? JSON.parse(insp.images)
                    : insp.images;
                if (Array.isArray(parsed)) {
                  parsedInspImages = parsed;
                }
              } catch (e) {
                console.error('Failed to parse inspection images:', e);
              }
            }
            return {
              ...insp,
              images: parsedInspImages.map((file: string) =>
                this.getImageUrl(file),
              ),
            };
          })
        : [],
      items: itemsWithMetrics,
      refunds: returnRequest.refundsV2 || [],
      refundReceipts,
      creditNoteId: creditNote?.id || null,
      creditNoteNumber: creditNote?.invoiceNumber || null,
      requestedBy: requestedByUser ? this.formatActor(requestedByUser) : null,
      approvedBy: approvedByUser ? this.formatActor(approvedByUser) : null,
      receivedBy: receivedByUser ? this.formatActor(receivedByUser) : null,
      inspectedBy: inspectedByUser ? this.formatActor(inspectedByUser) : null,
      closedBy: closedByUser ? this.formatActor(closedByUser) : null,
      timeline,
    };

    const canViewRefundPreference = [
      Role.SUPERADMIN,
      Role.ADMIN_STAFF,
      Role.FRANCHISE_OWNER,
      Role.FRANCHISE_STAFF,
    ].includes(user.role as any);

    if (!canViewRefundPreference) {
      delete response.refundReceivingSource;
      delete response.refundPreference;
    }

    if (user.role === Role.CUSTOMER) {
      delete response.media;
    }

    return response;
  }
}
