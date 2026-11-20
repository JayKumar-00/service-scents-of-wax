import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InvoiceService } from 'src/invoice/invoice.service';
import { InvoiceHtmlBuilder } from 'src/invoice/template/invoice-html.builder';
import { PdfGenerator } from 'src/common/utils/pdf-generator.util';
import {
  CreditAccountStatus,
  CreditDurationEnum,
  DeliveryStatus,
  DirectionEnum,
  InvoicePaymentStatus,
  InventoryReservationKind,
  InventoryReservationStatus,
  NotificationChannel,
  Prisma,
  ProductStatus,
  Role,
  StockRequest,
  StockRequestPaymentStatus,
  StockRequestStatus,
  StockRequestType,
} from '@prisma/client';
import { NotificationType } from 'src/notification/enums/notification-type.enum';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import {
  franchiseCanMutate,
  franchiseHasReadAccess,
} from '../common/franchise-roles';
import { DomainEventsService } from '../supply-chain/domain-events.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateAdminStockRequestDto } from './dto/create-admin-stock-request.dto';
import { CreateStockRequestDto } from './dto/create-stock-request.dto';
import { UpdateStockRequestPaymentDto } from './dto/update-stock-request-payment.dto';
import { StockRequestQueryDto } from './dto/stock-request.query.dto';
import { buildPrismaDateRangeFilter } from 'src/products/utils/range-filter.util';
import { OrderType } from 'src/common/dto/query.dto';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { RedisService } from 'src/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import {
  BulkRequestItem,
  CreateAdminBulkStockRequestDto,
} from './dto/create-bulk-stock-requests.dto';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { CreditTransactionEnum, StockRequestPaymentMode } from '@prisma/client';
import { BrevoService } from 'src/notification/services/brevo.service';
import { NotificationQueue } from 'src/notification/queues/notification.queue';
import { StockRequestPaymentTemplate, StockRequestStatusTemplate } from 'src/notification/templates/stock-request.template';
import { randomBytes } from 'crypto';
import { RazorpayService } from 'src/financial/payment/razorpay.service';
import { PaymentForEnum } from 'src/financial/payment/enums/payment.enum';
import { InstantStockRequestPaymentDto } from './dto/instant-stock-request-payment.dto';
import { BulkInstantStockRequestPaymentDto } from './dto/bulk-instant-stock-request-payment.dto';
import { CreditEventEmitter } from 'src/financial/credit/events/credit.event-emitter';

