import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';
import {
  InventoryReservationStatus,
  OnlinePaymentStatus,
  OrderChannel,
  OrderStatus,
  Prisma,
  Role,
  PaymentModeEnum,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { BrevoService } from 'src/notification/services/brevo.service';
import { NotificationQueue } from 'src/notification/queues/notification.queue';
import { DomainEventsService } from 'src/supply-chain/domain-events.service';
import { WebhooksService } from 'src/webhooks/webhooks.service';
import { InventoryReservationService } from 'src/order-allocation/services/inventory-reservation.service';
import { OrderAllocationService } from 'src/order-allocation/services/order-allocation.service';
import { OrderStockService } from './order-stock.service';
import { PayOrderDto } from '../dto/pay-order.dto';
import { InvoiceService } from 'src/invoice/invoice.service';
import { PdfGenerator } from '../../common/utils/pdf-generator.util';
import { InvoiceHtmlBuilder } from '../../invoice/template/invoice-html.builder';
import { InvoiceTemplate } from '../../notification/templates/invoice.template';
import { OrderConfimationTemplate } from 'src/notification/templates/order-confirmation.template';
import { PaymentFailureTemplate } from 'src/notification/templates/payment-faliure.template';
import { NotificationChannel } from 'src/notification/enums/notification-channel.enum';
import { NotificationType } from 'src/notification/enums/notification-type.enum';

const ORDER_ITEM_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  stock: true,
  gstTax: true,
  features: true,
  status: true,
  visibility: true,
  categoryId: true,
  brandId: true,
  fastDelivery: true,
  isFeatured: true,
  occasions: true,
  ratingAvg: true,
  reviewCount: true,
  defaultGstRatePercent: true,
  imageUrl: true,
  imageUrls: true,
  explicitAttributes: true,
  basePrice: true,
  wholesalePrice: true,
  price: true,
  mrpPrice: true,
  returnWindow: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryReservationService: InventoryReservationService,
    private readonly orderStockService: OrderStockService,
    private readonly brevoService: BrevoService,
    private readonly notificationQueue: NotificationQueue,
    private readonly configService: ConfigService,
    private readonly domainEvents: DomainEventsService,
    private readonly webhooks: WebhooksService,
    @Inject(forwardRef(() => InvoiceService))
    private readonly invoiceService: InvoiceService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => OrderAllocationService))
    private readonly orderAllocationService: OrderAllocationService,
  ) {}

  async payOnline(orderId: string, user: JwtUser, dto: PayOrderDto) {
    if (user.role !== Role.CUSTOMER) {
      throw new ForbiddenException();
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.customerId !== user.sub) {
      throw new NotFoundException('Order not found');
    }
    if (order.channel !== OrderChannel.ONLINE) {
      throw new BadRequestException('Not an online order');
    }
    if (order.onlinePaymentStatus === OnlinePaymentStatus.PAID) {
      return this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } },
          },
          franchise: true,
        },
      });
    }
    if (order.onlinePaymentStatus !== OnlinePaymentStatus.UNPAID) {
      throw new BadRequestException(
        'Order cannot be paid in its current state',
      );
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order was cancelled');
    }

    const ordersToPay = order.cartId
      ? await this.prisma.order.findMany({
        where: {
          cartId: order.cartId,
          onlinePaymentStatus: OnlinePaymentStatus.UNPAID,
          status: { not: OrderStatus.CANCELLED },
        },
        include: { items: true },
      })
      : [order];

    const updatedOrders = await this.prisma.$transaction(async (tx) => {
      const results = [];
      const payRef =
        dto.mode === 'razorpay'
          ? dto.razorpayPaymentId!
          : `demo-${randomUUID()}-${Date.now()}`;

      for (const fresh of ordersToPay) {
        const freshDb = await tx.order.findUnique({
          where: { id: fresh.id },
          include: { items: true },
        });
        if (
          !freshDb ||
          freshDb.onlinePaymentStatus !== OnlinePaymentStatus.UNPAID
        ) {
          continue;
        }
        await this.handlePostPaymentStock(tx, {
          id: freshDb.id,
          orderRequestId: freshDb.orderRequestId,
          franchiseId: freshDb.franchiseId,
          retailCustomerId: freshDb.retailCustomerId,
          customerId: freshDb.customerId,
          items: freshDb.items.map(
            (line: { productId: string; quantity: number }) => ({
              productId: line.productId,
              quantity: line.quantity,
            }),
          ),
          isApproved: freshDb.isApproved,
          latitude: freshDb.latitude,
          longitude: freshDb.longitude,
        });
        const snap = (freshDb.billingSnapshot ?? {}) as Record<string, unknown>;
        const nextSnap = {
          ...snap,
          payment: {
            status: 'PAID',
            provider: dto.mode,
            reference: payRef,
            paidAt: new Date().toISOString(),
          },
        };
        const updatedOrder = await tx.order.update({
          where: { id: freshDb.id },
          data: {
            onlinePaymentStatus: OnlinePaymentStatus.PAID,
            paidAt: new Date(),
            paymentProvider: dto.mode,
            paymentReference: payRef,
            billingSnapshot: nextSnap as Prisma.InputJsonValue,
            ...(freshDb.isApproved ? { status: OrderStatus.CONFIRMED } : {}),
          },
          include: {
            items: {
              include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } },
            },
            franchise: true,
          },
        });
        results.push(updatedOrder);
      }
      return results;
    });

    for (const updated of updatedOrders) {
      void this.webhooks.queueEvent('order.online_paid', {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        franchiseId: updated.franchiseId,
        total:
          updated.total instanceof Prisma.Decimal
            ? updated.total.toFixed(2)
            : String(updated.total),
        paymentProvider: dto.mode,
      });

      void this.prisma.stockingNode
        .findFirst({ where: { franchiseId: updated.franchiseId } })
        .then((node) =>
          this.domainEvents.emit(
            'inventory.order.paid_outlet_deduct',
            {
              orderId: updated.id,
              orderNumber: updated.orderNumber,
              franchiseId: updated.franchiseId,
              items: updated.items.map((i: any) => ({
                productId: i.productId,
                quantity: i.quantity,
              })),
            },
            { refType: 'ORDER', refId: updated.id, stockingNodeId: node?.id },
          ),
        );

      if (updated.onlinePaymentStatus === OnlinePaymentStatus.PAID) {
        try {
          await this.invoiceService.generatedInvoice({
            orderNumber: updated.orderNumber,
          } as any);
        } catch (invoiceError: any) {
          this.logger.error(
            `Failed to generate invoice for order ${updated.orderNumber} after online payment: ${invoiceError.message}`,
          );
        }
      }

      if (updated.onlinePaymentStatus === OnlinePaymentStatus.PAID) {
        void this.sendInvoiceEmail(updated.id);
      }

      if (!updated.isApproved && updated.orderRequestId) {
        void this.orderAllocationService
          .startAllocationForRequest(updated.orderRequestId, updated.id)
          .catch((err) => {
            this.logger.error(
              `Failed to start allocation after payment for request ${updated.orderRequestId}: ${err.message}`,
            );
          });
      }
    }

    const primaryUpdated = updatedOrders.find((u) => u.id === orderId);
    let finalResult;
    if (primaryUpdated) {
      finalResult = primaryUpdated;
    } else {
      finalResult = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } },
          },
          franchise: true,
        },
      });
    }

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'ORDER_ONLINE_PAY',
        resource: 'ORDER',
        resourceId: orderId,
        metadata: { orderNumber: finalResult?.orderNumber },
      }),
      'ORDER_ONLINE_PAY',
    );

    return finalResult;
  }

  async markOrderPaidManual(orderId: string, user: JwtUser) {
    const allowedRoles = [
      Role.SUPERADMIN,
      Role.ADMIN_STAFF,
      Role.FRANCHISE_OWNER,
      Role.FRANCHISE_STAFF,
    ];
    if (!allowedRoles.includes(user.role as any)) {
      throw new ForbiddenException('Not allowed to mark order as paid');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF
    ) {
      const allowedFranchiseId =
        user.role === Role.FRANCHISE_STAFF
          ? user.franchiseOwnerId
          : user.franchiseId;
      if (!allowedFranchiseId || allowedFranchiseId !== order.franchiseId) {
        throw new ForbiddenException(
          'Not allowed to mark this order as paid',
        );
      }
    }

    const payRef = `cod-${randomUUID()}-${Date.now()}`;
    const result = await this.prisma.$transaction(async (tx) => {
      return this.markOrderPaid(tx, orderId, payRef);
    });

    return result;
  }

  async cancelOnlineUnpaid(orderId: string, user: JwtUser) {
    if (user.role !== Role.CUSTOMER) {
      throw new ForbiddenException();
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.customerId !== user.customerId) {
      throw new NotFoundException('Order not found');
    }
    if (order.channel !== OrderChannel.ONLINE) {
      throw new BadRequestException(
        'Only online orders can be cancelled by the customer',
      );
    }
    if (
      order.onlinePaymentStatus !== OnlinePaymentStatus.UNPAID &&
      order.onlinePaymentStatus !== OnlinePaymentStatus.PAID
    ) {
      throw new BadRequestException(
        'Only paid or unpaid online orders can be cancelled',
      );
    }

    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.CREATED,
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
    ];

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled because it is already ${order.status}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const full = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!full) {
        throw new NotFoundException('Order not found');
      }
      if (
        full.onlinePaymentStatus !== OnlinePaymentStatus.UNPAID &&
        full.onlinePaymentStatus !== OnlinePaymentStatus.PAID
      ) {
        throw new BadRequestException(`Order cannot be cancelled due to payment ${full.onlinePaymentStatus}`);
      }
      if (!cancellableStatuses.includes(full.status)) {
        throw new BadRequestException(
          `Order cannot be cancelled because it is already ${full.status}`,
        );
      }

      await this.inventoryReservationService.releaseOrderReservations(
        tx,
        full.id,
        'Released on order cancellation',
      );
      await this.inventoryReservationService.releaseConsumedOrderReservations(
        tx,
        full.id,
        'Released on order cancellation',
      );

      return tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: {
          items: {
            include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } },
          },
          franchise: true,
        },
      });
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'ORDER_ONLINE_CANCEL',
        resource: 'ORDER',
        resourceId: orderId,
        metadata: { orderNumber: result.orderNumber },
      }),
      'ORDER_ONLINE_CANCEL',
    );

    return result;
  }

  async markOrderPaid(
    tx: Prisma.TransactionClient,
    orderId: string,
    paymentId: string,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: { include: { user: { select: { email: true } } } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.onlinePaymentStatus === OnlinePaymentStatus.PAID) {
      return order;
    }

    const ordersToPay = order.cartId
      ? await tx.order.findMany({
        where: {
          cartId: order.cartId,
          onlinePaymentStatus: OnlinePaymentStatus.UNPAID,
          status: { not: OrderStatus.CANCELLED },
        },
        include: {
          items: true,
          customer: { include: { user: { select: { email: true } } } },
        },
      })
      : [order];

    let lastResult = order;

    for (const o of ordersToPay) {
      await this.handlePostPaymentStock(tx, {
        id: o.id,
        orderRequestId: o.orderRequestId,
        franchiseId: o.franchiseId,
        retailCustomerId: o.retailCustomerId,
        customerId: o.customerId,
        items: o.items.map((line: { productId: string; quantity: number }) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        isApproved: o.isApproved,
        latitude: o.latitude,
        longitude: o.longitude,
      });

      let finalStatus: OrderStatus = OrderStatus.CONFIRMED;

      const safeChannel = o.channel?.toString().toUpperCase().trim();
      const safeSaleType = o.saleType?.toString().toUpperCase().trim();

      this.logger.log(
        `[Queue Worker] Processing Order ${o.orderNumber} - Channel: ${safeChannel}, SaleType: ${safeSaleType}`,
      );

      if (safeChannel === 'POS') {
        if (
          safeSaleType === 'WALK-IN' ||
          safeSaleType === 'WALK_IN' ||
          safeSaleType === 'WALKIN'
        ) {
          finalStatus = OrderStatus.DELIVERED;
        }
      }

      this.logger.log(
        `[Queue Worker] Status determined for ${o.orderNumber}: ${finalStatus}`,
      );

      const result = await tx.order.update({
        where: { id: o.id },
        data: {
          onlinePaymentStatus: OnlinePaymentStatus.PAID,
          status: o.isApproved ? finalStatus : o.status,
          paidAt: new Date(),
          paymentProvider: paymentId.startsWith('cod-') ? 'COD' : 'RAZORPAY',
          paymentReference: paymentId,
          ...(o.isApproved && finalStatus === OrderStatus.DELIVERED
            ? { deliveredAt: o.deliveredAt || new Date() }
            : {}),
        },
      });

      if (o.id === orderId) {
        lastResult = result;
      }

      const customerEmail = (o.customer as any)?.user?.email ?? '';
      const customerName =
        (o.customer as any)?.name || customerEmail || 'Customer';
      if (customerEmail) {
        void this.sendOrderConfirmationEmail(
          customerEmail,
          customerName,
          result.orderNumber,
          result.total instanceof Prisma.Decimal
            ? Number(result.total.toFixed(2))
            : Number(result.total),
          undefined,
          result.id,
        );
      }
    }

    // Outside transaction - trigger allocation for unpaid delivery orders that just got paid
    for (const o of ordersToPay) {
      const dbOrder = await this.prisma.order.findUnique({
        where: { id: o.id },
        select: { isApproved: true, orderRequestId: true },
      });
      if (dbOrder && !dbOrder.isApproved && dbOrder.orderRequestId) {
        void this.orderAllocationService
          .startAllocationForRequest(dbOrder.orderRequestId, o.id)
          .catch((err) => {
            this.logger.error(
              `Failed to start allocation after payment for request ${dbOrder.orderRequestId}: ${err.message}`,
            );
          });
      }
    }

    return lastResult;
  }

  async generateInvoiceForOrderId(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });
    if (order) {
      await this.invoiceService.generatedInvoice({
        orderNumber: order.orderNumber,
      } as any);
    }
  }

  private async getInvoicePdfAttachmentForOrder(
    orderNumber: string,
  ): Promise<Array<{ content: string; name: string }> | undefined> {
    try {
      if (!this.invoiceService) return undefined;
      const invoice = await this.invoiceService.generatedInvoice({
        orderNumber,
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
      this.logger.error(
        `Failed to generate invoice PDF attachment for order ${orderNumber}: ${err.message}`,
      );
      return undefined;
    }
  }

  async sendOrderConfirmationEmail(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    amount: number,
    userId?: string,
    orderId?: string,
  ) {
    if (!customerEmail) return;
    try {
      let finalOrderId = orderId;
      if (!finalOrderId) {
        const order = await this.prisma.order.findUnique({
          where: { orderNumber },
          select: { id: true },
        });
        finalOrderId = order?.id || '';
      }
      const attachment = await this.getInvoicePdfAttachmentForOrder(orderNumber);
      const title = `Order Confirmed ✓ - ${orderNumber} | ${this.configService.get('PLATFORM_NAME', 'UnBoxIO')}`;
      const body = `Your order ${orderNumber} has been confirmed. Amount Paid: ₹${amount.toFixed(2)}`;
      const htmlContent = this.getOrderConfirmationEmail(
        customerName,
        orderNumber,
        amount,
        finalOrderId,
      );

      await this.notificationQueue.add({
        userId: userId || '',
        title,
        body,
        type: NotificationType.PAYMENT,
        metadata: {
          orderNumber,
          recipientEmail: customerEmail,
          htmlContent,
          attachment,
        },
      });

      this.logger.log(`Order confirmation notification queued for ${customerEmail}`);
    } catch (error: Error | any) {
      this.logger.error(
        `Failed to send order confirmation email: ${error?.message}`,
      );
    }
  }

  async notifyPaymentFailure(
    superAdminEmail: string,
    franchiseEmail: string,
    franchiseName: string,
    orderNumber: string,
    amount: number,
    errorReason: string,
    orderId?: string,
  ) {
    try {
      let finalOrderId = orderId;
      if (!finalOrderId) {
        const order = await this.prisma.order.findUnique({
          where: { orderNumber },
          select: { id: true },
        });
        finalOrderId = order?.id || '';
      }
      const failureEmail = this.getPaymentFailureEmail(
        'Admin',
        orderNumber,
        amount,
        errorReason,
        finalOrderId,
      );

      // await this.brevoService.sendEmail({
      //   to: superAdminEmail,
      //   subject: `⚠ Payment Failed Alert - Order ${orderNumber}`,
      //   htmlContent: failureEmail,
      // });
      // this.logger.log(`Payment failure notification sent to SuperAdmin`);

      // const franchiseFailureEmail = this.getPaymentFailureEmail(
      //   franchiseName,
      //   orderNumber,
      //   amount,
      //   errorReason,
      // );
      // await this.brevoService.sendEmail({
      //   to: franchiseEmail,
      //   subject: `⚠ Payment Failed Alert - Order ${orderNumber}`,
      //   htmlContent: franchiseFailureEmail,
      // });
      // this.logger.log(`Payment failure notification sent to franchise`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send payment failure notification: ${error?.message}`,
      );
    }
  }

  private getOrderConfirmationEmail(
    customerName: string,
    orderNumber: string,
    amount: number,
    orderId: string,
  ): string {
    const platformName = this.configService.get(
      'PLATFORM_NAME',
      'UnBoxIO',
    );
    const supportEmail = this.configService.get(
      'SUPPORT_EMAIL',
      'support@unboxio.com',
    );

    const template = OrderConfimationTemplate.build({
      orderId,
      customerName,
      platformName,
      orderNumber,
      supportEmail,
      amount,
    });
    return template;
  }

  private getPaymentFailureEmail(
    recipientName: string,
    orderNumber: string,
    amount: number,
    reason: string,
    orderId: string,
  ): string {
    const platformName = this.configService.get(
      'PLATFORM_NAME',
      'UnBoxIO',
    );

    return PaymentFailureTemplate.build({
      orderId,
      platformName,
      recipientName,
      orderNumber,
      amount,
      reason,
    });
  }

  private async sendInvoiceEmail(orderId: string) {
    try {
      const existingEmail = await this.prisma.notification.findFirst({
        where: {
          channel: NotificationChannel.EMAIL,
          metadata: {
            path: ['orderId'],
            equals: orderId,
          },
          title: 'Order Email: INVOICE',
        },
      });
      if (existingEmail) {
        this.logger.log(`Invoice email already sent for order ${orderId}. Skipping.`);
        return;
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          franchise: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
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
      });

      if (!order) return;

      let invoiceNumber = order.invoiceNumber;
      if (!invoiceNumber) {
        try {
          const invoice = await this.invoiceService.generatedInvoice({
            orderNumber: order.orderNumber,
          } as any);
          invoiceNumber = invoice.invoiceNumber;
        } catch (invoiceError: any) {
          this.logger.error(
            `Failed to generate invoice in sendInvoiceEmail for order ${order.orderNumber}: ${invoiceError.message}`,
          );
        }
      }

      const customerEmail =
        order.customer?.user?.email || order.retailCustomer?.email;
      if (!customerEmail) {
        this.logger.warn(
          `No email found for customer in order ${order.orderNumber}`,
        );
        return;
      }

      const customerName =
        order.customer?.name || order.retailCustomer?.name || 'Customer';

      let attachments: Array<{ content: string; name: string }> | undefined =
        undefined;

      if (invoiceNumber) {
        try {
          const invoiceViewModel = await this.invoiceService.getInvoiceByNumber(
            invoiceNumber,
            { role: Role.SUPERADMIN } as any,
          );
          const htmlContent = InvoiceHtmlBuilder.build(invoiceViewModel, {
            autoPrint: false,
          });
          const pdfBuffer = await PdfGenerator.generateFromHtml(htmlContent, {
            noHeaderFooter: true,
          });
          attachments = [
            {
              content: pdfBuffer.toString('base64'),
              name: `Invoice-${invoiceNumber}.pdf`,
            },
          ];
        } catch (pdfError: any) {
          this.logger.error(
            `Failed to generate PDF attachment for order ${order.orderNumber}: ${pdfError.message}`,
          );
        }
      }

      const statusText = order.isApproved
        ? 'has been successfully confirmed and approved'
        : 'has been received and is being processed';

      const emailHtml = InvoiceTemplate.build({
        customerName,
        orderNumber: order.orderNumber,
        statusText,
      });

      await this.brevoService.sendEmail({
        to: customerEmail,
        subject: `Your Order Invoice - ${order.orderNumber}`,
        htmlContent: emailHtml,
        attachment: attachments,
      });

      this.logger.log(
        `Invoice email sent to customer ${customerEmail} for order ${order.orderNumber}`,
      );

      // Create notification log to prevent duplicate
      await this.prisma.notification.create({
        data: {
          userId: order.customer?.user?.id || order.retailCustomer?.id || '',
          title: 'Order Email: INVOICE',
          body: `Invoice email sent for order ${order.orderNumber}`,
          type: NotificationType.ORDER,
          channel: NotificationChannel.EMAIL,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
          },
        },
      });
    } catch (emailError: any) {
      this.logger.error(
        `Failed to send invoice email for order ${orderId}: ${emailError.message}`,
      );
    }
  }

  private async handlePostPaymentStock(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      orderRequestId: string | null;
      franchiseId: string;
      retailCustomerId: string | null;
      customerId: string | null;
      items: Array<{ productId: string; quantity: number }>;
      isApproved: boolean;
      latitude: number;
      longitude: number;
    },
  ) {
    const db = tx as any;

    const activeReservationCount = await db.inventoryReservation.count({
      where: { orderId: order.id, status: InventoryReservationStatus.ACTIVE },
    });

    if (activeReservationCount > 0) {
      await this.inventoryReservationService.consumeOrderReservations(
        tx,
        order.id,
      );
      return;
    }

    let req = null;
    if (order.orderRequestId) {
      req = await db.orderRequest.findUnique({
        where: { id: order.orderRequestId },
        select: { status: true },
      });
    }

    if (
      order.isApproved ||
      req?.status === 'ACCEPTED' ||
      req?.status === 'FULFILLED_BY_WAREHOUSE'
    ) {
      const targetFranchiseId = order.franchiseId;
      const franchise = await db.franchise.findUnique({
        where: { id: targetFranchiseId },
        select: { code: true },
      });
      const isWarehouse = franchise?.code === 'CENTRAL_WAREHOUSE';

      if (isWarehouse) {
        for (const item of order.items) {
          const ws = await db.warehouseStock.findUnique({
            where: { productId: item.productId },
          });
          const available = (ws?.quantity ?? 0) - (ws?.reserved ?? 0);
          if (available < item.quantity) {
            const shortfall = item.quantity - available;
            await db.warehouseStock.upsert({
              where: { productId: item.productId },
              update: { quantity: { increment: shortfall } },
              create: {
                productId: item.productId,
                quantity: shortfall,
                reserved: 0,
              },
            });
          }
        }
      } else {
        for (const item of order.items) {
          const vId = (item as any).variantId || '';
          const fs = await db.franchiseStock.findUnique({
            where: {
              franchiseId_productId_variantId: {
                franchiseId: targetFranchiseId,
                productId: item.productId,
                variantId: vId,
              },
            },
          });
          const available = (fs?.quantity ?? 0) - (fs?.reserved ?? 0);
          if (available < item.quantity) {
            const shortfall = item.quantity - available;
            await db.franchiseStock.upsert({
              where: {
                franchiseId_productId_variantId: {
                  franchiseId: targetFranchiseId,
                  productId: item.productId,
                  variantId: vId,
                },
              },
              update: { quantity: { increment: shortfall } },
              create: {
                franchiseId: targetFranchiseId,
                productId: item.productId,
                variantId: vId,
                quantity: shortfall,
                reserved: 0,
              },
            });
          }
        }
      }

      await this.inventoryReservationService.reserveForOrder(tx, {
        orderId: order.id,
        requestId: order.orderRequestId!,
        franchiseId: targetFranchiseId,
        items: order.items,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        note: 'Immediate reservation for paid assigned order',
      });
      await this.inventoryReservationService.consumeOrderReservations(
        tx,
        order.id,
      );
    } else {
      this.logger.log(
        `[PostPayment] Order ${order.id} is not yet approved/allocated. Deferring to standard allocation flow.`,
      );
    }
  }
}
