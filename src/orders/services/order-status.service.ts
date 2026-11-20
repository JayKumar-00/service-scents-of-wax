import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  OnlinePaymentStatus,
  OrderChannel,
  OrderStatus,
  Role,
  Prisma,
  PaymentModeEnum,
} from '@prisma/client';
import { InventoryReservationService } from 'src/order-allocation/services/inventory-reservation.service';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { franchiseCanMutate } from '../../common/franchise-roles';
import { BrevoService } from 'src/notification/services/brevo.service';
import { NotificationQueue } from 'src/notification/queues/notification.queue';
import { ConfigService } from '@nestjs/config';
import { InvoiceService } from 'src/invoice/invoice.service';
import { RoleBasedNotificationService } from 'src/notification/services/role-based-notification.service';
import { PdfGenerator } from '../../common/utils/pdf-generator.util';
import { InvoiceHtmlBuilder } from '../../invoice/template/invoice-html.builder';
import { InvoiceTemplate } from '../../notification/templates/invoice.template';
import { OrderConfimationTemplate } from '../../notification/templates/order-confirmation.template';
import { NotificationChannel } from 'src/notification/enums/notification-channel.enum';
import * as crypto from 'crypto';
import { NotificationType } from 'src/notification/enums/notification-type.enum';

const FRANCHISE_STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  // [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.COMPLETED], [OrderStatus.DELIVERED],
};

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

function franchiseMaySetStatus(from: OrderStatus, to: OrderStatus): boolean {
  return FRANCHISE_STATUS_FLOW[from]?.includes(to) ?? false;
}