@Injectable()
export class StockRequestsService {
  //Response Mapper
  private mapProduct(p: any, targetVariantId?: string | null) {
    if (!p) return null;

    let variants = p.variants || [];
    if (targetVariantId) {
      variants = variants.filter((v: any) => v.id === targetVariantId);
    }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      stock: p.stock,
      wholesalePrice: p.wholesalePrice,
      mrpPrice: p.mrpPrice,
      price: p.price,
      variants,
      gstTax: p.gstTax,
      features: p.features,
      imageUrls: Array.isArray(p.imageUrls)
        ? p.imageUrls.map((u: string) => this.applyAwsPrefixToUrl(u))
        : [],

      category: p.category,
      brand: p.brandRef,
    };
  }

  private mapFranchise(item: any) {
    if (!item) return null;

    return {
      id: item.id,
      name: item.name,
      dob: item.dob,
      gender: item.gender,
      code: item.code,
      status: item.status,
      ownerFullName: item.ownerFullName,
      businessName: item.businessName,
      badges: item.badge,
      gstNumber: item.gstNumber,
      panNumber: item.panNumber,
      kycDocumentType: item.kycDocumentType,
      kycDocumentNumber: item.kycDocumentNumber,
      kycStatus: item.kycStatus,
      kycNote: item.kycNote,
      kycVerifiedAt: item.kycVerifiedAt,
      verifiedAt: item.kycVerifiedAt,
      documentType: item.kycDocumentType,
      documentNumber: item.kycDocumentNumber,
      basicDetailsCompleted: item.basicDetailsCompleted,
      gstDetailsCompleted: item.gstDetailsCompleted,
      approvedAt: item.approvedAt,
      approvedByUserId: item.approvedByUserId,
      phone: item.ownerPhone,
      email: item.ownerEmail,
      postalCode: item.postalCode,
      city: item.city,
      state: item.state,
      country: item.country,
      addressLine1: item.addressLine1,
      latitude: item.latitude,
      longitude: item.longitude,
      territory: item.territory,
      sopTrainingCompleted: item.sopTrainingCompleted,
      sopBrandingCompleted: item.sopBrandingCompleted,
      sopInfraAuditCompleted: item.sopInfraAuditCompleted,
      sopPosSetupCompleted: item.sopPosSetupCompleted,
      sopSafetyCompleted: item.sopSafetyCompleted,
      sopChecklistCompleted: item.sopChecklistCompleted,
      sopLastReviewedAt: item.sopLastReviewedAt,
      sopNote: item.sopNote,
    };
  }

  private responseMapper(item: any) {
    let approvedQuantity = item.approvedQuantity;
    let unitPriceAtApproval = item.unitPriceAtApproval;
    let gstRatePercent = item.gstRatePercent;
    let billingSubtotal = item.billingSubtotal;
    let billingTax = item.billingTax;
    let billingTotal = item.billingTotal;

    if (item.type === 'BUNDLE' && (billingSubtotal === null || billingSubtotal === undefined)) {
      approvedQuantity = item.approvedQuantity ?? item.quantity ?? 0;

      let targetVariant = item.variant;
      if (item.variantId && item.product?.variants) {
        targetVariant = item.product.variants.find((v: any) => v.id === item.variantId) || item.variant;
      }

      const unitPrice = targetVariant
        ? (targetVariant.wholesalePrice ?? new Prisma.Decimal(0))
        : (item.product?.wholesalePrice ?? new Prisma.Decimal(0));

      const gstRate = targetVariant
        ? new Prisma.Decimal(targetVariant.gstTax ?? 0)
        : (item.product?.defaultGstRatePercent ?? new Prisma.Decimal(item.product?.gstTax ?? 0));

      const up = new Prisma.Decimal(unitPrice);
      const gr = new Prisma.Decimal(gstRate);
      const qty = new Prisma.Decimal(approvedQuantity);

      unitPriceAtApproval = up;
      gstRatePercent = gr;
      billingSubtotal = up.mul(qty);
      billingTax = up.mul(qty).mul(gr).div(new Prisma.Decimal(100));
      billingTotal = up.mul(qty).mul(new Prisma.Decimal(100).add(gr)).div(new Prisma.Decimal(100));
    }

    return {
      id: item.id,
      quantity: item.quantity,
      type: item.type,
      status: item.status,
      note: item.note,
      paymentMode: item.paymentMode,
      creditDuration: item.creditDuration,

      ...(item.type === 'BUNDLE'
        ? {
          productName: item.product?.name ?? null,
          variantName: item.variant?.attributeSummary
            ? item.variant.attributeSummary.toUpperCase()
            : null,
        }
        : {}),

      product: this.mapProduct(item.product, item.variantId),
      variant: item.variant,

      franchise: {
        ...this.mapFranchise(item.franchise),
      },

      reviewedBy: item.reviewedBy,
      deliveries: item.deliveries || [],
      reviewedById: item.reviewedById,
      reviewedAt: item.reviewedAt,
      ...(item.rejectReason ? { rejectReason: item.rejectReason } : {}),
      ...(approvedQuantity !== null && approvedQuantity !== undefined
        ? { approvedQuantity }
        : {}),
      ...(unitPriceAtApproval !== null && unitPriceAtApproval !== undefined
        ? { unitPriceAtApproval }
        : {}),
      ...(gstRatePercent !== null && gstRatePercent !== undefined ? { gstRatePercent } : {}),

      billingSubtotal,
      billingTax,
      billingTotal,

      paymentStatus: item.paymentStatus,
      paymentReceivedAt: item.paymentReceivedAt,
      paymentReference: item.paymentReference,
      paymentNote: item.paymentNote,

      bundleAssignments: item.bundleAssignments || [],

      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
    private readonly domainEvents: DomainEventsService,
    private readonly redisService: RedisService,
    private readonly brevoService: BrevoService,
    private readonly notificationQueue: NotificationQueue,
    private readonly razorpayService: RazorpayService,
    private readonly creditEventEmitter: CreditEventEmitter,
    @Inject(forwardRef(() => InvoiceService))
    private readonly invoiceService: InvoiceService,
  ) {}

  private async getInvoicePdfAttachmentForStockRequest(
    stockRequestId: string,
  ): Promise<Array<{ content: string; name: string }> | undefined> {
    try {
      if (!this.invoiceService) return undefined;
      const invoice = await this.invoiceService.generatedInvoice({
        stockRequestId,
      } as any);
      if (!invoice || !invoice.invoiceNumber) return undefined;

      const invoiceViewModel = await this.invoiceService.getInvoiceByNumber(
        invoice.invoiceNumber,
        { role: Role.SUPERADMIN } as any,
      );
      const htmlContent = InvoiceHtmlBuilder.build(invoiceViewModel, {
        autoPrint: false,
      });
      const pdfBuffer = await PdfGenerator.generateFromHtml(htmlContent, {
        noHeaderFooter: true,
      });
      return [
        {
          content: pdfBuffer.toString('base64'),
          name: `Invoice-${invoice.invoiceNumber}.pdf`,
        },
      ];
    } catch (err: any) {
      console.error(
        `Failed to generate invoice PDF attachment for stock request ${stockRequestId}: ${err.message}`,
      );
      return undefined;
    }
  }

  private readonly BASE_CHACHE = `stock-request`; // seconds

  private awsPrefix = this.configService
    .get<string>('AWS_PREFIX_URL')
    ?.replace(/\/$/, '');

  private applyAwsPrefixToUrl(url?: string | null) {
    if (!url) return url;
    if (!this.awsPrefix) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `${this.awsPrefix}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private applyAwsPrefixToProduct<T extends Record<string, any>>(p: T): T {
    if (!p) return p;
    const copy = { ...p } as any;
    copy.imageUrl = this.applyAwsPrefixToUrl(copy.imageUrl);
    if (Array.isArray(copy.imageUrls)) {
      copy.imageUrls = copy.imageUrls.map((u: string) =>
        this.applyAwsPrefixToUrl(u),
      );
    }
    return copy;
  }

  private buildStockRequestSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'product.name']);

  private async stockingNodeIdForFranchise(
    franchiseId: string,
  ): Promise<string | null> {
    const n = await this.prisma.stockingNode.findFirst({
      where: { franchiseId },
    });
    return n?.id ?? null;
  }

  // Update...Now
  private async findFranchiseOwnerUser(
    franchiseId: string,
    ownerEmail?: string | null,
  ) {
    const byFranchise = await this.prisma.user.findFirst({
      where: {
        franchiseId,
        role: Role.FRANCHISE_OWNER,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (byFranchise) {
      return byFranchise;
    }

    if (!ownerEmail) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: {
        email: ownerEmail,
        role: Role.FRANCHISE_OWNER,
      },
      select: {
        id: true,
        email: true,
      },
    });
  }

  private async reserveCentralForStockRequest(
    tx: Prisma.TransactionClient,
    params: {
      stockRequestId: string;
      productId: string;
      variantId?: string | null;
      quantity: number;
      note?: string;
    },
  ): Promise<void> {
    let ws = await tx.warehouseStock.findUnique({
      where: { productId: params.productId },
    });
    if (!ws) {
      const product = await tx.product.findUnique({
        where: { id: params.productId },
        include: { variants: true },
      });
      let initialStock = product?.stock ?? 0;
      if (product && product.variants.length > 0) {
        initialStock = product.variants.reduce(
          (sum: number, v: any) => sum + (v.stock ?? 0),
          0,
        );
      }
      ws = await tx.warehouseStock.create({
        data: {
          productId: params.productId,
          quantity: initialStock,
          reserved: 0,
          lowStockThreshold: 5,
        },
      });
    }
    const available = (ws.quantity ?? 0) - (ws.reserved ?? 0);
    if (available < params.quantity) {
      throw new BadRequestException(
        'Insufficient central warehouse available stock',
      );
    }
    await tx.warehouseStock.update({
      where: { productId: params.productId },
      data: { reserved: { increment: params.quantity } },
    });

    await tx.inventoryReservation.create({
      data: {
        kind: InventoryReservationKind.CENTRAL_STOCK_REQUEST,
        status: InventoryReservationStatus.ACTIVE,
        productId: params.productId,
        quantity: params.quantity,
        stockRequestId: params.stockRequestId,
        note: params.note ?? 'Reserved at stock request approval',
      },
    });

    // Decrease the base product stock immediately to reflect available stock
    const prodWithVariants = await tx.product.findUnique({
      where: { id: params.productId },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });

    if (prodWithVariants) {
      if (prodWithVariants.variants.length > 0) {
        let targetVariant = null;

        if (params.variantId) {
          targetVariant = prodWithVariants.variants.find(
            (v: any) => v.id === params.variantId,
          );
        } else {
          targetVariant = prodWithVariants.variants[0];
        }

        if (targetVariant) {
          await tx.productVariant.update({
            where: { id: targetVariant.id },
            data: { stock: { decrement: params.quantity } },
          });
        }
      }

      await tx.product.update({
        where: { id: params.productId },
        data: { stock: { decrement: params.quantity } },
      });
    }

    // Invalidate cache since we decremented product and variant stock
    fireAndForget(this.redisService.del([`product:${params.productId}`]), 'cache_invalidate');
  }

  // Use cron also to attempt recovery of remaining payment from credit accounts for partially paid stock requests
  async consumeCentralReservationForStockRequest(
    tx: Prisma.TransactionClient,
    params: {
      stockRequestId: string;
      productId: string;
      variantId?: string;
      quantity: number;
    },
  ): Promise<void> {
    const active = await tx.inventoryReservation.findFirst({
      where: {
        stockRequestId: params.stockRequestId,
        kind: InventoryReservationKind.CENTRAL_STOCK_REQUEST,
        status: InventoryReservationStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!active || active.quantity < params.quantity) {
      throw new BadRequestException(
        'No active central reservation available for dispatch',
      );
    }
    const ws = await tx.warehouseStock.findUnique({
      where: { productId: params.productId },
    });
    if (!ws || ws.quantity < params.quantity || ws.reserved < params.quantity) {
      throw new BadRequestException(
        'Central stock reservation is out of sync for dispatch',
      );
    }

    // Decrease warehouse stock (central stock)
    await tx.warehouseStock.update({
      where: { productId: params.productId },
      data: {
        quantity: { decrement: params.quantity },
        reserved: { decrement: params.quantity },
      },
    });
    await tx.inventoryReservation.update({
      where: { id: active.id },
      data: {
        status: InventoryReservationStatus.CONSUMED,
        note: 'Consumed on dispatch',
      },
    });
  }

  private async notifyNewOrCancelStockRequest(reqData: {
    stockRequestId: string;
    franchiseId: string;
    ownerName: string;
    code: string;
    phone: string;
    ownerEmail: string;
    businessName: string;
    businessEmail: string;
    totalStock: number;
    reason?: string;
  }) {
    const {
      stockRequestId,
      franchiseId,
      code: franchiseCode,
      ownerName: franchiseName,
      businessName,
      businessEmail,
      totalStock,
      reason,
    } = reqData;
    // console.log(
    //   `Notifying SuperAdmins about new stock: FranchiseID: ${reqData.franchiseId}, Franchise Code: (${franchiseCode}), Total Stock: ${totalStock}`,
    // );
    try {
      const user = await this.prisma.user.findFirstOrThrow({
        where: { role: Role.SUPERADMIN },
      });

      const title = reason
        ? 'Stock Request Cancelled'
        : 'New Stock Request Created';
      const body = reason
        ? `Stock request has been cancelled by franchise ${franchiseName} (${franchiseCode}). Reason: ${reason}.`
        : `New stock request has been created by franchise ${franchiseName} (${franchiseCode}) with Stock: ${totalStock}.`;

      // Create in-app notification and send email to SuperAdmin
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title,
          body,
          type: NotificationType.FRANCHISE_STOCK_REQUEST,
          channel: NotificationChannel.IN_APP,
          metadata: {
            stockRequestId,
            franchiseId,
            franchiseName,
            franchiseCode,
            businessName,
            businessEmail,
            phone: reqData.phone,
            ...(reason ? { reason } : {}),
          },
        },
      });
    } catch (error: any) {
      console.error(
        `Failed to notify SuperAdmins about new franchise: ${error.message}`,
      );
      // Non-critical operation, don't throw
    }
  }

  async create(dto: CreateStockRequestDto, user: JwtUser) {
    if (!franchiseCanMutate(user.role)) {
      throw new ForbiddenException();
    }

    const franchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (!franchiseId) {
      throw new BadRequestException('No franchise linked');
    }

    // Validate: at least productId or variantId must be provided
    if (!dto.productId?.trim() && !dto.variantId?.trim()) {
      throw new BadRequestException(
        'Either productId or variantId must be provided',
      );
    }

    let productId = dto.productId?.trim();
    let variantId = dto.variantId?.trim();

    // Priority: Try variant first, then fallback to product
    if (variantId || productId) {
      const idToCheck = variantId || productId;

      // Try to find as variant first
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: idToCheck },
        select: { productId: true, isActive: true },
      });

      if (variant) {
        // Found as variant - use it
        if (!variant.isActive) {
          throw new BadRequestException('Product variant is inactive');
        }
        variantId = idToCheck;
        productId = variant.productId;
      } else {
        // Not found as variant, try as product
        const product = await this.prisma.product.findUnique({
          where: { id: idToCheck },
          select: { status: true },
        });
        if (!product || product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException(
            'Product or variant not found or inactive',
          );
        }
        productId = idToCheck;
        variantId = undefined;
      }
    }

    const row = await this.prisma.stockRequest.create({
      data: {
        franchiseId: franchiseId,
        productId: productId!,
        variantId: variantId || null,
        quantity: dto.quantity,
        note: dto.note,
        status: StockRequestStatus.PENDING,
        type: dto.type || StockRequestType.STOCK_REQUEST,
      },
      include: {
        product: true,
        variant: true,
        franchise: {
          select: {
            id: true,
            name: true,
            code: true,
            ownerFullName: true,
            ownerEmail: true,
            ownerPhone: true,
            businessName: true,
          },
        },
      },
    });

    const nodeId = await this.stockingNodeIdForFranchise(franchiseId);

    void this.domainEvents.emit(
      'inventory.stock_request.created',
      {
        stockRequestId: row.id,
        franchiseId: row.franchiseId,
        productId: row.productId,
        variantId: variantId || undefined,
        quantity: row.quantity,
      },
      {
        refType: 'STOCK_REQUEST',
        refId: row.id,
        productId: row.productId,
        variantId: variantId || undefined,
        stockingNodeId: nodeId,
      },
    );

    await this.notifyNewOrCancelStockRequest({
      stockRequestId: row.id,
      franchiseId: row.franchiseId,
      ownerName: row.franchise.ownerFullName || row.franchise.name,
      code: row.franchise.code,
      businessName: row.franchise.businessName || row.franchise.name,
      businessEmail: row.franchise.ownerEmail || user.email,
      ownerEmail: row.franchise.ownerEmail || user.email,
      totalStock: row.quantity,
      phone: row.franchise.ownerPhone ?? 'N/A',
    });

    return row;
  }

  async instantPayment(
    id: string,
    dto: InstantStockRequestPaymentDto,
    user: JwtUser,
  ) {
    if (!franchiseCanMutate(user.role)) {
      throw new ForbiddenException(
        'User does not have permission to make payment for stock requests',
      );
    }

    const franchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (!franchiseId) {
      throw new BadRequestException('No franchise linked');
    }

    const stockRequest = await this.prisma.stockRequest.findUnique({
      where: { id },
      include: {
        product: true,
        variant: true,
        franchise: true,
      },
    });

    if (!stockRequest) {
      throw new NotFoundException('Stock request not found');
    }

    if (stockRequest.franchiseId !== franchiseId) {
      throw new ForbiddenException(
        `Request does not belong to user's franchise`,
      );
    }

    if (stockRequest.paymentStatus === StockRequestPaymentStatus.PAID) {
      throw new BadRequestException('Stock request is already paid');
    }

    if (
      stockRequest.status === StockRequestStatus.CANCELLED ||
      stockRequest.status === StockRequestStatus.REJECTED
    ) {
      throw new BadRequestException('Stock request is not payable');
    }

    const billingTotal = Number(stockRequest.billingTotal ?? 0);
    const fallbackAmount = stockRequest.variant
      ? // ? Number(stockRequest.variant.price) *
      Number(
        stockRequest.variant.wholesalePrice ?? stockRequest.variant.price,
      ) *
      stockRequest.quantity *
      (1 + Number(stockRequest.variant.gstTax ?? 0) / 100)
      : // : Number(stockRequest.product.price) *
      Number(
        stockRequest.product.wholesalePrice ?? stockRequest.product.price,
      ) *
      stockRequest.quantity *
      (1 + Number(stockRequest.product.defaultGstRatePercent ?? 0) / 100);

    const outstandingAmount = Math.max(
      (billingTotal > 0 ? billingTotal : fallbackAmount) -
      Number(stockRequest.paidAmount ?? 0),
      0,
    );

    console.log(
      `Calculated outstanding amount for stock request ${id} is ${outstandingAmount}`,
    );

    if (outstandingAmount <= 0) {
      throw new BadRequestException(
        'No outstanding amount to pay for this stock request',
      );
    }

    if (dto.paymentMode === StockRequestPaymentMode.CREDIT) {
      const uniqueRefId = `REF-INSTANT-${randomBytes(6).toString('hex').toUpperCase()}`;
      const now = new Date();

      const out = await this.prisma.$transaction(
        async (tx) => {
          const creditAccount = await tx.creditAccount.findFirst({
            where: {
              franchiseId: stockRequest.franchiseId,
              status: CreditAccountStatus.ACTIVE,
            },
          });

          if (!creditAccount) {
            throw new BadRequestException('No active credit account found');
          }

          const availableCredit = Number(creditAccount.availableCredit || 0);

          const isDurationBased =
            dto.duration != null || creditAccount.duration != null;

          let usedAdvance = 0;
          let usedCredit = 0;

          if (isDurationBased) {
            // Duration-Based Orders: Only increase advanceBalance.
            usedAdvance = outstandingAmount;

            await tx.creditAccount.update({
              where: {
                id: creditAccount.id,
              },
              data: {
                advanceBalance: {
                  increment: usedAdvance,
                },
              },
            });

            await tx.creditTransaction.create({
              data: {
                accountId: creditAccount.id,
                franchiseId: stockRequest.franchiseId,
                type: CreditTransactionEnum.ORDER,
                direction: DirectionEnum.DEBIT,
                amount: usedAdvance,
                balanceBefore: Number(creditAccount.advanceBalance || 0),
                balanceAfter:
                  Number(creditAccount.advanceBalance || 0) + usedAdvance,
                description: `Instant duration-based credit used for stock request ${stockRequest.invoiceNumber || stockRequest.id
                  }`,
                referenceId: stockRequest.id,
                referenceType: 'STOCK_REQUEST',
              },
            });
          } else {
            // Credit-Based Orders: deduct from availableCredit
            if (outstandingAmount > availableCredit) {
              throw new BadRequestException(
                `You are exceeding your credit limit. Please add balance into Credit Account first.`,
              );
            }

            usedCredit = outstandingAmount;

            await tx.creditAccount.update({
              where: {
                id: creditAccount.id,
              },
              data: {
                usedCredit: {
                  increment: usedCredit,
                },
                availableCredit: {
                  decrement: usedCredit,
                },
              },
            });

            await tx.creditTransaction.create({
              data: {
                accountId: creditAccount.id,
                franchiseId: stockRequest.franchiseId,
                type: CreditTransactionEnum.PAYMENT,
                direction: DirectionEnum.DEBIT,
                amount: usedCredit,
                balanceBefore: Number(creditAccount.usedCredit || 0),
                balanceAfter:
                  Number(creditAccount.usedCredit || 0) + usedCredit,
                description: `Instant credit used for stock request ${stockRequest.invoiceNumber || stockRequest.id
                  }`,
                referenceId: stockRequest.id,
                referenceType: 'STOCK_REQUEST',
              },
            });
          }

          // UPDATE STOCK REQUEST
          const totalPaidNow = usedAdvance + usedCredit;
          const newPaidAmount =
            Number(stockRequest.paidAmount || 0) + totalPaidNow;
          const billingTotalVal =
            billingTotal > 0 ? billingTotal : fallbackAmount;
          const remainingAfter = billingTotalVal - newPaidAmount;
          const isFullyPaid = remainingAfter <= 0;

          const updatedReq = await tx.stockRequest.update({
            where: { id },
            data: {
              paidAmount: newPaidAmount,
              remainingAmount: Math.max(remainingAfter, 0),
              isFullyPaid,
              paymentStatus: isFullyPaid
                ? StockRequestPaymentStatus.PAID
                : StockRequestPaymentStatus.PARTIALLY_PAID,
              paymentMode: StockRequestPaymentMode.CREDIT,
              creditDuration: dto.duration || creditAccount.duration || null,
              paymentReference: uniqueRefId,
              paymentReceivedAt: now,
              paymentNote: 'Paid instantly via Credit Account',
            },
          });

          if (isFullyPaid) {
            await tx.invoice.updateMany({
              where: {
                stockRequestId: id,
                isDeleted: false,
              },
              data: {
                paymentStatus: InvoicePaymentStatus.PAID,
                paymentReferenceId: uniqueRefId,
              },
            });
          }

          // if (isFullyPaid) { *****UI_DEV
          //   await this.releaseScheduledDeliveries(tx, updatedReq, now);
          // }

          return tx.stockRequest.findUniqueOrThrow({
            where: { id },
            include: {
              product: true,
              variant: true,
              franchise: true,
              deliveries: {
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          });
        },
        { timeout: 15000 },
      );

      // Trigger event
      void this.stockingNodeIdForFranchise(out.franchiseId).then(
        (stockingNodeId) =>
          this.domainEvents.emit(
            'inventory.stock_request.payment_updated',
            {
              stockRequestId: out.id,
              franchiseId: out.franchiseId,
              paymentStatus: out.paymentStatus,
              paidAmount: out.paidAmount,
              remainingAmount: out.remainingAmount,
            },
            {
              refType: 'STOCK_REQUEST',
              refId: out.id,
              productId: out.productId,
              variantId: out.variant?.id || undefined,
              stockingNodeId,
            },
          ),
      );

      // Trigger notification
      await this.notifyStockRequestPayment({
        stockRequestId: out.id,
        userId: user.sub,
        franchiseId: out.franchiseId,
        ownerName: out.franchise.ownerFullName || out.franchise.name || 'N/A',
        code: out.franchise.code,
        businessName: out.franchise.businessName || out.franchise.name || 'N/A',
        businessEmail:
          out.franchise.ownerEmail || out.franchise.businessEmail || 'N/A',
        ownerEmail:
          out.franchise.ownerEmail || out.franchise.businessEmail || 'N/A',
        totalAmount: billingTotal > 0 ? billingTotal : fallbackAmount,
        cashAmount: 0,
        deductedAmount: outstandingAmount,
        remainingAmount: Number(out.remainingAmount || 0),
        paymentStatus: out.paymentStatus,
        paymentReference: uniqueRefId,
      });

      return out;
    }

    /*
    const order = await this.razorpayService.createOrder({
      paymentFor: PaymentForEnum.STOCK_REQUESTS,
      stockRequest: {
        id: stockRequest.id,
      },
    });

    const updatedStockRequest = await this.prisma.stockRequest.update({
      where: { id },
      data: {
        paymentMode: dto.paymentMode,
        creditDuration: null,
        paymentNote: `Razorpay order created: ${order.id}`,
      },
      include: {
        product: true,
        variant: true,
        franchise: true,
      },
    });

    return {
      stockRequest: updatedStockRequest,
      paymentOrder: order,
    };
    */
  }

  async bulkInstantPayment(
    ids: string[],
    dto: BulkInstantStockRequestPaymentDto,
    user: JwtUser,
  ) {
    if (!franchiseCanMutate(user.role)) {
      throw new ForbiddenException();
    }

    const franchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (!franchiseId) {
      throw new BadRequestException('No franchise linked');
    }

    const results: Array<any> = [];

    for (const id of ids) {
      try {
        const itemDto: InstantStockRequestPaymentDto = {
          paymentMode: dto.paymentMode as any,
          duration: dto.duration as any,
        };

        const res = await this.instantPayment(id, itemDto, user);

        results.push({ id, success: true, result: res });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error?.message || String(error),
        });
      }
    }

    return results;
  }

  async createByAdmin(
    dto: CreateAdminStockRequestDto,
    creator: JwtUser,
    ip?: string | null,
  ) {
    // Validate: at least productId or variantId must be provided
    if (!dto.productId?.trim() && !dto.variantId?.trim()) {
      throw new BadRequestException(
        'Either productId or variantId must be provided',
      );
    }

    const franchise = await this.prisma.franchise.findUnique({
      where: { id: dto.franchiseId },
    });
    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }

    let productId = dto.productId?.trim();
    let variantId = dto.variantId?.trim();

    // Priority: Try variant first, then fallback to product
    if (variantId || productId) {
      const idToCheck = variantId || productId;

      // Try to find as variant first
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: idToCheck },
        select: { productId: true, isActive: true },
      });

      if (variant) {
        // Found as variant - use it
        if (!variant.isActive) {
          throw new BadRequestException('Product variant is inactive');
        }
        variantId = idToCheck;
        productId = variant.productId;
      } else {
        // Not found as variant, try as product
        const product = await this.prisma.product.findUnique({
          where: { id: idToCheck },
          select: { status: true },
        });
        if (!product || product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException(
            'Product or variant not found or inactive',
          );
        }
        productId = idToCheck;
        variantId = undefined;
      }
    }

    const row = await this.prisma.stockRequest.create({
      data: {
        franchiseId: dto.franchiseId,
        productId: productId!,
        variantId: variantId || null,
        quantity: dto.quantity,
        note: dto.note?.trim() || 'Created by superadmin',
        status: StockRequestStatus.PENDING,
        type: dto.type || StockRequestType.STOCK_REQUEST,
      },
      include: { product: true, variant: true, franchise: true },
    });

    fireAndForget(
      this.audit.log({
        userId: creator.sub,
        action: 'stock_request.create_admin',
        resource: 'StockRequest',
        resourceId: row.id,
        metadata: {
          franchiseId: row.franchiseId,
          productId: row.productId,
          variantId: variantId || undefined,
          quantity: row.quantity,
        },
        ip: ip || null,
      }),
      'stock_request.create_admin',
    );

    const nodeId = await this.stockingNodeIdForFranchise(row.franchiseId);
    void this.domainEvents.emit(
      'inventory.stock_request.created',
      {
        stockRequestId: row.id,
        franchiseId: row.franchiseId,
        productId: row.productId,
        variantId: variantId || undefined,
        quantity: row.quantity,
        source: 'superadmin',
      },
      {
        refType: 'STOCK_REQUEST',
        refId: row.id,
        productId: row.productId,
        variantId: variantId || undefined,
        stockingNodeId: nodeId,
      },
    );

    await this.notifyNewOrCancelStockRequest({
      stockRequestId: row.id,
      franchiseId: row.franchiseId,
      ownerName: row.franchise.ownerFullName || row.franchise.name,
      code: row.franchise.code,
      businessName: row.franchise.businessName || row.franchise.name,
      businessEmail: row.franchise.ownerEmail || dto.meta.email,
      ownerEmail: row.franchise.ownerEmail || dto.meta.email,
      totalStock: row.quantity,
      phone: row.franchise.ownerPhone ?? dto.meta.phone,
    });

    return row;
  }

  private async bulkRequest(
    franchiseId: string,
    items: BulkRequestItem[],
    note?: string,
    type: StockRequestType = StockRequestType.STOCK_REQUEST,
  ) {
    const franchise = await this.prisma.franchise.findUniqueOrThrow({
      where: { id: franchiseId },
    });

    if (!items.length) {
      throw new BadRequestException('At least one line item is required');
    }
    const lines = items.map((line) => {
      const productId = line.productId?.trim();
      const variantId = line.variantId?.trim() || undefined;

      if (!productId) {
        throw new BadRequestException('Each line needs a product id');
      }
      if (!Number.isFinite(line.quantity) || line.quantity < 1) {
        throw new BadRequestException('Each line needs quantity ≥ 1');
      }
      return {
        productId,
        variantId,
        quantity: Math.floor(line.quantity),
      };
    });

    const uniqueProductIds = Array.from(new Set(lines.map((l) => l.productId)));
    const uniqueVariantIds = Array.from(
      new Set(lines.map((l) => l.variantId).filter(Boolean) as string[]),
    );

    const [products, variants] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          id: { in: uniqueProductIds },
          status: ProductStatus.ACTIVE,
          visibility: true,
        },
        select: { id: true },
      }),
      uniqueVariantIds.length > 0
        ? this.prisma.productVariant.findMany({
          where: {
            id: { in: uniqueVariantIds },
            isActive: true,
          },
          select: { id: true, productId: true },
        })
        : Promise.resolve([]),
    ]);

    if (products.length !== uniqueProductIds.length) {
      throw new BadRequestException(
        'One or more products are missing or inactive',
      );
    }

    if (variants.length !== uniqueVariantIds.length) {
      throw new BadRequestException(
        'One or more variants are missing or inactive',
      );
    }

    const activeProductIds = new Set(products.map((product) => product.id));
    const variantById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const rows: any[] = [];
      for (const line of lines) {
        let resolvedProductId = line.productId;
        let resolvedVariantId: string | null = null;

        if (line.variantId) {
          const variant = variantById.get(line.variantId);
          if (!variant) {
            throw new BadRequestException(
              'One or more variants are missing or inactive',
            );
          }

          if (variant.productId !== line.productId) {
            throw new BadRequestException(
              `Variant ${line.variantId} does not belong to product ${line.productId}`,
            );
          }

          resolvedProductId = variant.productId;
          resolvedVariantId = variant.id;
        }

        if (!activeProductIds.has(resolvedProductId)) {
          throw new BadRequestException(
            'One or more products are missing or inactive',
          );
        }

        const r = await tx.stockRequest.create({
          data: {
            franchiseId: franchise.id,
            productId: resolvedProductId,
            variantId: resolvedVariantId,
            quantity: line.quantity,
            note: note ?? null,
            status: StockRequestStatus.PENDING,
            type,
          },
          include: { product: true, variant: true },
        });
        rows.push(r);
      }
      return rows;
    });

    const nodeId = await this.stockingNodeIdForFranchise(franchise.id);
    for (const row of created) {
      void this.domainEvents.emit(
        'inventory.stock_request.created',
        {
          stockRequestId: row.id,
          franchiseId: row.franchiseId,
          productId: row.productId,
          quantity: row.quantity,
        },
        {
          refType: 'STOCK_REQUEST',
          refId: row.id,
          productId: row.productId,
          stockingNodeId: nodeId,
        },
      );
    }

    await this.notifyNewOrCancelStockRequest({
      stockRequestId: items.map((i) => i.productId).join(', '), // Multiple products
      franchiseId: franchise.id,
      ownerName: franchise.ownerFullName || franchise.name,
      code: franchise.code,
      businessName: franchise.businessName || franchise.name,
      businessEmail: franchise.ownerEmail || 'N/A',
      ownerEmail: franchise.ownerEmail || 'N/A',
      totalStock: lines.reduce((sum, l) => sum + l.quantity, 0),
      phone: franchise.ownerPhone ?? 'N/A',
    });

    return created;
  }

  async createByAdminInBulk(
    user: JwtUser,
    dto: CreateAdminBulkStockRequestDto,
    ip: string,
  ) {
    const { franchiseId, items, note, type } = dto;
    const result = await this.bulkRequest(franchiseId, items, note, type);

    fireAndForget(
      this.audit.log({
        userId: user.sub, // System action, no specific user
        action: 'stock_request.bulk_create_admin',
        resource: 'StockRequest',
        resourceId: null, // Multiple resources created
        metadata: {
          franchiseId,
          itemCount: items.length,
          totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        },
        ip,
      }),
      'stock_request.bulk_create_admin',
    );

    return result;
  }

  async createByFranchiseInBulk(
    user: JwtUser,
    items: { productId: string; quantity: number }[],
    note?: string,
    ip?: string,
    type: StockRequestType = StockRequestType.STOCK_REQUEST,
  ) {
    if (!franchiseCanMutate(user.role)) {
      throw new ForbiddenException();
    }

    const franchiseId =
      user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (!franchiseId) {
      throw new BadRequestException('No franchise linked');
    }

    const result = await this.bulkRequest(franchiseId, items, note, type);

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'stock_request.bulk_create_franchise',
        resource: 'StockRequest',
        resourceId: items.map((i) => i.productId).join(', '), // Multiple resources created
        ip,
      }),
    );

    return result;
  }

  async listWithFiltersPagination(
    user: JwtUser,
    query: StockRequestQueryDto,
  ): Promise<{
    data: StockRequest[];
    meta: IMeta;
  }> {
    const q: any = query ?? {};

    const clauses: Record<string, unknown>[] = [];

    if (user.role === Role.FRANCHISE_STAFF) {
      clauses.push({ franchise: { id: user.franchiseOwnerId } });
    } else if (franchiseHasReadAccess(user.role)) {
      clauses.push({ franchise: { id: user.franchiseId } });
    }

    const search = q.search?.trim();

    const searchFilter = search
      ? {
        OR: [
          {
            product: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
          {
            product: {
              category: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            product: {
              brandRef: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            franchise: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
          {
            bundleAssignments: {
              some: {
                bundle: {
                  items: {
                    some: {
                      product: {
                        name: { contains: search, mode: 'insensitive' },
                      },
                    },
                  },
                },
              },
            },
          },
          {
            bundleAssignments: {
              some: {
                bundle: {
                  items: {
                    some: {
                      product: {
                        category: {
                          name: { contains: search, mode: 'insensitive' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          {
            bundleAssignments: {
              some: {
                bundle: {
                  items: {
                    some: {
                      product: {
                        brandRef: {
                          name: { contains: search, mode: 'insensitive' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      }
      : {};

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (q.status) {
      clauses.push({ status: q.status });
    }

    if (q.type) {
      clauses.push({ type: q.type });
    }

    if (q.deliveryStatus) {
      clauses.push({
        deliveries: {
          some: {
            status: q.deliveryStatus,
          },
        },
      });

      if (user.role === Role.FRANCHISE_OWNER || user.role === Role.FRANCHISE_STAFF) {
        clauses.push({ paymentStatus: StockRequestPaymentStatus.PAID });
      }
    }

    if (q.paymentStatus) {
      clauses.push({ paymentStatus: q.paymentStatus });

      if (
        q.paymentStatus === StockRequestPaymentStatus.UNPAID &&
        (user.role === Role.FRANCHISE_OWNER || user.role === Role.FRANCHISE_STAFF)
      ) {
        clauses.push({ status: StockRequestStatus.APPROVED });
      }
    }

    if (q.franchiseId) {
      clauses.push({
        franchise: {
          id: q.franchiseId,
        },
      });
    }

    if (q.kycStatus) {
      clauses.push({ kycStatus: q.kycStatus });
    }

    if (q.email) {
      clauses.push({
        ownerEmail: { equals: q.email.trim(), mode: 'insensitive' },
      });
    }

    if (q.ownerEmail) {
      clauses.push({
        ownerEmail: { equals: q.ownerEmail.trim(), mode: 'insensitive' },
      });
    }

    if (q.ownerPhone) {
      clauses.push({ ownerPhone: { contains: q.ownerPhone.trim() } });
    }

    if (q.ownerFullName) {
      clauses.push({
        ownerFullName: {
          contains: q.ownerFullName.trim(),
          mode: 'insensitive',
        },
      });
    }

    if (query.fromDate || query.lastDate) {
      const createdAt = buildPrismaDateRangeFilter({
        fromDate: query.fromDate,
        toDate: query.lastDate,
      });

      clauses.push({ createdAt });
    }

    // Exclude BUNDLE stock requests that are not the primary one for their bundle assignment only if type is not specifically 'BUNDLE'
    if (q.type !== 'BUNDLE' && q.type !== StockRequestType.BUNDLE) {
      clauses.push({
        OR: [
          { type: { not: 'BUNDLE' } },
          {
            bundleAssignments: {
              some: {},
            },
          },
        ],
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const orderBy = this.buildStockRequestSortOrder(q.sortBy, q.order);

    // const cacheKey = `admin:franchises:page=${page}:limit=${limit}:order=${q.order ?? ''}:sortBy=${q.sortBy ?? ''}:search=${encodeURIComponent(
    //   String(q.search ?? ''),
    // )}:status=${q.status ?? ''}:kycStatus=${q.kycStatus ?? ''}`;

    // const cached = await this.redisService.get<{
    //   data: (Franchise & {
    //     documents: FranchiseDocument[];
    //     _count: { orders: number; users: number };
    //   })[];
    //   meta: IMeta;
    // }>(cacheKey);

    // if (cached) {
    //   return cached;
    // }

    const result = await paginatePrisma<any>({
      model: this.prisma.stockRequest as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            stock: true,
            gstTax: true,
            features: true,
            status: true,
            visibility: true,
            category: { select: { id: true, name: true } },
            brandRef: { select: { id: true, name: true, description: true } },
            fastDelivery: true,
            isFeatured: true,
            occasions: true,
            ratingAvg: true,
            reviewCount: true,
            defaultGstRatePercent: true,
            imageUrls: true,
            explicitAttributes: true,
            wholesalePrice: true,
            mrpPrice: true,
            price: true,
            variants: true,
            createdAt: true,
          },
        },
        franchise: true,
        reviewedBy: { select: { id: true, email: true, role: true } },
        deliveries: {
          ...(q.deliveryStatus ? { where: { status: q.deliveryStatus } } : {}),
          orderBy: { createdAt: 'asc' },
        },
        variant: {
          select: {
            id: true,
            attributeSummary: true,
          },
        },
        bundleAssignments: {
          include: {
            bundle: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const mappedData = result.data.map((item) => this.responseMapper(item));

    // Fetch all bundle stock requests for the franchises present in the current page
    const franchiseIds = Array.from(
      new Set(
        mappedData
          .map((item) => item.franchise?.id)
          .filter(Boolean) as string[]
      )
    );

    const allBundleRequests = franchiseIds.length > 0
      ? await this.prisma.stockRequest.findMany({
        where: {
          franchiseId: { in: franchiseIds },
          type: 'BUNDLE',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              stock: true,
              gstTax: true,
              features: true,
              status: true,
              visibility: true,
              category: { select: { id: true, name: true } },
              brandRef: { select: { id: true, name: true, description: true } },
              fastDelivery: true,
              isFeatured: true,
              occasions: true,
              ratingAvg: true,
              reviewCount: true,
              defaultGstRatePercent: true,
              imageUrls: true,
              explicitAttributes: true,
              wholesalePrice: true,
              mrpPrice: true,
              price: true,
              variants: true,
              createdAt: true,
            },
          },
          franchise: true,
          reviewedBy: { select: { id: true, email: true, role: true } },
          deliveries: {
            ...(q.deliveryStatus ? { where: { status: q.deliveryStatus } } : {}),
            orderBy: { createdAt: 'asc' },
          },
          variant: {
            select: {
              id: true,
              attributeSummary: true,
            },
          },
        },
      })
      : [];

    const mappedBundleRequests = allBundleRequests.map((item) =>
      this.responseMapper(item)
    );

    // Get all BUNDLE stock requests' bundleIds to fetch StarterBundles
    const bundleIds = Array.from(
      new Set(
        mappedData
          .filter((item) => item.type === 'BUNDLE')
          .map((item) => {
            const delivery = item.deliveries?.[0];
            const asn = delivery?.asnPayload as any;
            return (
              asn?.bundleId ||
              item.bundleAssignments?.[0]?.bundleId ||
              item.bundleAssignments?.[0]?.bundle?.id
            );
          })
          .filter(Boolean) as string[]
      )
    );

    const bundles = bundleIds.length > 0
      ? await this.prisma.starterBundle.findMany({
        where: { id: { in: bundleIds } },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      })
      : [];

    const bundleMap = new Map<string, any>(bundles.map((b: any) => [b.id, b]));

    const groupedData: any[] = [];
    const bundleGroupMap = new Map<string, any>(); // key: franchiseId + "_" + bundleId

    for (const item of mappedData) {
      if (item.type !== 'BUNDLE') {
        groupedData.push(item);
        continue;
      }

      const delivery = item.deliveries?.[0];
      const asn = delivery?.asnPayload as any;
      const bundleId =
        asn?.bundleId ||
        item.bundleAssignments?.[0]?.bundleId ||
        item.bundleAssignments?.[0]?.bundle?.id;

      if (!bundleId) {
        groupedData.push(item);
        continue;
      }

      const groupKey = `${item.franchise?.id ?? ''}_${bundleId}`;
      if (!bundleGroupMap.has(groupKey)) {
        const matchingRequests = mappedBundleRequests.filter((req) => {
          const reqDelivery = req.deliveries?.[0];
          const reqAsn = reqDelivery?.asnPayload as any;
          const reqBundleId =
            reqAsn?.bundleId ||
            req.bundleAssignments?.[0]?.bundleId ||
            req.bundleAssignments?.[0]?.bundle?.id;
          return (
            req.franchise?.id === item.franchise?.id &&
            reqBundleId === bundleId
          );
        });

        const sumDecimalStrings = (arr: any[], key: string): string | null => {
          let hasValue = false;
          const total = arr.reduce((sum, item) => {
            const val = item[key];
            if (val !== null && val !== undefined) {
              hasValue = true;
              return sum + Number(val);
            }
            return sum;
          }, 0);
          return hasValue ? total.toFixed(2) : null;
        };

        const sumIntegers = (arr: any[], key: string): number | null => {
          let hasValue = false;
          const total = arr.reduce((sum, item) => {
            const val = item[key];
            if (val !== null && val !== undefined) {
              hasValue = true;
              return sum + Number(val);
            }
            return sum;
          }, 0);
          return hasValue ? total : null;
        };

        const firstReq = matchingRequests[0] || item;

        const groupObj = {
          id: firstReq.id,
          quantity: matchingRequests.reduce((sum, r) => sum + r.quantity, 0),
          type: firstReq.type,
          status: firstReq.status,
          note: firstReq.note,
          paymentMode: firstReq.paymentMode,
          creditDuration: firstReq.creditDuration,
          franchise: firstReq.franchise,
          reviewedBy: firstReq.reviewedBy,
          deliveries: matchingRequests.flatMap((r) => r.deliveries || []),
          paymentStatus: firstReq.paymentStatus,
          paymentReceivedAt: firstReq.paymentReceivedAt,
          paymentReference: firstReq.paymentReference,
          paymentNote: firstReq.paymentNote,
          createdAt: firstReq.createdAt,
          updatedAt: firstReq.updatedAt,
          items: matchingRequests.map((r) => ({
            id: r.id,
            productId: r.product?.id || null,
            variantId: r.variant?.id || null,
            quantity: r.quantity,
            productName: r.productName || r.product?.name || null,
            variantName: r.variantName || null,
            product: r.product,
            approvedQuantity: r.approvedQuantity,
            unitPriceAtApproval: r.unitPriceAtApproval,
            gstRatePercent: r.gstRatePercent,
            billingSubtotal: r.billingSubtotal,
            billingTax: r.billingTax,
            billingTotal: r.billingTotal,
          })),
          comingSoon: [] as any[],
          approvedQuantity: sumIntegers(matchingRequests, 'approvedQuantity'),
          unitPriceAtApproval: firstReq.unitPriceAtApproval,
          gstRatePercent: firstReq.gstRatePercent,
          billingSubtotal: sumDecimalStrings(matchingRequests, 'billingSubtotal'),
          billingTax: sumDecimalStrings(matchingRequests, 'billingTax'),
          billingTotal: sumDecimalStrings(matchingRequests, 'billingTotal'),
          totalWholeSalePrice: sumDecimalStrings(matchingRequests, 'billingSubtotal'),
        };

        bundleGroupMap.set(groupKey, groupObj);
        groupedData.push(groupObj);
      }
    }

    // Now populate comingSoon for each bundle group
    for (const [groupKey, groupObj] of bundleGroupMap.entries()) {
      const bundleId = groupKey.split('_')[1];
      const bundle = bundleMap.get(bundleId);
      if (bundle) {
        for (const bundleItem of bundle.items) {
          const isProvisioned = groupObj.items.some(
            (pi: any) =>
              pi.productId === bundleItem.productId &&
              pi.variantId === (bundleItem.variantId || null)
          );
          if (!isProvisioned) {
            groupObj.comingSoon.push({
              productId: bundleItem.productId,
              variantId: bundleItem.variantId || null,
              quantity: bundleItem.quantity,
              productName: bundleItem.product?.name || null,
              variantName: bundleItem.variant?.attributeSummary
                ? bundleItem.variant.attributeSummary.toUpperCase()
                : null,
            });
          }
        }
      }
    }

    const payload = {
      data: groupedData,
      meta: result.meta,
    };

    // await this.redisService.set(cacheKey, payload);

    return payload;
  }

  async findOne(id: string, user: JwtUser) {
    const where: any = { id };
    if (user.role === Role.FRANCHISE_STAFF) {
      where.franchiseId = user.franchiseOwnerId;
    } else if (franchiseHasReadAccess(user.role)) {
      where.franchiseId = user.franchiseId;
    }

    const item = await this.prisma.stockRequest.findUnique({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            stock: true,
            gstTax: true,
            features: true,
            status: true,
            visibility: true,
            category: { select: { id: true, name: true } },
            brandRef: { select: { id: true, name: true, description: true } },
            fastDelivery: true,
            isFeatured: true,
            occasions: true,
            ratingAvg: true,
            reviewCount: true,
            defaultGstRatePercent: true,
            imageUrls: true,
            explicitAttributes: true,
            wholesalePrice: true,
            mrpPrice: true,
            price: true,
            variants: true,
            createdAt: true,
          },
        },
        franchise: true,
        reviewedBy: { select: { id: true, email: true, role: true } },
        deliveries: {
          orderBy: { createdAt: 'asc' },
        },
        variant: {
          select: {
            id: true,
            attributeSummary: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Stock request not found');
    }

    const mappedItem = this.responseMapper(item);

    if (mappedItem.type !== 'BUNDLE') {
      return mappedItem;
    }

    const delivery = mappedItem.deliveries?.[0];
    const asn = delivery?.asnPayload as any;
    const bundleId = asn?.bundleId;

    if (!bundleId) {
      return mappedItem;
    }

    // Query all BUNDLE stock requests for this franchise to find ones matching same bundleId in memory
    const allRequests = await this.prisma.stockRequest.findMany({
      where: {
        franchiseId: item.franchiseId,
        type: 'BUNDLE',
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            stock: true,
            gstTax: true,
            features: true,
            status: true,
            visibility: true,
            category: { select: { id: true, name: true } },
            brandRef: { select: { id: true, name: true, description: true } },
            fastDelivery: true,
            isFeatured: true,
            occasions: true,
            ratingAvg: true,
            reviewCount: true,
            defaultGstRatePercent: true,
            imageUrls: true,
            explicitAttributes: true,
            wholesalePrice: true,
            mrpPrice: true,
            price: true,
            variants: true,
            createdAt: true,
          },
        },
        franchise: true,
        reviewedBy: { select: { id: true, email: true, role: true } },
        deliveries: {
          orderBy: { createdAt: 'asc' },
        },
        variant: {
          select: {
            id: true,
            attributeSummary: true,
          },
        },
      },
    });

    const sameBundleMapped = allRequests
      .filter((req) => {
        const del = req.deliveries?.[0];
        const asnPayload = del?.asnPayload as any;
        return asnPayload?.bundleId === bundleId;
      })
      .map((req) => this.responseMapper(req));

    const bundle = await this.prisma.starterBundle.findUnique({
      where: { id: bundleId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    // Grouping
    const firstReq = sameBundleMapped[0];
    const groupObj = {
      id: firstReq.id,
      quantity: sameBundleMapped.reduce((sum, r) => sum + r.quantity, 0),
      type: firstReq.type,
      status: firstReq.status,
      note: firstReq.note,
      paymentMode: firstReq.paymentMode,
      creditDuration: firstReq.creditDuration,
      franchise: firstReq.franchise,
      reviewedBy: firstReq.reviewedBy,
      deliveries: sameBundleMapped.flatMap((r) => r.deliveries || []),
      paymentStatus: firstReq.paymentStatus,
      paymentReceivedAt: firstReq.paymentReceivedAt,
      paymentReference: firstReq.paymentReference,
      paymentNote: firstReq.paymentNote,
      createdAt: firstReq.createdAt,
      updatedAt: firstReq.updatedAt,
      items: sameBundleMapped.map((r) => ({
        id: r.id,
        productId: r.product?.id || null,
        variantId: r.variant?.id || null,
        quantity: r.quantity,
        productName: r.productName || r.product?.name || null,
        variantName: r.variantName || null,
        product: r.product,
      })),
      comingSoon: [] as any[],
    };

    if (bundle) {
      for (const bundleItem of bundle.items) {
        const isProvisioned = groupObj.items.some(
          (pi: any) =>
            pi.productId === bundleItem.productId &&
            pi.variantId === (bundleItem.variantId || null)
        );
        if (!isProvisioned) {
          groupObj.comingSoon.push({
            productId: bundleItem.productId,
            variantId: bundleItem.variantId || null,
            quantity: bundleItem.quantity,
            productName: bundleItem.product?.name || null,
            variantName: bundleItem.variant?.attributeSummary
              ? bundleItem.variant.attributeSummary.toUpperCase()
              : null,
          });
        }
      }
    }

    return groupObj;
  }

  async list(user: JwtUser, query: StockRequestQueryDto) {
    if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF) {
      const where = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.deliveryStatus
          ? {
            deliveries: {
              some: {
                status: query.deliveryStatus,
              },
            },
            paymentStatus: StockRequestPaymentStatus.PAID,
          }
          : {}),
      };

      return this.prisma.stockRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          product: true,
          franchise: true,
          reviewedBy: { select: { id: true, email: true, role: true } },
          deliveries: {
            ...(query.deliveryStatus
              ? { where: { status: query.deliveryStatus } }
              : {}),
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    if (franchiseHasReadAccess(user.role)) {
      const franchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      if (!franchiseId) return [];
      return this.prisma.stockRequest.findMany({
        where: {
          franchiseId,
          ...(query.status ? { status: query.status } : {}),
          ...(query.deliveryStatus
            ? {
              deliveries: {
                some: {
                  status: query.deliveryStatus,
                },
              },
              paymentStatus: StockRequestPaymentStatus.PAID,
            }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          reviewedBy: { select: { id: true, email: true, role: true } },
          deliveries: {
            ...(query.deliveryStatus
              ? { where: { status: query.deliveryStatus } }
              : {}),
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }
    return [];
  }

  private async notifyStockRequestApprovalOrReject(reqData: {
    stockRequestId: string;
    userId: string;
    franchiseId: string;
    ownerName: string;
    code: string;
    ownerEmail: string;
    businessName: string;
    businessEmail: string;
    totalStock: number;
    requestedQuantity?: number;
    approvedQuantity?: number;
    variantId?: string | null;
    productName?: string;
    reason?: string; // For rejection case
  }) {
    const {
      userId,
      franchiseId,
      stockRequestId,
      code: franchiseCode,
      ownerName: franchiseName,
      businessName,
      businessEmail,
      totalStock,
      requestedQuantity = totalStock,
      approvedQuantity = totalStock,
      variantId,
      productName = 'Product',
      reason,
    } = reqData;
    // console.log(
    //   `Notifying Franchise about approval stock request: FranchiseID: ${franchiseId}, Code: (${franchiseCode}), Requested: ${requestedQuantity}, Approved: ${approvedQuantity}${variantId ? `, Variant: ${variantId}` : ''}`,
    // );
    try {
      const title = reqData.reason
        ? 'Your Stock Request has been rejected'
        : 'Your Stock Request has been Approved';
      const variantInfo = variantId ? ` (Variant: ${variantId})` : '';
      const quantityInfo =
        requestedQuantity === approvedQuantity
          ? `${approvedQuantity} units`
          : `${approvedQuantity} out of ${requestedQuantity} units requested`;
      const body = reqData.reason
        ? `Your stock request for ${productName}${variantInfo} has been rejected by HQ for franchise ${franchiseName} (${franchiseCode}). Reason: ${reqData.reason}`
        : `Your stock request for ${productName}${variantInfo} has been approved by HQ for franchise ${franchiseName} (${franchiseCode}) with ${quantityInfo}. Please await further instructions regarding payment and delivery.`;

      const recipientEmail = reqData.ownerEmail || businessEmail;
      const isApproval = !reason;
      let attachment: Array<{ content: string; name: string }> | undefined = undefined;

      // No invoice attachment for approval notifications

      const html = recipientEmail && recipientEmail !== 'N/A'
        ? StockRequestStatusTemplate.build({
            stockRequestId,
            franchiseCode,
            businessName,
            ownerName: reqData.ownerName,
            productName,
            variantInfo,
            quantityInfo,
            isApproval,
            body,
            reason: reason || undefined,
          })
        : undefined;


      // Queue notification for processing (DB in-app + Email delivery via BullMQ)
      await this.notificationQueue.add({
        userId,
        title,
        body,
        type: NotificationType.FRANCHISE_STOCK_REQUEST,
        metadata: {
          stockRequestId,
          franchiseId,
          franchiseName,
          franchiseCode,
          businessName,
          businessEmail,
          requestedQuantity,
          approvedQuantity,
          variantId: variantId || undefined,
          productName,
          ...(reason ? { reason } : {}),
          recipientEmail: recipientEmail !== 'N/A' ? recipientEmail : undefined,
          htmlContent: html,
          attachment,
        },
      });
    } catch (error: any) {
      console.error(
        `Failed to notify SuperAdmins about new franchise: ${error.message}`,
      );
      // Non-critical operation, don't throw
    }
  }

  async approve(
    id: string,
    reviewer: JwtUser,
    ip?: string | null,
    approvedQty?: number,
  ) {
    if (reviewer.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }

    // Fetch request data outside transaction to avoid timeout
    const req = await this.prisma.stockRequest.findUnique({
      where: { id },
      include: {
        product: {
          include: { variants: { orderBy: { createdAt: 'asc' } } },
        },
        variant: true,
      },
    });

    if (!req) {
      throw new NotFoundException('Request not found');
    }

    if (req.status === StockRequestStatus.APPROVED) {
      throw new BadRequestException('Request is already approved');
    }

    if (req.status !== StockRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    let shipQty = req.quantity;
    if (approvedQty != null) {
      if (approvedQty < 1 || approvedQty > req.quantity) {
        throw new BadRequestException(
          'Approved quantity must be between 1 and requested quantity',
        );
      }
      shipQty = approvedQty;
    }

    // Use the specific variant if stock request is for a variant, otherwise use first variant
    let targetVariant: typeof req.variant | null = req.variant;

    if (req.variantId) {
      targetVariant =
        req.product.variants.find((variant) => variant.id === req.variantId) ??
        null;

      if (!targetVariant) {
        throw new BadRequestException(
          `Variant ${req.variantId} not found for product ${req.productId}`,
        );
      }
    } else if (!targetVariant && req.product.variants.length > 0) {
      targetVariant = req.product.variants[0];
    }

    const unitPrice = targetVariant
      ? (targetVariant.wholesalePrice ?? targetVariant.price)
      : (req.product.wholesalePrice ?? req.product.price);
    const gstRate = targetVariant
      ? new Prisma.Decimal(targetVariant.gstTax ?? 0)
      : req.product.defaultGstRatePercent;

    // Pre-calculate billing values outside transaction
    const billingSubtotal = unitPrice.mul(new Prisma.Decimal(shipQty));
    const billingTax = unitPrice
      .mul(new Prisma.Decimal(shipQty))
      .mul(gstRate)
      .div(new Prisma.Decimal(100));
    const billingTotal = unitPrice
      .mul(new Prisma.Decimal(shipQty))
      .mul(new Prisma.Decimal(100).add(gstRate))
      .div(new Prisma.Decimal(100));

    // Now run the transaction with only write operations
    const updated = await this.prisma.$transaction(
      async (tx) => {
        await this.reserveCentralForStockRequest(tx, {
          stockRequestId: req.id,
          productId: req.productId,
          variantId: req.variantId,
          quantity: shipQty,
        });

        const row = await tx.stockRequest.update({
          where: { id },
          data: {
            status: StockRequestStatus.APPROVED,
            approvedQuantity: shipQty,
            reviewedById: reviewer.sub,
            reviewedAt: new Date(),
            unitPriceAtApproval: unitPrice,
            gstRatePercent: gstRate,
            billingSubtotal,
            billingTax,
            billingTotal,
            paymentStatus: StockRequestPaymentStatus.UNPAID,
          },
          include: { product: true, variant: true, franchise: true },
        });

        await tx.inboundDelivery.create({
          data: {
            franchiseId: req.franchiseId,
            stockRequestId: req.id,
            /// Held until HQ records payment; then released to IN_TRANSIT (see updatePayment).
            status: DeliveryStatus.SCHEDULED,
            stockApplied: false,
            carrier: 'Central warehouse',
            trackingCode: `WH-${req.id.slice(-6).toUpperCase()}`,
          },
        });

        return row;
      },
      { timeout: 15000 }, // Increase timeout to 15 seconds for safety
    );

    // Fetch franchise owner for notification
    const ownerUser = await this.findFranchiseOwnerUser(
      updated.franchiseId,
      updated.franchise.ownerEmail,
    );
    const ownerUserId = ownerUser?.id;
    if (!ownerUserId) {
      console.warn(
        `Warning: Could not find owner user for franchise ${updated.franchiseId} when approving stock request ${id}`,
      );
    }

    fireAndForget(
      this.audit.log({
        userId: reviewer.sub,
        action: 'stock_request_approve.update',
        resource: 'StockRequest',
        resourceId: id,
        metadata: {
          franchiseId: updated.franchiseId,
          productId: updated.productId,
          variantId: updated.variant?.id || undefined,
          requestedQuantity: updated.quantity,
          approvedQuantity: updated.approvedQuantity,
        },
        ip,
      }),
      'stock_request_approve.update',
    );
    void this.webhooks.queueEvent('stock_request.approved', {
      id: updated.id,
      franchiseId: updated.franchiseId,
      productId: updated.productId,
      variantId: updated.variant?.id || undefined,
      status: updated.status,
      approvedQuantity: updated.approvedQuantity?.toString() ?? null,
    });
    void this.stockingNodeIdForFranchise(updated.franchiseId).then(
      (stockingNodeId) =>
        this.domainEvents.emit(
          'inventory.stock_request.approved',
          {
            stockRequestId: updated.id,
            franchiseId: updated.franchiseId,
            productId: updated.productId,
            variantId: updated.variant?.id || undefined,
            approvedQuantity: updated.approvedQuantity,
          },
          {
            refType: 'STOCK_REQUEST',
            refId: updated.id,
            productId: updated.productId,
            variantId: updated.variant?.id || undefined,
            quantityDelta: -(updated.approvedQuantity ?? 0),
            stockingNodeId,
          },
        ),
    );

    if (ownerUserId) {
      void this.notifyStockRequestApprovalOrReject({
        stockRequestId: updated.id,
        userId: ownerUserId,
        franchiseId: updated.franchiseId,
        ownerName:
          updated.franchise.ownerFullName || updated.franchise.name || 'N/A',
        code: updated.franchise.code,
        businessName:
          updated.franchise.businessName || updated.franchise.name || 'N/A',
        businessEmail:
          updated.franchise.ownerEmail || ownerUser?.email || 'N/A',
        ownerEmail: updated.franchise.ownerEmail || ownerUser?.email || 'N/A',
        totalStock: shipQty,
        requestedQuantity: updated.quantity,
        approvedQuantity: updated.approvedQuantity ?? undefined,
        variantId: updated.variant?.id || null,
        productName: updated.product.name,
      });
    }

    return {
      success: true,
      message: 'Stock request approved successfully',
      data: updated,
      stats: {
        requestedQuantity: updated.quantity,
        approvedQuantity: updated.approvedQuantity,
        requestId: updated.id,
        status: updated.status,
        variantId: updated.variant?.id || null,
      },
    };
  }

  async bulkApprove(ids: string[], reviewer: JwtUser, ip?: string | null) {
    const results: Array<{
      id: string;
      success: boolean;
      message?: string;
      data?: any;
      error?: string;
    }> = [];

    for (const id of ids) {
      try {
        const result = await this.approve(id, reviewer, ip);
        results.push({
          id,
          success: true,
          message: result.message,
          data: result.data,
        });
        console.log(
          `✓ Stock request ${id} approved successfully - Qty: ${result.stats?.approvedQuantity}`,
        );
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error.message || 'Unknown error occurred',
        });
        console.error(
          `✗ Failed to approve stock request ${id}: ${error.message}`,
        );
      }
    }

    const approved = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `Bulk approval completed: ${approved} approved, ${failed} failed out of ${ids.length} requests`,
    );

    return {
      summary: {
        total: ids.length,
        approved,
        failed,
        successRate: `${((approved / ids.length) * 100).toFixed(2)}%`,
      },
      results,
    };
  }

  async reject(
    id: string,
    reason: string,
    reviewer: JwtUser,
    ip?: string | null,
  ) {
    if (reviewer.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }
    const req = await this.prisma.stockRequest.findUnique({ where: { id } });
    if (!req) {
      throw new NotFoundException('Request not found');
    }

    if (req.status === StockRequestStatus.REJECTED) {
      throw new BadRequestException('Request is already rejected');
    }

    if (req.status !== StockRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    const updated = await this.prisma.stockRequest.update({
      where: { id },
      data: {
        status: StockRequestStatus.REJECTED,
        reviewedById: reviewer.sub,
        reviewedAt: new Date(),
        rejectReason: reason,
      },
      include: { product: true, variant: true, franchise: true },
    });
    fireAndForget(
      this.audit.log({
        userId: reviewer.sub,
        action: 'stock_request_reject.update',
        resource: 'StockRequest',
        resourceId: id,
        metadata: { reason },
        ip,
      }),
      'stock_request_reject.update',
    );
    void this.webhooks.queueEvent('stock_request.rejected', {
      id: updated.id,
      franchiseId: updated.franchiseId,
      productId: updated.productId,
      reason,
    });
    void this.stockingNodeIdForFranchise(updated.franchiseId).then(
      (stockingNodeId) =>
        this.domainEvents.emit(
          'inventory.stock_request.rejected',
          {
            stockRequestId: updated.id,
            franchiseId: updated.franchiseId,
            productId: updated.productId,
            reason,
          },
          {
            refType: 'STOCK_REQUEST',
            refId: updated.id,
            productId: updated.productId,
            stockingNodeId,
          },
        ),
    );

    const ownerUser = await this.findFranchiseOwnerUser(
      updated.franchiseId,
      updated.franchise.ownerEmail,
    );
    const ownerUserId = ownerUser?.id;

    console.log(
      `Owner: ${ownerUserId}, Stock request ${id} rejected by ${reviewer.email} for franchise ${updated.franchise.name} (${updated.franchise.code}). Reason: ${reason}`,
    );
    if (ownerUserId) {
      await this.notifyStockRequestApprovalOrReject({
        stockRequestId: updated.id,
        userId: ownerUserId,
        franchiseId: updated.franchiseId,
        ownerName:
          updated.franchise.ownerFullName || updated.franchise.name || 'N/A',
        code: updated.franchise.code,
        businessName:
          updated.franchise.businessName || updated.franchise.name || 'N/A',
        businessEmail:
          updated.franchise.ownerEmail || ownerUser?.email || 'N/A',
        ownerEmail: updated.franchise.ownerEmail || ownerUser?.email || 'N/A',
        totalStock: updated.quantity,
        requestedQuantity: updated.quantity,
        variantId: updated.variant?.id || null,
        productName: updated.product.name,
        reason,
      });
    }

    return updated;
  }

  async cancel(id: string, reason: string, user: JwtUser, ip?: string) {
    const isSuperAdmin =
      user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF;
    if (!isSuperAdmin && !franchiseCanMutate(user.role)) {
      throw new ForbiddenException();
    }
    const franchiseId = isSuperAdmin
      ? undefined
      : user.role === Role.FRANCHISE_STAFF
        ? user.franchiseOwnerId
        : user.franchiseId;

    if (!isSuperAdmin && !franchiseId) {
      throw new BadRequestException('No franchise linked');
    }
    const req = await this.prisma.stockRequest.findUnique({
      where: { id },
      include: { deliveries: true },
    });
    if (!req || (!isSuperAdmin && req.franchiseId !== franchiseId)) {
      throw new NotFoundException('Request not found');
    }

    if (req.status === StockRequestStatus.CANCELLED) {
      throw new BadRequestException('Request is already cancelled');
    }

    if (req.status === StockRequestStatus.REJECTED) {
      throw new BadRequestException('Request is already rejected');
    }

    const hasDelivered = req.deliveries.some(
      (d) => d.status === DeliveryStatus.DELIVERED,
    );
    if (hasDelivered) {
      throw new BadRequestException('Delivered requests cannot be cancelled');
    }

    if (
      req.status !== StockRequestStatus.PENDING &&
      req.status !== StockRequestStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Only pending or approved requests before delivery can be cancelled',
      );
    }

    if (req.paymentStatus === StockRequestPaymentStatus.PAID) {
      throw new BadRequestException('Paid requests cannot be cancelled');
    }

    const targetFranchiseId = req.franchiseId;
    const cancelQty = req.approvedQuantity ?? req.quantity;

    const cancelled = await this.prisma.$transaction(async (tx) => {
      // 1. Cancel any open deliveries (SCHEDULED or IN_TRANSIT)
      await tx.inboundDelivery.updateMany({
        where: {
          stockRequestId: id,
          status: { in: [DeliveryStatus.SCHEDULED, DeliveryStatus.IN_TRANSIT] },
        },
        data: { status: DeliveryStatus.CANCELLED },
      });

      // 2. If request was APPROVED, release reservation / restore catalog stock
      if (req.status === StockRequestStatus.APPROVED) {
        const activeRes = await tx.inventoryReservation.findFirst({
          where: {
            stockRequestId: id,
            kind: InventoryReservationKind.CENTRAL_STOCK_REQUEST,
            status: InventoryReservationStatus.ACTIVE,
          },
        });

        if (activeRes) {
          await tx.inventoryReservation.update({
            where: { id: activeRes.id },
            data: {
              status: InventoryReservationStatus.RELEASED,
              note: 'Released on stock request cancellation',
            },
          });

          // Decrement reserved central stock
          const ws = await tx.warehouseStock.findUnique({
            where: { productId: req.productId },
          });
          if (ws && ws.reserved > 0) {
            await tx.warehouseStock.update({
              where: { productId: req.productId },
              data: {
                reserved: {
                  decrement: Math.min(ws.reserved, cancelQty),
                },
              },
            });
          }

          // Restore product stock and variant stock (which was decremented during approval)
          await tx.product.update({
            where: { id: req.productId },
            data: { stock: { increment: cancelQty } },
          });
          if (req.variantId) {
            await tx.productVariant.update({
              where: { id: req.variantId },
              data: { stock: { increment: cancelQty } },
            });
          }
        } else {
          const consumedRes = await tx.inventoryReservation.findFirst({
            where: {
              stockRequestId: id,
              kind: InventoryReservationKind.CENTRAL_STOCK_REQUEST,
              status: InventoryReservationStatus.CONSUMED,
            },
          });

          if (consumedRes) {
            await tx.inventoryReservation.update({
              where: { id: consumedRes.id },
              data: {
                note: 'Restored on stock request cancellation during transit',
              },
            });

            // Restore central warehouse stock (deducted when consumed)
            const ws = await tx.warehouseStock.findUnique({
              where: { productId: req.productId },
            });
            if (ws) {
              await tx.warehouseStock.update({
                where: { productId: req.productId },
                data: { quantity: { increment: cancelQty } },
              });
            }

            // Restore product stock and variant stock
            await tx.product.update({
              where: { id: req.productId },
              data: { stock: { increment: cancelQty } },
            });
            if (req.variantId) {
              await tx.productVariant.update({
                where: { id: req.variantId },
                data: { stock: { increment: cancelQty } },
              });
            }
          }
        }
      }

      // 3. Mark stock request as CANCELLED
      return tx.stockRequest.update({
        where: { id },
        data: { status: StockRequestStatus.CANCELLED },
        include: { product: true, franchise: true },
      });
    });

    fireAndForget(
      this.redisService.del([`product:${req.productId}`]),
      'cache_invalidate',
    );

    const nodeId = await this.stockingNodeIdForFranchise(cancelled.franchiseId);
    void this.domainEvents.emit(
      'inventory.stock_request.cancelled',
      {
        stockRequestId: cancelled.id,
        franchiseId: cancelled.franchiseId,
        productId: cancelled.productId,
      },
      {
        refType: 'STOCK_REQUEST',
        refId: cancelled.id,
        productId: cancelled.productId,
        stockingNodeId: nodeId,
      },
    );

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'stock_request_cancel.update',
        resource: 'StockRequest',
        resourceId: id,
        metadata: {
          role: user.role,
          from: {
            status: req.status,
          },
          to: {
            status: cancelled.status,
            reason: cancelled.rejectReason,
          },
        },
        ip,
      }),
      'stock_request_reject.update',
    );

    await this.notifyNewOrCancelStockRequest({
      stockRequestId: cancelled.id,
      franchiseId: targetFranchiseId,
      ownerName: cancelled.franchise.ownerFullName || cancelled.franchise.name,
      code: cancelled.franchise.code,
      businessName:
        cancelled.franchise.businessName || cancelled.franchise.name,
      businessEmail: cancelled.franchise.ownerEmail || user.email,
      ownerEmail: cancelled.franchise.ownerEmail || user.email,
      totalStock: cancelled.quantity,
      phone: cancelled.franchise.ownerPhone ?? 'N/A',
      ...(reason ? { reason } : {}),
    });

    return cancelled;
  }

  async updatePayment(
    id: string,
    dto: {
      paymentStatus: StockRequestPaymentStatus;
      paymentReference?: string;
      paymentNote?: string;
      paymentReceivedAt?: string;
    },
    reviewer: JwtUser,
  ) {
    if (reviewer.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }
    const req = (await this.prisma.stockRequest.findUnique({
      where: { id },
    })) as any;
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== StockRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved requests can be updated for payment',
      );
    }
    const now = new Date();
    const isAlreadyPaid =
      req.isFullyPaid ||
      req.paymentStatus === StockRequestPaymentStatus.PAID ||
      req.paymentStatus === StockRequestPaymentStatus.WAIVED;

    const resolvedStatus =
      isAlreadyPaid ||
        dto.paymentStatus === StockRequestPaymentStatus.PAID ||
        dto.paymentStatus === StockRequestPaymentStatus.WAIVED
        ? dto.paymentStatus === StockRequestPaymentStatus.WAIVED
          ? StockRequestPaymentStatus.WAIVED
          : StockRequestPaymentStatus.PAID
        : dto.paymentStatus || req.paymentStatus;

    const paymentReceivedAt =
      dto.paymentReceivedAt != null
        ? new Date(dto.paymentReceivedAt)
        : req.paymentReceivedAt ||
        (resolvedStatus === StockRequestPaymentStatus.PAID ||
          resolvedStatus === StockRequestPaymentStatus.WAIVED
          ? now
          : null);

    const out = await this.prisma.$transaction(
      async (tx) => {
        const updatedReq = await tx.stockRequest.update({
          where: { id },
          data: {
            paymentStatus: resolvedStatus,
            paymentReference: dto.paymentReference?.trim() || null,
            paymentNote: dto.paymentNote?.trim() || null,
            paymentReceivedAt,
          },
        });
        const releaseDispatch =
          resolvedStatus === StockRequestPaymentStatus.PAID ||
          resolvedStatus === StockRequestPaymentStatus.WAIVED;
        if (releaseDispatch) {
          await tx.invoice.updateMany({
            where: {
              stockRequestId: id,
              isDeleted: false,
            },
            data: {
              paymentStatus: InvoicePaymentStatus.PAID,
              paymentReferenceId: dto.paymentReference,
            },
          });
          const scheduled = await tx.inboundDelivery.findMany({
            where: { stockRequestId: id, status: DeliveryStatus.SCHEDULED },
            select: { id: true },
          });
          if (scheduled.length > 0 && updatedReq.type !== StockRequestType.BUNDLE) {
            const qty = updatedReq.approvedQuantity ?? updatedReq.quantity;
            await this.consumeCentralReservationForStockRequest(tx, {
              stockRequestId: id,
              productId: updatedReq.productId,
              variantId: req.variantId || undefined,
              quantity: qty,
            });
            // catalog stock (product/variant) is handled inside consumeCentralReservationForStockRequest
            await tx.inboundDelivery.updateMany({
              where: { stockRequestId: id, status: DeliveryStatus.SCHEDULED },
              data: { status: DeliveryStatus.IN_TRANSIT, dispatchedAt: now },
            });
          }
        }
        return tx.stockRequest.findUniqueOrThrow({
          where: { id },
          include: {
            product: true,
            variant: true,
            franchise: true,
            deliveries: { orderBy: { createdAt: 'asc' } },
          },
        });
      },
      { timeout: 15000 }, // Allow payment release to finish without expiring the transaction
    );
    void this.stockingNodeIdForFranchise(out.franchiseId).then(
      (stockingNodeId) =>
        this.domainEvents.emit(
          'inventory.stock_request.payment_updated',
          {
            stockRequestId: out.id,
            franchiseId: out.franchiseId,
            paymentStatus: out.paymentStatus,
          },
          {
            refType: 'STOCK_REQUEST',
            refId: out.id,
            productId: out.productId,
            variantId: out.variant?.id || undefined,
            stockingNodeId,
          },
        ),
    );
    return out;
  }

  private async releaseScheduledDeliveries(
    tx: Prisma.TransactionClient,
    updatedReq: any,
    now: Date,
  ) {
    if (updatedReq.type === StockRequestType.BUNDLE) {
      return;
    }
    const scheduled = await tx.inboundDelivery.findMany({
      where: {
        stockRequestId: updatedReq.id,
        status: DeliveryStatus.SCHEDULED,
      },
      select: {
        id: true,
      },
    });

    if (scheduled.length <= 0) {
      return;
    }

    const qty = updatedReq.approvedQuantity ?? updatedReq.quantity;

    await this.consumeCentralReservationForStockRequest(tx, {
      stockRequestId: updatedReq.id,
      productId: updatedReq.productId,
      variantId: updatedReq.variantId || undefined,
      quantity: qty,
    });

    await tx.inboundDelivery.updateMany({
      where: {
        stockRequestId: updatedReq.id,
        status: DeliveryStatus.SCHEDULED,
      },
      data: {
        status: DeliveryStatus.IN_TRANSIT,
        dispatchedAt: now,
      },
    });
  }

  private async notifyStockRequestPayment(reqData: {
    stockRequestId: string;
    userId: string;
    franchiseId: string;
    ownerName: string;
    code: string;
    ownerEmail: string;
    businessName: string;
    businessEmail: string;

    totalAmount: number;

    cashAmount?: number;
    deductedAmount: number; // advance + credit deduction
    remainingAmount: number;

    paymentStatus: string;
    paymentMethod?: string;
    paymentReference?: string;
    reason?: string;
  }) {
    const {
      userId,
      franchiseId,
      stockRequestId,
      code: franchiseCode,
      ownerName,
      businessName,
      totalAmount,

      cashAmount = 0,
      deductedAmount,
      remainingAmount,

      paymentStatus,
      paymentMethod = 'Cash + Credit Account',
      paymentReference,
      reason,
    } = reqData;

    try {
      const title = 'Stock Request Payment Updated';

      const statusLabel =
        paymentStatus === StockRequestPaymentStatus.PAID
          ? '✓ Fully Paid'
          : paymentStatus === StockRequestPaymentStatus.WAIVED
            ? '✓ Waived'
            : 'Partial Payment';

      const body = `
Payment processed successfully.

Stock Request: ${stockRequestId}

• Total Amount: ₹${totalAmount.toFixed(2)}
• Cash Paid: ₹${cashAmount.toFixed(2)}
• Credit Used: ₹${deductedAmount.toFixed(2)}
• Remaining: ₹${remainingAmount.toFixed(2)}
• Payment Method: ${paymentMethod}
${paymentReference ? `• Reference: ${paymentReference}` : ''}
${reason ? `• Reason: ${reason}` : ''}
• Status: ${statusLabel}
`;

      const html = StockRequestPaymentTemplate.build({
        stockRequestId,
        franchiseCode,
        businessName,
        ownerName,

        totalAmount,
        cashAmount,
        deductedAmount,
        remainingAmount,

        paymentStatus,
        paymentReference,
      });

      const recipientEmail = reqData.ownerEmail || reqData.businessEmail;
      const attachment = await this.getInvoicePdfAttachmentForStockRequest(stockRequestId);

      await this.notificationQueue.add({
        userId,
        title,
        body,
        type: NotificationType.FRANCHISE_STOCK_REQUEST,

        metadata: {
          recipientEmail,
          htmlContent: html,

          attachment,

          stockRequestId,
          franchiseId,
          franchiseCode,

          ownerName,
          businessName,

          totalAmount,
          cashAmount,
          deductedAmount,
          remainingAmount,

          paymentStatus,
          paymentMethod,
          paymentReference,

          transactionTime: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error(`Failed payment notification: ${error.message}`);
    }
  }

  async updatePayments(
    id: string,
    dto: UpdateStockRequestPaymentDto,
    reviewer: JwtUser,
  ) {
    if (reviewer.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }

    const stockReq = await this.prisma.stockRequest.findUnique({
      where: { id },
    });

    if (!stockReq) {
      throw new NotFoundException('Stock request not found');
    }

    if (stockReq.status !== StockRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved requests can be updated for payment',
      );
    }

    const now = new Date();

    const paymentReceivedAt =
      dto.paymentReceivedAt != null ? new Date(dto.paymentReceivedAt) : null;

    const out = await this.prisma.$transaction(
      async (tx) => {
        // Reload inside transaction
        const req = await tx.stockRequest.findUniqueOrThrow({
          where: { id },
        });

        const creditAccount = await tx.creditAccount.findFirst({
          where: {
            franchiseId: req.franchiseId,
            status: CreditAccountStatus.ACTIVE,
          },
        });

        if (!creditAccount) {
          throw new BadRequestException('No active credit account found');
        }

        const billingTotal = Number(req.billingTotal || 0);

        const alreadyPaid = Number(req.paidAmount || 0);

        const remainingBefore = billingTotal - alreadyPaid;

        if (remainingBefore <= 0) {
          throw new BadRequestException('Payment already completed');
        }

        // =============================
        // WAIVED
        // =============================

        if (dto.paymentStatus === StockRequestPaymentStatus.WAIVED) {
          const updatedReq = await tx.stockRequest.update({
            where: { id },
            data: {
              paymentStatus: StockRequestPaymentStatus.WAIVED,

              paidAmount: billingTotal,
              remainingAmount: 0,
              isFullyPaid: true,

              paymentReference:
                dto.paymentReference?.trim() ||
                `REF-${randomBytes(5).toString('hex')}-WAIVE`,

              paymentNote: dto.paymentNote?.trim() || null,

              paymentReceivedAt:
                paymentReceivedAt || req.paymentReceivedAt || now,
            },
          });

          await tx.invoice.updateMany({
            where: {
              stockRequestId: id,
              isDeleted: false,
            },
            data: {
              paymentStatus: InvoicePaymentStatus.PAID,
              paymentReferenceId: updatedReq.paymentReference || null,
            },
          });

          // *****UI_DEV() await this.releaseScheduledDeliveries(tx, updatedReq, now);

          return updatedReq;
        }

        // =============================
        // CASH + CREDIT FLOW
        // =============================

        // Cash received from franchise
        const cashAmount = Number(dto.amount || 0);

        if (cashAmount < 0) {
          throw new BadRequestException('Invalid payment amount');
        }

        if (cashAmount > remainingBefore) {
          throw new BadRequestException(
            `Cash amount cannot exceed remaining payable amount ₹${remainingBefore}`,
          );
        }

        const availableCredit = Number(creditAccount.availableCredit || 0);

        const advanceBalance = Number(creditAccount.advanceBalance || 0);

        // First deduct cash
        const remainingAfterCash = remainingBefore - cashAmount;

        let usedAdvance = 0;
        let usedCredit = 0;

        const isDurationBased =
          (dto.paymentMode === StockRequestPaymentMode.CREDIT &&
            dto.creditDuration != null) ||
          (req.paymentMode === StockRequestPaymentMode.CREDIT &&
            req.creditDuration != null) ||
          creditAccount.duration != null;

        if (isDurationBased) {
          // Duration-Based Orders:
          // Ignore availableCredit, totalCredit limit, usedCredit.
          // Only increase advanceBalance.
          usedAdvance = remainingAfterCash;

          if (usedAdvance > 0) {
            await tx.creditAccount.update({
              where: {
                id: creditAccount.id,
              },
              data: {
                advanceBalance: {
                  increment: usedAdvance,
                },
              },
            });

            await tx.creditTransaction.create({
              data: {
                accountId: creditAccount.id,
                franchiseId: req.franchiseId,
                type: CreditTransactionEnum.ORDER,
                direction: DirectionEnum.DEBIT,
                amount: usedAdvance,
                balanceBefore: Number(creditAccount.advanceBalance || 0),
                balanceAfter:
                  Number(creditAccount.advanceBalance || 0) + usedAdvance,
                description: `Duration-based credit used for stock request ${req.requestCode || req.id
                  }`,
                referenceId: req.id,
                referenceType: 'STOCK_REQUEST',
              },
            });
          }
        } else {
          // Credit-Based Orders: Must continue existing behavior (using available credit limit)
          if (remainingAfterCash > 0 && remainingAfterCash > availableCredit) {
            throw new BadRequestException(
              `You are exceeding your credit limit. Please add balance into Credit Account first.`,
            );
          }

          usedCredit = remainingAfterCash;

          if (usedCredit > 0) {
            await tx.creditAccount.update({
              where: {
                id: creditAccount.id,
              },
              data: {
                usedCredit: {
                  increment: usedCredit,
                },
                availableCredit: {
                  decrement: usedCredit,
                },
              },
            });

            await tx.creditTransaction.create({
              data: {
                accountId: creditAccount.id,
                franchiseId: req.franchiseId,
                type: CreditTransactionEnum.PAYMENT,
                direction: DirectionEnum.DEBIT,
                amount: usedCredit,
                balanceBefore: Number(creditAccount.usedCredit || 0),
                balanceAfter:
                  Number(creditAccount.usedCredit || 0) + usedCredit,
                description: `Credit used for stock request ${req.requestCode || req.id
                  }`,
                referenceId: req.id,
                referenceType: 'STOCK_REQUEST',
              },
            });
          }
        }

        // =============================
        // UPDATE STOCK REQUEST
        // =============================

        const totalPaidNow = cashAmount + usedAdvance + usedCredit;

        const newPaidAmount = alreadyPaid + totalPaidNow;

        const remainingAfter = billingTotal - newPaidAmount;

        const isFullyPaid = remainingAfter <= 0;

        const updatedReq = await tx.stockRequest.update({
          where: { id },
          data: {
            paidAmount: newPaidAmount,

            remainingAmount: Math.max(remainingAfter, 0),

            isFullyPaid,

            paymentStatus: isFullyPaid
              ? StockRequestPaymentStatus.PAID
              : StockRequestPaymentStatus.PARTIALLY_PAID,

            paymentMode:
              dto.paymentMode !== undefined ? dto.paymentMode : undefined,
            creditDuration:
              dto.creditDuration !== undefined ? dto.creditDuration : undefined,

            paymentReference: dto.paymentReference?.trim() || null,

            paymentNote: dto.paymentNote?.trim() || null,

            paymentReceivedAt:
              paymentReceivedAt ||
              req.paymentReceivedAt ||
              (isFullyPaid ||
                dto.paymentStatus === StockRequestPaymentStatus.PAID
                ? now
                : null),
          },
        });

        if (isFullyPaid) {
          await tx.invoice.updateMany({
            where: {
              stockRequestId: id,
              isDeleted: false,
            },
            data: {
              paymentStatus: InvoicePaymentStatus.PAID,
              paymentReferenceId: updatedReq.paymentReference || null,
            },
          });
          await this.releaseScheduledDeliveries(tx, updatedReq, now);
        }

        return tx.stockRequest.findUniqueOrThrow({
          where: { id },
          include: {
            product: true,
            variant: true,
            franchise: true,
            deliveries: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });
      },
      { timeout: 15000 },
    );

    // =============================
    // EVENT
    // =============================

    void this.stockingNodeIdForFranchise(out.franchiseId).then(
      (stockingNodeId) =>
        this.domainEvents.emit(
          'inventory.stock_request.payment_updated',
          {
            stockRequestId: out.id,
            franchiseId: out.franchiseId,
            paymentStatus: out.paymentStatus,
            paidAmount: out.paidAmount,
            remainingAmount: out.remainingAmount,
          },
          {
            refType: 'STOCK_REQUEST',
            refId: out.id,
            productId: out.productId,
            variantId: out.variant?.id || undefined,
            stockingNodeId,
          },
        ),
    );

    await this.notifyStockRequestPayment({
      stockRequestId: out.id,
      userId: reviewer.sub,
      franchiseId: out.franchiseId,
      ownerName: out.franchise.ownerFullName || out.franchise.name || 'N/A',
      code: out.franchise.code,
      businessName: out.franchise.businessName || out.franchise.name || 'N/A',
      businessEmail:
        out.franchise.ownerEmail || out.franchise.businessEmail || 'N/A',
      ownerEmail:
        out.franchise.ownerEmail || out.franchise.businessEmail || 'N/A',

      totalAmount: Number(out.billingTotal || 0),
      cashAmount: Number(dto.amount || 0),
      deductedAmount:
        Number(out.billingTotal || 0) -
        Number(out.remainingAmount || 0) -
        Number(dto.amount || 0),
      remainingAmount: Number(out.remainingAmount || 0),

      paymentStatus: out.paymentStatus,
      paymentReference: dto.paymentReference,
    });

    return out;
  }
}