@Injectable()
export class OrderStatusService {
  private readonly logger = new Logger(OrderStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevoService: BrevoService,
    private readonly notificationQueue: NotificationQueue,

    @InjectQueue('retention')
    private readonly retentionQueue: Queue,

    @Inject(forwardRef(() => InvoiceService))
    private readonly invoiceService: InvoiceService,
    private readonly roleBasedNotificationService: RoleBasedNotificationService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
    private readonly inventoryReservationService: InventoryReservationService,
  ) {}

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    user: JwtUser,
    ip?: string,
  ) {
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      let updatedOrder;
      if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN_STAFF) {
        const isConfirming =
          status === OrderStatus.CONFIRMED || status === OrderStatus.PROCESSING;
        const isDelivering = status === OrderStatus.DELIVERED;
        const isCodDelivering = isDelivering && order.paymentMode === PaymentModeEnum.COD;
        updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status,
            ...(isConfirming
              ? { isApproved: true, approvedByUserId: user.sub }
              : {}),
            ...(isDelivering
              ? { deliveredAt: order.deliveredAt || new Date() }
              : {}),
            ...(isCodDelivering
              ? {
                  onlinePaymentStatus: OnlinePaymentStatus.PAID,
                  paidAt: order.paidAt || new Date(),
                  paymentProvider: order.paymentProvider || 'COD',
                  paymentReference: order.paymentReference || 'COD_' + order.orderNumber,
                }
              : {}),
          },
          include: {
            items: {
              include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } },
            },
            franchise: true,
          },
        });
      } else if (franchiseCanMutate(user.role)) {
        const allowedFranchiseId =
          user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId;
        if (!allowedFranchiseId || allowedFranchiseId !== order.franchiseId) {
          throw new ForbiddenException('Not allowed to update this order');
        }
        if (
          order.channel === OrderChannel.ONLINE &&
          order.onlinePaymentStatus === OnlinePaymentStatus.UNPAID &&
          order.paymentMode !== PaymentModeEnum.COD
        ) {
          throw new BadRequestException('Order is awaiting customer payment');
        }
        if (!franchiseMaySetStatus(order.status, status)) {
          throw new BadRequestException(
            `Cannot change order status from ${order.status} to ${status} for this outlet`,
          );
        }
        const isDelivering = status === OrderStatus.DELIVERED;
        const isCodDelivering = isDelivering && order.paymentMode === PaymentModeEnum.COD;
        updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status,
            ...(isDelivering
              ? { deliveredAt: order.deliveredAt || new Date() }
              : {}),
            ...(isCodDelivering
              ? {
                  onlinePaymentStatus: OnlinePaymentStatus.PAID,
                  paidAt: order.paidAt || new Date(),
                  paymentProvider: order.paymentProvider || 'COD',
                  paymentReference: order.paymentReference || 'COD_' + order.orderNumber,
                }
              : {}),
          },
          include: {
            items: {
              include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } },
            },
            franchise: true,
          },
        });
      } else {
        throw new ForbiddenException();
      }

      const oldIsAccepted = order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PROCESSING;
      const newIsAccepted = status === OrderStatus.CONFIRMED || status === OrderStatus.PROCESSING;

      if (!oldIsAccepted && newIsAccepted) {
        await this.inventoryReservationService.consumeOrderReservations(tx, orderId);
      } else if (status === OrderStatus.CANCELLED) {
        await this.inventoryReservationService.releaseOrderReservations(tx, orderId, 'Order status set to CANCELLED');
        await this.inventoryReservationService.releaseConsumedOrderReservations(tx, orderId, 'Order status set to CANCELLED');
      }

      return { updatedOrder, oldStatus: order.status };
    });

    let { updatedOrder: updated, oldStatus } = transactionResult;
    const isPickupOrder =
      updated.saleType && String(updated.saleType).toUpperCase() === 'PICKUP';
    if (updated.status === OrderStatus.DELIVERED && isPickupOrder) {
      try {
        const address = JSON.parse(updated.addressJson);
        const scheduleEndTime = address.toPickupScheduleTime
          ? new Date(address.toPickupScheduleTime)
          : address.fromPickupScheduleTime
            ? new Date(address.fromPickupScheduleTime)
            : null;
        if (scheduleEndTime) {
          const thresholdHours =
            Number(process.env.LATE_PICKUP_THRESHOLD_HOURS) || 48;
          const hrsDiff =
            (Date.now() - scheduleEndTime.getTime()) / (1000 * 60 * 60);
          if (hrsDiff > thresholdHours) {
            const delayNote = `Picked up more than ${thresholdHours} hours after scheduled time.`;
            const finalGiftMessage = updated.giftMessage
              ? `${updated.giftMessage}\n[System Note: ${delayNote}]`
              : `[System Note: ${delayNote}]`;

            updated = await this.prisma.order.update({
              where: { id: orderId },
              data: {
                giftMessage: finalGiftMessage,
              },
              include: {
                items: {
                  include: { product: { select: ORDER_ITEM_PRODUCT_SELECT } },
                },
                franchise: true,
              },
            });
          }
        }
      } catch (e: any) {
        this.logger.error(
          `Failed to append 48-hour late pickup note: ${e.message}`,
        );
      }
    }

    if (oldStatus !== OrderStatus.CONFIRMED && updated.status === OrderStatus.CONFIRMED) {
      if (updated.paymentMode === PaymentModeEnum.COD && !updated.isApproved) {
        void this.sendCodConfirmedEmail(updated.id);
      }
    }

    if (updated.status === OrderStatus.CANCELLED) {
      void this.retentionQueue.add('order.cancelled', { orderId: updated.id });
    } else if (updated.status === OrderStatus.DELIVERED) {
      void this.retentionQueue.add('order.delivered', { orderId: updated.id });
      void this.sendOrderDeliveredEmail(updated.id);

      const isPickupCod =
        updated.saleType &&
        String(updated.saleType).toUpperCase() === 'PICKUP' &&
        updated.paymentMode === PaymentModeEnum.COD;

      if (isPickupCod && !updated.invoiceNumber) {
        try {
          await this.invoiceService.generatedInvoice({
            orderNumber: updated.orderNumber,
          } as any);
        } catch (invoiceError: any) {
          this.logger.error(
            `Failed to generate invoice for PICKUP COD order ${updated.orderNumber} on DELIVERED status: ${invoiceError.message}`,
          );
        }
      }
    }

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'ORDER_STATUS_UPDATE',
        resource: 'ORDER',
        resourceId: updated.id,
        metadata: {
          oldStatus,
          newStatus: updated.status,
          orderNumber: updated.orderNumber,
        },
        ip,
      }),
      'ORDER_STATUS_UPDATE',
    );

    return updated;
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
        select: {
          id: true,
          orderNumber: true,
          status: true,
          invoiceNumber: true,
          isApproved: true,
          customer: {
            select: {
              id: true,
              name: true,
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
        order?.customer?.user?.email || order.retailCustomer?.email;
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

  private async sendCodConfirmedEmail(orderId: string) {
    try {
      const existingEmail = await this.prisma.notification.findFirst({
        where: {
          channel: NotificationChannel.EMAIL,
          metadata: {
            path: ['orderId'],
            equals: orderId,
          },
          title: 'Order Email: CONFIRMED',
        },
      });
      if (existingEmail) {
        this.logger.log(`Confirmed email already sent for order ${orderId}. Skipping.`);
        return;
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
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

      const customerEmail = order.customer?.user?.email || order.retailCustomer?.email;
      const customerName = order.customer?.name || order.retailCustomer?.name || 'Customer';
      if (!customerEmail) return;

      const platformName = this.configService.get('PLATFORM_NAME', 'UnBoxIO');
      const supportEmail = this.configService.get('SUPPORT_EMAIL', 'support@unboxio.com');
      const amount = order.total instanceof Prisma.Decimal ? Number(order.total.toFixed(2)) : Number(order.total);

      const template = OrderConfimationTemplate.build({
        orderId: order.id,
        customerName,
        platformName,
        orderNumber: order.orderNumber,
        supportEmail,
        amount,
        title: 'Order Confirmed',
        subTitle: 'Your order has been confirmed',
        message: 'Thank you for your order! Your order has been successfully confirmed.',
      });

      await this.brevoService.sendEmail({
        to: customerEmail,
        subject: `Your order was confirmed ✓ - ${order.orderNumber}`,
        htmlContent: template,
      });

      await this.prisma.notification.create({
        data: {
          userId: order.customer?.user?.id || order.retailCustomer?.id || '',
          title: 'Order Email: CONFIRMED',
          body: `Order confirmed email sent for ${order.orderNumber}`,
          type: NotificationType.ORDER,
          channel: NotificationChannel.EMAIL,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
          },
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to send COD confirmed email for order ${orderId}: ${err.message}`);
    }
  }

  private async sendOrderDeliveredEmail(orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: {
            include: {
              user: {
                select: { email: true },
              },
            },
          },
          retailCustomer: true,
        },
      });

      if (!order) return;

      const customerEmail =
        order.customer?.user?.email || order.retailCustomer?.email;
      if (!customerEmail) return;

      const customerName =
        order.customer?.name || order.retailCustomer?.name || 'Customer';

      let invoiceNumber = order.invoiceNumber;
      if (!invoiceNumber) {
        try {
          const invoice = await this.invoiceService.generatedInvoice({
            orderNumber: order.orderNumber,
          } as any);
          invoiceNumber = invoice?.invoiceNumber;
        } catch (e: any) {
          this.logger.error(
            `Failed to generate invoice on DELIVERED for ${order.orderNumber}: ${e.message}`,
          );
        }
      }

      let attachments: Array<{ content: string; name: string }> | undefined = undefined;
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
        } catch (pdfErr: any) {
          this.logger.error(
            `Failed to generate PDF attachment for DELIVERED order ${order.orderNumber}: ${pdfErr.message}`,
          );
        }
      }

      const platformName = this.configService.get(
        'PLATFORM_NAME',
        'UnBoxIO',
      );
      const amount =
        order.total instanceof Prisma.Decimal
          ? Number(order.total.toFixed(2))
          : Number(order.total);

      const html = OrderConfimationTemplate.build({
        orderId: order.id,
        customerName,
        platformName,
        orderNumber: order.orderNumber,
        supportEmail: this.configService.get(
          'SUPPORT_EMAIL',
          'support@unboxio.com',
        ),
        amount,
        title: 'Order Delivered ✓',
        subTitle: 'Your order has been delivered successfully',
        message:
          'Your order has been delivered! Please find your invoice attached.',
      });

      await this.brevoService.sendEmail({
        to: customerEmail,
        subject: `Your order has been delivered ✓ - ${order.orderNumber}`,
        htmlContent: html,
        attachment: attachments,
      });

      this.logger.log(
        `Delivered email sent to customer ${customerEmail} for order ${order.orderNumber}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to send order delivered email for ${orderId}: ${err.message}`,
      );
    }
  }
}
