// razorpay.service.ts
import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  ForbiddenException,
} from '@nestjs/common';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { RazorpayGateway } from './providers/razorpay.geteway';
import { CreatePaymentOrderDto } from './dto/razorpay/create-order.dto';
import { VerifyPaymentDto } from './dto/razorpay/verify-payment.dto';
import { CapturePaymentDto } from './dto/razorpay/capture-payment.dto';
import {
  BooleanEnum,
  TransactionQueryDto,
} from './dto/razorpay/transaction-query.dto';
import { PaymentRefundDto } from './dto/razorpay/payment-refund.dto';
import { CreateInvoiceDto } from './dto/razorpay/create-invoice.dto';
import { PaymentForEnum } from './enums/payment.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentQueue } from './queues/payment.queue';
import {
  NotificationChannel,
  NotificationType,
  OnlinePaymentStatus,
  OrderChannel,
  OrderStatus,
  Role,
  StockRequestPaymentStatus,
  StockRequestStatus,
  InventoryReservationStatus,
} from '@prisma/client';
import { CreditService } from '../credit/credit.service';
import { BrevoService } from 'src/notification/services/brevo.service';
import { StockRequestPaymentTemplate } from 'src/notification/templates/stock-request.template';
import { fromPaise, toPaise } from './utils/amount.util';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@Injectable()
export class RazorpayService {
  constructor(
    private readonly geteway: RazorpayGateway,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly paymentQueue: PaymentQueue,
    private readonly brevoService: BrevoService,
    private readonly audit: AuditService,
  ) { }

  private get razorpay(): Razorpay {
    return this.geteway.getDetails();
  }

  private async notifyStockRequestPaymentFailed(params: {
    stockRequestId: string;
    franchiseId: string;
    paymentReference: string;
    paymentStatus: string;
    reason: string;
  }) {
    const stockRequest = await this.prisma.stockRequest.findUnique({
      where: { id: params.stockRequestId },
      include: {
        franchise: true,
      },
    });

    if (!stockRequest) return;

    const ownerUser = await this.prisma.user.findFirst({
      where: {
        franchiseId: params.franchiseId,
        role: Role.FRANCHISE_OWNER,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!ownerUser?.email) return;

    const billingTotal = Number(stockRequest.billingTotal || 0);

    await this.prisma.notification.create({
      data: {
        userId: ownerUser.id,
        title: 'Stock Request Payment Failed',
        body: `Your stock request payment could not be completed. Please retry the payment or contact support.`,
        type: NotificationType.FRANCHISE_STOCK_REQUEST,
        channel: NotificationChannel.IN_APP,
        metadata: {
          stockRequestId: stockRequest.id,
          franchiseId: stockRequest.franchiseId,
          franchiseCode: stockRequest.franchise.code,
          businessName:
            stockRequest.franchise.businessName ||
            stockRequest.franchise.name ||
            'N/A',
          ownerName:
            stockRequest.franchise.ownerFullName ||
            stockRequest.franchise.name ||
            'N/A',
          paymentStatus: params.paymentStatus,
          paymentReference: params.paymentReference,
          totalAmount: billingTotal,
          remainingAmount: billingTotal,
          reason: params.reason,
        },
      },
    });

    // Notify SuperAdmin via in-app notification
    try {
      const adminUser = await this.prisma.user.findFirst({
        where: { role: Role.SUPERADMIN },
        select: { id: true },
      });

      if (adminUser) {
        await this.prisma.notification.create({
          data: {
            userId: adminUser.id,
            title: 'Stock Request Payment Failed',
            body: `Payment for stock request ${stockRequest.id} failed for franchise ${stockRequest.franchise.name} (${stockRequest.franchise.code}).`,
            type: NotificationType.FRANCHISE_STOCK_REQUEST,
            channel: NotificationChannel.IN_APP,
            metadata: {
              stockRequestId: stockRequest.id,
              franchiseId: stockRequest.franchiseId,
              franchiseCode: stockRequest.franchise.code,
              ownerName:
                stockRequest.franchise.ownerFullName ||
                stockRequest.franchise.name ||
                'N/A',
              paymentStatus: params.paymentStatus,
              paymentReference: params.paymentReference,
              reason: params.reason,
            },
          },
        });
      }
    } catch (err) {
      // Non-critical: don't block failure handling if admin notify fails
      console.error('Failed to notify SuperAdmin about payment failure', err);
    }

    const html = StockRequestPaymentTemplate.build({
      stockRequestId: stockRequest.id,
      franchiseCode: stockRequest.franchise.code,
      businessName:
        stockRequest.franchise.businessName ||
        stockRequest.franchise.name ||
        'N/A',
      ownerName:
        stockRequest.franchise.ownerFullName ||
        stockRequest.franchise.name ||
        'N/A',
      totalAmount: billingTotal,
      cashAmount: 0,
      deductedAmount: 0,
      remainingAmount: billingTotal,
      paymentStatus: params.paymentStatus,
      paymentReference: params.paymentReference,
      title: 'Stock Request Payment Failed',
      intro:
        'Your stock request payment could not be verified successfully. Please retry the payment.',
      reason: params.reason,
    });

    await this.brevoService.sendEmail({
      to: ownerUser.email,
      subject: 'STOCK REQUEST PAYMENT FAILED',
      htmlContent: html,
    });
  }

  private handleError(error: any, context: string) {
    throw new HttpException(
      {
        success: false,
        message: `${context} failed`,
        error: error.message || error.toString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  // 🔹 Orders
  /**
   * =========================================================
   * CREATE ORDER
   * =========================================================
   */
  private withReadableAmount(payload: any) {
    return {
      payment_id: payload.id,
      receipt: payload.receipt,
      entity: payload.entity,
      currency: payload.currency,
      status: payload.status,
      order_id: payload.order_id,
      invoice_id: payload.invoice_id,
      international: payload.international,
      method: payload.method,

      amount_rupees: fromPaise(Number(payload.amount)),
      amount_refunded_rupees: fromPaise(Number(payload.amount_refunded || 0)),
      fee_rupees: fromPaise(Number(payload.fee || 0)),
      tax_rupees: fromPaise(Number(payload.tax || 0)),

      amount_paisa: payload.amount,
      amount_refunded_paisa: payload.amount_refunded,
      fee_paisa: payload.fee,
      tax_paisa: payload.tax,

      refund_status: payload.refund_status,
      captured: payload.captured,
      description: payload.description,

      card_id: payload.card_id,
      bank: payload.bank,
      wallet: payload.wallet,
      vpa: payload.vpa,

      email: payload.email,
      contact: payload.contact,

      notes: payload.notes,

      error_code: payload.error_code,
      error_description: payload.error_description,
      error_source: payload.error_source,
      error_step: payload.error_step,
      error_reason: payload.error_reason,

      created_at_readable: new Date(payload.created_at * 1000).toLocaleString(
        'en-IN',
        {
          timeZone: 'Asia/Kolkata',
        },
      ),

      created_at_iso: new Date(payload.created_at * 1000).toISOString(),
    };
  }

  private getRazorpayStatusCode(error: any): number | undefined {
    try {
      if (error?.response?.statusCode) return Number(error.response.statusCode);
      if (error?.response?.status) return Number(error.response.status);
      if (error?.statusCode) return Number(error.statusCode);
      if (error?.status) return Number(error.status);
      if (error?.error?.statusCode) return Number(error.error.statusCode);
      if (error?.error?.status) return Number(error.error.status);
    } catch {
      return undefined;
    }

    return undefined;
  }

  private getRazorpayErrorMessage(error: any): string {
    try {
      if (error?.response?.data?.message) return error.response.data.message;
      if (error?.response?.data?.error?.description) {
        return error.response.data.error.description;
      }
      if (error?.error?.description) return error.error.description;
      if (error?.description) return error.description;
      if (error?.message) return error.message;
      if (typeof error === 'string') return error;
    } catch {
      return 'Unexpected Razorpay error';
    }

    return 'Unexpected Razorpay error';
  }

  async createOrder(user: JwtUser, dto: CreatePaymentOrderDto, ip?: string) {
    let amount = 0;

    const metadata: any = {
      paymentFor: dto.paymentFor,
    };

    /**
     * CREDIT PAYMENT
     */
    if (dto.paymentFor === PaymentForEnum.CREDITS) {
      const account = await this.prisma.creditAccount.findUnique({
        where: {
          id: dto.creditAccount?.id,
        },
      });

      if (!account) {
        throw new NotFoundException('Credit account not found');
      }

      amount = Number(dto.creditAccount?.amount);

      metadata.accountId = account.id;
      metadata.franchiseId = account.franchiseId;
    }

    /**
     * PRODUCT PAYMENT
     */
    if (dto.paymentFor === PaymentForEnum.PRODUCTS) {
      const order = await this.prisma.order.findUnique({
        where: {
          orderNumber: dto.productOrderNumber!,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order was cancelled');
      }

      if (
        order.status !== OrderStatus.CREATED &&
        order.status !== OrderStatus.COMPLETED &&
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.CONFIRMED &&
        order.status !== OrderStatus.DELIVERED &&
        order.status !== OrderStatus.PROCESSING
      ) {
        throw new BadRequestException(
          `Order is in ${order.status} status and cannot be paid online. Eligible statuses: CREATED, PENDING, CONFIRMED, PROCESSING, DELIVERED, COMPLETED`,
        );
      }

      if (order.onlinePaymentStatus !== OnlinePaymentStatus.UNPAID) {
        throw new BadRequestException(
          'Online payment already processed for this order or order is not eligible for online payment',
        );
      }

      let ordersToPay = [order];
      if (order.cartId) {
        ordersToPay = await this.prisma.order.findMany({
          where: {
            cartId: order.cartId,
            onlinePaymentStatus: OnlinePaymentStatus.UNPAID,
            status: { not: OrderStatus.CANCELLED },
          },
        });
      }

      amount = ordersToPay.reduce((sum, o) => sum + Number(o.total), 0);

      metadata.orderId = order.id;
      metadata.customerId = order.customerId;
      metadata.cartId = order.cartId;
      metadata.franchiseId = order.franchiseId;
    }

    /**
     * STOCK REQUEST PAYMENT
     */
    if (dto.paymentFor === PaymentForEnum.STOCK_REQUESTS) {
      const stockRequest = await this.prisma.stockRequest.findUnique({
        where: {
          id: dto.stockRequest?.id,
        },
        include: {
          product: true,
          variant: true,
        },
      });

      if (!stockRequest) {
        throw new NotFoundException('Stock request not found');
      }

      if (
        stockRequest.status === StockRequestStatus.REJECTED ||
        stockRequest.status === StockRequestStatus.CANCELLED
      ) {
        throw new BadRequestException('Stock request is not payable');
      }

      if (stockRequest.paymentStatus === StockRequestPaymentStatus.PAID) {
        throw new BadRequestException(
          'Stock request payment already completed',
        );
      }

      const billingTotal = Number(stockRequest.billingTotal ?? 0);

      if (billingTotal > 0) {
        amount = billingTotal;
      } else {
        const unitPrice = stockRequest.variant
          ? Number(stockRequest.variant.price)
          : Number(stockRequest.product.price);
        const gstRate = stockRequest.variant
          ? Number(stockRequest.variant.gstTax ?? 0)
          : Number(stockRequest.product.defaultGstRatePercent ?? 0);
        amount = (unitPrice * stockRequest.quantity * (100 + gstRate)) / 100;
      }

      metadata.stockRequestId = stockRequest.id;
      metadata.franchiseId = stockRequest.franchiseId;
      metadata.quantity = stockRequest.quantity;
    }

    try {
      /**
       * CREATE RAZORPAY ORDER
       */
      const razorpayOrder = await this.razorpay.orders.create({
        amount: toPaise(amount), // amount in paise

        currency: 'INR',

        receipt: `receipt_${Date.now()}`,

        notes: metadata,
      });

      /**
       * CREATE FINANCIAL EVENT
       */
      await this.prisma.financialEvent.create({
        data: {
          type: dto.paymentFor,

          razorpayOrderId: razorpayOrder.id,

          amount,

          gatewayStatus: 'created',

          metadata,
        },
      });

      fireAndForget(
        this.audit.log({
          userId: user.sub,
          action: 'PAYMENT_ORDER_CREATE',
          resource: 'Payment',
          resourceId: razorpayOrder.id,
          metadata: { ...metadata, amount, franchiseId: metadata.franchiseId },
          ip,
        }),
        'PAYMENT_ORDER_CREATE',
      );

      return {
        ...razorpayOrder,
        amountInRupees: fromPaise(Number(razorpayOrder.amount)),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const status =
        this.getRazorpayStatusCode(error) ?? HttpStatus.BAD_GATEWAY;
      const message = this.getRazorpayErrorMessage(error);

      throw new HttpException(
        {
          success: false,
          message: `Failed to create order with Razorpay: ${message}`,
          errors: null,
        },
        status,
      );
    }
  }

  async fetchOrder(orderId: string) {
    try {
      const order = await this.razorpay.orders.fetch(orderId);
      return this.withReadableAmount(order);
    } catch (error) {
      this.handleError(error, 'Order fetch');
    }
  }

  async cancelOrder(razorpayOrderId: string, ip?: string) {
    const financialEvent = await this.prisma.financialEvent.findFirst({
      where: { razorpayOrderId },
    });

    if (!financialEvent) {
      throw new NotFoundException('Payment order not found');
    }

    if (financialEvent.processed) {
      throw new BadRequestException('Payment already processed');
    }

    const metadata = financialEvent.metadata as any;

    return this.prisma.$transaction(async (tx) => {
      // Update financial event status
      await tx.financialEvent.update({
        where: { id: financialEvent.id },
        data: { gatewayStatus: 'cancelled' },
      });

      if (financialEvent.type === PaymentForEnum.PRODUCTS) {
        const orderId = metadata?.orderId;
        const cartId = metadata?.cartId;

        // Find all orders associated with this event/cart that are unpaid
        const orders = cartId
          ? await tx.order.findMany({
            where: {
              cartId,
              onlinePaymentStatus: OnlinePaymentStatus.UNPAID,
              status: { not: OrderStatus.CANCELLED },
            },
          })
          : orderId
            ? [await tx.order.findUnique({ where: { id: orderId } })]
            : [];

        for (const order of orders) {
          if (
            order &&
            order.onlinePaymentStatus === OnlinePaymentStatus.UNPAID
          ) {
            // Update order status to CANCELLED
            await tx.order.update({
              where: { id: order.id },
              data: { status: OrderStatus.CANCELLED },
            });

            // Release stock reservations for the order
            const reservations = await tx.inventoryReservation.findMany({
              where: {
                orderId: order.id,
                status: InventoryReservationStatus.ACTIVE,
              },
            });

            for (const reservation of reservations) {
              const vId = (reservation as any).variantId || '';
              const stock = await tx.franchiseStock.findUnique({
                where: {
                  franchiseId_productId_variantId: {
                    franchiseId: reservation.franchiseId!,
                    productId: reservation.productId,
                    variantId: vId,
                  },
                },
                select: { reserved: true },
              });

              if (stock && stock.reserved >= reservation.quantity) {
                await tx.franchiseStock.update({
                  where: {
                    franchiseId_productId_variantId: {
                      franchiseId: reservation.franchiseId!,
                      productId: reservation.productId,
                      variantId: vId,
                    },
                  },
                  data: {
                    reserved: { decrement: reservation.quantity },
                  },
                });
              }

              await tx.inventoryReservation.update({
                where: { id: reservation.id },
                data: {
                  status: InventoryReservationStatus.RELEASED,
                  releasedAt: new Date(),
                  note: 'Released on unpaid order payment cancellation',
                },
              });
            }
          }
        }
      }

      if (financialEvent.type === PaymentForEnum.STOCK_REQUESTS) {
        const stockRequestId = metadata?.stockRequestId;
        if (stockRequestId) {
          const stockRequest = await tx.stockRequest.findUnique({
            where: { id: stockRequestId },
          });

          if (
            stockRequest &&
            stockRequest.paymentStatus !== StockRequestPaymentStatus.PAID
          ) {
            await tx.stockRequest.update({
              where: { id: stockRequestId },
              data: {
                status: StockRequestStatus.CANCELLED,
              },
            });
          }
        }
      }

      fireAndForget(
        this.audit.log({
          userId: 'SYSTEM',
          action: 'PAYMENT_ORDER_CANCEL',
          resource: 'Payment',
          resourceId: razorpayOrderId,
          metadata: { ...metadata, franchiseId: metadata?.franchiseId },
          ip,
        }),
        'PAYMENT_ORDER_CANCEL',
      );

      return { success: true, message: 'Payment order cancelled successfully' };
    });
  }

  async checkoutConfig() {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID')?.trim();
    if (!keyId) {
      throw new ServiceUnavailableException(
        'Razorpay checkout is not configured. Set RAZORPAY_KEY_ID.',
      );
    }
    return {
      script: 'https://checkout.razorpay.com/v1/checkout.js',
      keyId,
    };
  }

  // 🔹 Payments
  /**
   * =========================================================
   * VERIFY PAYMENT
   * =========================================================
   */
  async verify(dto: VerifyPaymentDto, ip?: string) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto;

    /**
     * VERIFY SIGNATURE
     */
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      throw new BadRequestException('Invalid payment signature');
    }

    /**
     * FIND EVENT
     */
    const financialEvent = await this.prisma.financialEvent.findFirst({
      where: {
        razorpayOrderId: razorpay_order_id,
      },
    });

    if (!financialEvent) {
      throw new NotFoundException('Financial event not found');
    }

    /**
     * IDEMPOTENCY CHECK
     */
    if (financialEvent.processed) {
      return {
        success: true,
        message: 'Already processed',
      };
    }

    /**
     * FETCH PAYMENT
     */
    const payment = await this.razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== 'captured') {
      const meta = financialEvent.metadata as unknown as {
        stockRequestId?: string;
        franchiseId?: string;
        [key: string]: any;
      };

      await this.notifyStockRequestPaymentFailed({
        stockRequestId: String(meta?.stockRequestId ?? ''),
        franchiseId: String(meta?.franchiseId ?? ''),
        paymentReference: razorpay_payment_id,
        paymentStatus: payment.status,
        reason: 'Gateway payment was not captured',
      });

      throw new BadRequestException('Payment not captured');
    }

    /**
     * UPDATE EVENT
     */
    await this.prisma.financialEvent.update({
      where: {
        id: financialEvent.id,
      },

      data: {
        razorpayPaymentId: razorpay_payment_id,

        gatewayStatus: payment.status, //status can be captured, authorized, failed
      },
    });

    /**
     * CHECK POS ORDER STATUS AFTER SUCCESSFUL ONLINE PAYMENT
     */
    if (
      financialEvent.type === PaymentForEnum.PRODUCTS &&
      payment.status === 'captured'
    ) {
      const meta = financialEvent.metadata as any;
      const ordersToUpdate = meta?.cartId
        ? await this.prisma.order.findMany({ where: { cartId: meta.cartId } })
        : meta?.orderId
          ? [
            await this.prisma.order.findUnique({
              where: { id: meta.orderId },
            }),
          ]
          : [];

      for (const order of ordersToUpdate) {
        // Safely check channel first
        if (order && order.channel === OrderChannel.POS) {
          const saleType = order.saleType?.toString().toUpperCase();
          const isWalkIn =
            saleType === 'WALK-IN' ||
            saleType === 'WALK_IN' ||
            saleType === 'WALKIN';
          const isPickupOrDelivery =
            saleType === 'PICKUP' || saleType === 'DELIVERY';

          let newStatus: OrderStatus | undefined;

          if (isPickupOrDelivery) {
            newStatus = OrderStatus.CONFIRMED;
          } else if (isWalkIn) {
            newStatus = OrderStatus.DELIVERED;
          }

          if (newStatus) {
            await this.prisma.order.update({
              where: { id: order.id },
              data: {
                status: newStatus,
                ...(newStatus === OrderStatus.DELIVERED ? { deliveredAt: order.deliveredAt || new Date() } : {}),
              },
            });
          }
        }
      }
    }

    /**
     * QUEUE JOB
     */
    await this.paymentQueue.settlePayment(financialEvent.id);

    let auditUserId: string | null = null;
    try {
      const meta = financialEvent.metadata as any;
      if (meta?.customerId) {
        auditUserId = meta.customerId;
      } else if (meta?.franchiseId) {
        const u = await this.prisma.user.findFirst({
          where: { franchiseId: meta.franchiseId },
          select: { id: true },
        });
        auditUserId = u?.id ?? null;
      } else if (meta?.accountId) {
        const account = await this.prisma.creditAccount.findUnique({
          where: { id: meta.accountId },
          select: { franchiseId: true },
        });
        if (account?.franchiseId) {
          const u = await this.prisma.user.findFirst({
            where: { franchiseId: account.franchiseId },
            select: { id: true },
          });
          auditUserId = u?.id ?? null;
        }
      }

      if (!auditUserId) {
        const fallbackUser = await this.prisma.user.findFirst({
          select: { id: true },
        });
        auditUserId = fallbackUser?.id ?? null;
      }
    } catch (e) {
      // Ignored
    }

    if (auditUserId) {
      fireAndForget(
        this.audit.log({
          userId: auditUserId,
          action: 'PAYMENT_VERIFY',
          resource: 'FINANCIAL_EVENT',
          resourceId: financialEvent.id,
          metadata: {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
          },
          ip,
        }),
        'PAYMENT_VERIFY',
      );
    }

    return {
      success: true,
      verified: true,
      queued: true,
    };
  }

  // 🔹 Payments
  async capturePayment(dto: CapturePaymentDto, user?: JwtUser, ip?: string) {
    try {
      const { paymentId, amount } = dto;

      const result = await this.razorpay.payments.capture(
        paymentId,
        toPaise(amount),
        'INR',
      );

      const financialEvent = await this.prisma.financialEvent.findFirst({
        where: {
          OR: [
            { razorpayPaymentId: paymentId },
            { razorpayOrderId: result.order_id },
          ],
        },
      });
      const metadata = financialEvent?.metadata as any;

      if (user) {
        fireAndForget(
          this.audit.log({
            userId: user.sub,
            action: 'PAYMENT_CAPTURE',
            resource: 'Payment',
            resourceId: paymentId,
            metadata: {
              amount,
              franchiseId: metadata?.franchiseId,
              ...metadata,
            },
            ip,
          }),
          'PAYMENT_CAPTURE',
        );
      }

      return result;
    } catch (error) {
      this.handleError(error, 'Payment capture');
    }
  }

  async fetchTransaction(paymentId: string, user?: JwtUser) {
    try {
      if (
        user &&
        user.role !== Role.SUPERADMIN &&
        user.role !== Role.ADMIN_STAFF
      ) {
        const franchiseId =
          user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId;
        const isFranchise =
          user.role === Role.FRANCHISE_OWNER ||
          user.role === Role.FRANCHISE_STAFF;

        const allowed = await this.prisma.financialEvent.findFirst({
          where: {
            AND: [
              {
                OR: [
                  { razorpayPaymentId: paymentId },
                  { razorpayOrderId: paymentId },
                ],
              },
              isFranchise
                ? {
                    OR: [
                      {
                        metadata: {
                          path: ['franchiseId'],
                          equals: franchiseId,
                        },
                      },
                      {
                        ledgerEntries: {
                          some: {
                            actorType: 'FRANCHISE',
                            actorId: franchiseId,
                          },
                        },
                      },
                    ],
                  }
                : {
                    metadata: {
                      path: ['customerId'],
                      equals: user.sub,
                    },
                  },
            ],
          },
        });

        if (!allowed) {
          throw new ForbiddenException('Unauthorized to view this transaction');
        }
      }

      const payment = await this.razorpay.payments.fetch(paymentId);
      return this.withReadableAmount(payment);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.handleError(error, 'Payment fetch');
    }
  }

  // async fetchAllTransactions(query: TransactionQueryDto) {
  //   try {
  //     const {
  //       page = 1,
  //       limit = 10,
  //       fromDate,
  //       toDate,
  //       minAmount,
  //       maxAmount,
  //       minAmountRefunded,
  //       maxAmountRefunded,
  //     } = query;

  //     const skip = (page - 1) * limit;

  //     const payload: any = {
  //       count: limit,
  //       skip,
  //     };

  //     // Razorpay supports only from/to
  //     if (fromDate) {
  //       payload.from = Math.floor(
  //         new Date(fromDate).setHours(0, 0, 0, 0) / 1000,
  //       );
  //     }

  //     if (toDate) {
  //       payload.to = Math.floor(
  //         new Date(toDate).setHours(23, 59, 59, 999) / 1000,
  //       );
  //     }

  //     // Direct Razorpay filters
  //     if (query.method) payload.method = query.method;
  //     if (query.contact) payload.contact = query.contact;
  //     if (query.email) payload.email = query.email;
  //     if (query.vpa) payload.vpa = query.vpa;
  //     if (query.wallet) payload.wallet = query.wallet;
  //     if (query.bank) payload.bank = query.bank;
  //     if (query.card_id) payload.card_id = query.card_id;
  //     if (query.invoice_id) payload.invoice_id = query.invoice_id;
  //     if (query.order_id) payload.order_id = query.order_id;
  //     if (query.currency) payload.currency = query.currency;
  //     if (query.entity) payload.entity = query.entity;
  //     if (query.status) payload.status = query.status;

  //     const transactions = await this.razorpay.payments.all(payload);

  //     // Manual filtering
  //     let items = transactions.items;

  //     if (minAmount !== undefined) {
  //       items = items.filter(
  //         (item) => Number(item.amount) >= Number(minAmount),
  //       );
  //     }

  //     if (maxAmount !== undefined) {
  //       items = items.filter(
  //         (item) => Number(item.amount) <= Number(maxAmount),
  //       );
  //     }

  //     if (minAmountRefunded !== undefined) {
  //       items = items.filter(
  //         (item) =>
  //           Number(item.amount_refunded ?? 0) >= Number(minAmountRefunded),
  //       );
  //     }

  //     if (maxAmountRefunded !== undefined) {
  //       items = items.filter(
  //         (item) =>
  //           Number(item.amount_refunded ?? 0) <= Number(maxAmountRefunded),
  //       );
  //     }

  //     // captured
  //     if (query.captured !== undefined) {
  //       const captured = query.captured === BooleanEnum.TRUE;

  //       items = items.filter((item) => item.captured === captured);
  //     }

  //     // international
  //     if (query.international !== undefined) {
  //       const international = query.international === BooleanEnum.TRUE;

  //       items = items.filter((item) => item.international === international);
  //     }

  //     // status
  //     if (query.refund_status) {
  //       items = items.filter(
  //         (item) => item.refund_status === query.refund_status,
  //       );
  //     }

  //     // entity
  //     if (query.entity) {
  //       items = items.filter((item) => item.entity === query.entity);
  //     }

  //     // method
  //     if (query.method) {
  //       items = items.filter((item) => item.method === query.method);
  //     }

  //     const transformed = items.map((item) => ({
  //       ...item,

  //       // Human readable
  //       created_at_readable: new Date(item.created_at * 1000).toLocaleString(
  //         'en-IN',
  //         {
  //           timeZone: 'Asia/Kolkata',
  //         },
  //       ),

  //       created_at_iso: new Date(item.created_at * 1000).toISOString(),
  //     }));

  //     return {
  //       data: transformed,

  //       meta: {
  //         source: 'Razorpay',
  //         count: transformed.length,
  //         page,
  //         limit,
  //         totalPages: transformed.length < limit ? page : page + 1,
  //         summary: {
  //           totalAmount:
  //             transformed.reduce((acc, item) => acc + Number(item.amount), 0) /
  //             100,
  //           totalRefunded:
  //             transformed.reduce(
  //               (acc, item) => acc + Number(item.amount_refunded || 0),
  //               0,
  //             ) / 100,
  //         },
  //       },
  //     };
  //   } catch (error) {
  //     this.handleError(error, 'Fetch transactions');
  //   }
  // }
  async fetchAllTransactions(query: TransactionQueryDto, user?: JwtUser) {
    try {
      const {
        page = 1,
        limit = 10,
        fromDate,
        toDate,
        minAmount,
        maxAmount,
        minAmountRefunded,
        maxAmountRefunded,
      } = query;

      const skip = (page - 1) * limit;

      const payload: any = {
        count: limit,
        skip,
      };

      // Razorpay date filters
      if (fromDate) {
        payload.from = Math.floor(
          new Date(fromDate).setHours(0, 0, 0, 0) / 1000,
        );
      }

      if (toDate) {
        payload.to = Math.floor(
          new Date(toDate).setHours(23, 59, 59, 999) / 1000,
        );
      }

      // Direct Razorpay filters
      if (query.method) payload.method = query.method;
      if (query.contact) payload.contact = query.contact;
      if (query.email) payload.email = query.email;
      if (query.vpa) payload.vpa = query.vpa;
      if (query.wallet) payload.wallet = query.wallet;
      if (query.bank) payload.bank = query.bank;
      if (query.card_id) payload.card_id = query.card_id;
      if (query.invoice_id) payload.invoice_id = query.invoice_id;
      if (query.order_id) payload.order_id = query.order_id;
      if (query.currency) payload.currency = query.currency;
      if (query.entity) payload.entity = query.entity;
      if (query.status) payload.status = query.status;

      const transactions = await this.razorpay.payments.all(payload);

      let items = transactions.items;

      if (
        user &&
        user.role !== Role.SUPERADMIN &&
        user.role !== Role.ADMIN_STAFF
      ) {
        const franchiseId =
          user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId;
        const isFranchise =
          user.role === Role.FRANCHISE_OWNER ||
          user.role === Role.FRANCHISE_STAFF;

        const financialEvents = await this.prisma.financialEvent.findMany({
          where: isFranchise
            ? {
              OR: [
                {
                  metadata: {
                    path: ['franchiseId'],
                    equals: franchiseId,
                  },
                },
                {
                  ledgerEntries: {
                    some: {
                      actorType: 'FRANCHISE',
                      actorId: franchiseId,
                    },
                  },
                },
              ],
            }
            : {
              metadata: {
                path: ['customerId'],
                equals: user.sub,
              },
            },
          select: { razorpayPaymentId: true, razorpayOrderId: true },
        });

        const allowedPaymentIds = new Set(
          financialEvents.map((fe) => fe.razorpayPaymentId).filter(Boolean),
        );
        const allowedOrderIds = new Set(
          financialEvents.map((fe) => fe.razorpayOrderId).filter(Boolean),
        );

        items = items.filter(
          (item) =>
            allowedPaymentIds.has(item.id) ||
            (item.order_id && allowedOrderIds.has(item.order_id)),
        );
      }

      // Convert rupees -> paise
      const minAmountInPaise =
        minAmount !== undefined
          ? Math.round(Number(minAmount) * 100)
          : undefined;

      const maxAmountInPaise =
        maxAmount !== undefined
          ? Math.round(Number(maxAmount) * 100)
          : undefined;

      const minRefundedInPaise =
        minAmountRefunded !== undefined
          ? Math.round(Number(minAmountRefunded) * 100)
          : undefined;

      const maxRefundedInPaise =
        maxAmountRefunded !== undefined
          ? Math.round(Number(maxAmountRefunded) * 100)
          : undefined;

      // Amount filters
      if (minAmountInPaise !== undefined) {
        items = items.filter((item) => Number(item.amount) >= minAmountInPaise);
      }

      if (maxAmountInPaise !== undefined) {
        items = items.filter((item) => Number(item.amount) <= maxAmountInPaise);
      }

      // Refunded amount filters
      if (minRefundedInPaise !== undefined) {
        items = items.filter(
          (item) => Number(item.amount_refunded ?? 0) >= minRefundedInPaise,
        );
      }

      if (maxRefundedInPaise !== undefined) {
        items = items.filter(
          (item) => Number(item.amount_refunded ?? 0) <= maxRefundedInPaise,
        );
      }

      // Captured filter
      if (query.captured !== undefined) {
        const captured = query.captured === BooleanEnum.TRUE;

        items = items.filter((item) => item.captured === captured);
      }

      // International filter
      if (query.international !== undefined) {
        const international = query.international === BooleanEnum.TRUE;

        items = items.filter((item) => item.international === international);
      }

      // Refund status filter
      if (query.refund_status) {
        items = items.filter(
          (item) => item.refund_status === query.refund_status,
        );
      }

      // Entity filter
      if (query.entity) {
        items = items.filter((item) => item.entity === query.entity);
      }

      // Method filter
      if (query.method) {
        items = items.filter((item) => item.method === query.method);
      }

      // Transform response
      const transformed = items.map((item) => ({
        payment_id: item.id,
        entity: item.entity,
        currency: item.currency,
        status: item.status,
        order_id: item.order_id,
        invoice_id: item.invoice_id,
        international: item.international,
        method: item.method,

        amount_rupees: fromPaise(Number(item.amount)),
        amount_refunded_rupees: fromPaise(Number(item.amount_refunded || 0)),
        fee_rupees: fromPaise(Number(item.fee || 0)),
        tax_rupees: fromPaise(Number(item.tax || 0)),

        amount_paisa: item.amount,
        amount_refunded_paisa: item.amount_refunded,
        fee_paisa: item.fee,
        tax_paisa: item.tax,

        refund_status: item.refund_status,
        captured: item.captured,
        description: item.description,

        card_id: item.card_id,
        bank: item.bank,
        wallet: item.wallet,
        vpa: item.vpa,

        email: item.email,
        contact: item.contact,

        notes: item.notes,

        error_code: item.error_code,
        error_description: item.error_description,
        error_source: item.error_source,
        error_step: item.error_step,
        error_reason: item.error_reason,

        created_at_readable: new Date(item.created_at * 1000).toLocaleString(
          'en-IN',
          {
            timeZone: 'Asia/Kolkata',
          },
        ),

        created_at_iso: new Date(item.created_at * 1000).toISOString(),
      }));

      return {
        data: transformed,

        meta: {
          source: 'Razorpay',

          count: transformed.length,

          page,

          limit,

          totalPages: transformed.length < limit ? page : page + 1,

          summary: {
            totalAmount:
              transformed.reduce(
                (acc, item) => acc + Number(item.amount_paisa || 0),
                0,
              ) / 100,

            totalRefunded:
              transformed.reduce(
                (acc, item) => acc + Number(item.amount_refunded_paisa || 0),
                0,
              ) / 100,
          },
        },
      };
    } catch (error) {
      this.handleError(error, 'Fetch transactions');
    }
  }

  async refundPayment(dto: PaymentRefundDto, user?: JwtUser, ip?: string) {
    try {
      const { paymentId, amount } = dto;

      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: amount ? toPaise(amount) : undefined,
      });

      const financialEvent = await this.prisma.financialEvent.findFirst({
        where: {
          OR: [
            { razorpayPaymentId: paymentId },
            { razorpayOrderId: paymentId },
          ],
        },
      });
      const metadata = financialEvent?.metadata as any;

      if (user) {
        fireAndForget(
          this.audit.log({
            userId: user.sub,
            action: 'PAYMENT_REFUND',
            resource: 'PAYMENT',
            resourceId: paymentId,
            metadata: {
              refundId: refund.id,
              amount,
              franchiseId: metadata?.franchiseId,
              ...metadata,
            },
            ip,
          }),
          'PAYMENT_REFUND',
        );
      }

      return refund;
    } catch (error) {
      this.handleError(error, 'Refund');
    }
  }

  // 🔹 Customers
  async createCustomer(
    name: string,
    email: string,
    contact: string,
    user?: JwtUser,
    ip?: string,
  ) {
    try {
      const result = await this.razorpay.customers.create({
        name,
        email,
        contact,
      });

      if (user) {
        const franchiseId =
          user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId;

        fireAndForget(
          this.audit.log({
            userId: user.sub,
            action: 'CUSTOMER_CREATE',
            resource: 'Customer',
            resourceId: result.id,
            metadata: { name, email, contact, franchiseId },
            ip,
          }),
          'CUSTOMER_CREATE',
        );
      }

      return result;
    } catch (error) {
      this.handleError(error, 'Customer creation');
    }
  }

  async fetchCustomer(customerId: string) {
    try {
      return await this.razorpay.customers.fetch(customerId);
    } catch (error) {
      this.handleError(error, 'Customer fetch');
    }
  }

  // 🔹 Subscriptions
  async createSubscription(
    planId: string,
    customerId: string,
    user?: JwtUser,
    ip?: string,
  ) {
    console.log(
      'Creating subscription for planId:',
      planId,
      'customerId:',
      customerId,
    );
    try {
      const result = await this.razorpay.subscriptions.create({
        plan_id: planId,
        customer_notify: 1,
        total_count: 12,
      });

      if (user) {
        const franchiseId =
          user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId;

        fireAndForget(
          this.audit.log({
            userId: user.sub,
            action: 'SUBSCRIPTION_CREATE',
            resource: 'Payment',
            resourceId: result.id,
            metadata: { planId, customerId, franchiseId },
            ip,
          }),
          'SUBSCRIPTION_CREATE',
        );
      }

      return {
        ...result,
        customerId,
        message:
          'Subscription created successfully. Customer notification sent.',
      };
    } catch (error) {
      this.handleError(error, 'Subscription creation');
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    user?: JwtUser,
    ip?: string,
  ) {
    try {
      const result = await this.razorpay.subscriptions.cancel(subscriptionId);

      if (user) {
        const franchiseId =
          user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId;

        fireAndForget(
          this.audit.log({
            userId: user.sub,
            action: 'SUBSCRIPTION_CANCEL',
            resource: 'Payment',
            resourceId: subscriptionId,
            metadata: { franchiseId },
            ip,
          }),
          'SUBSCRIPTION_CANCEL',
        );
      }

      return result;
    } catch (error) {
      this.handleError(error, 'Subscription cancel');
    }
  }

  // 🔹 Invoices
  async createInvoice(dto: CreateInvoiceDto, user?: JwtUser, ip?: string) {
    try {
      const result = await this.razorpay.invoices.create({
        type: dto.type,

        date: Math.floor(Date.now() / 1000),

        customer: {
          name: dto.customer.name,
          email: dto.customer.email,
          contact: dto.customer.contact,
        },

        line_items: dto.line_items.map((item) => ({
          name: item.name,
          description: item.description,
          amount: toPaise(item.amount),
          currency: item.currency,
          quantity: item.quantity,
        })),
      });

      if (user) {
        const franchiseId =
          user.role === Role.FRANCHISE_STAFF
            ? user.franchiseOwnerId
            : user.franchiseId;

        fireAndForget(
          this.audit.log({
            userId: user.sub,
            action: 'INVOICE_CREATE',
            resource: 'Payment',
            resourceId: result.id,
            metadata: JSON.parse(JSON.stringify({ ...dto, franchiseId })),
            ip,
          }),
          'INVOICE_CREATE',
        );
      }

      return {
        invoice_id: result.id,
        entity: result.entity,
        receipt: result.receipt,
        invoice_number: result.invoice_number,
        customer_id: result.customer_id,
        customer_details: result.customer_details,
        order_id: result.order_id,
        line_items: result.line_items.map((item) => ({
          id: item.id,
          item_id: item.item_id,
          ref_id: item.ref_id,
          ref_type: item.ref_type,
          name: item.name,
          description: item.description,
          amount: item.amount,
          amount_rupees: fromPaise(Number(item.amount)),
          unit_amount: item.unit_amount,
          unit_amount_rupees: fromPaise(Number(item.unit_amount)),
          gross_amount: item.gross_amount,
          gross_amount_rupees: fromPaise(Number(item.gross_amount)),
          tax_amount: item.tax_amount,
          taxable_amount: item.taxable_amount,
          taxable_amount_rupees: fromPaise(Number(item.taxable_amount)),
          net_amount: item.net_amount,
          net_amount_rupees: fromPaise(Number(item.net_amount)),
          currency: item.currency,
          type: item.type,
          tax_inclusive: item.tax_inclusive,
          hsn_code: item.hsn_code,
          sac_code: item.sac_code,
          tax_rate: item.tax_rate,
          unit: item.unit,
          quantity: item.quantity,
          taxes: item.taxes.map((tax) => ({
            name: tax.name,
            amount: tax.amount,
            amount_rupees: fromPaise(Number(tax.amount)),
            currency: tax.currency,
            tax_rate: tax.tax_rate,
          })),
        })),
        payment_id: result.payment_id,
        status: result.status,
        expire_by: result.expire_by,
        issued_at: result.issued_at,
        paid_at: result.paid_at,
        cancelled_at: result.cancelled_at,
        expired_at: result.expired_at,
        sms_status: result.sms_status,
        email_status: result.email_status,
        date: result.date,
        terms: result.terms,
        partial_payment: result.partial_payment,
        gross_amount: result.gross_amount,
        tax_amount: result.tax_amount,
        taxable_amount: result.taxable_amount,
        amount: result.amount,
        amount_paid: result.amount_paid,
        amount_due: result.amount_due,
        currency: result.currency,
        currency_symbol: result.currency_symbol,
        description: result.description,
        notes: result.notes,
        comment: result.comment,
        short_url: result.short_url,
        view_less: result.view_less,
        billing_start: result.billing_start,
        billing_end: result.billing_end,
        type: result.type,
        group_taxes_discounts: result.group_taxes_discounts,
        created_at: result.created_at,
        idempotency_key: result.idempotency_key,
        ref_num: result.ref_num,
      };
    } catch (error: any) {
      console.log('========== RAZORPAY ERROR ==========');

      console.dir(
        {
          message: error?.message,
          description: error?.error?.description,
          statusCode: error?.statusCode,
          error,
        },
        { depth: null },
      );

      console.log(
        JSON.stringify(
          {
            type: dto.type,
            customer: dto.customer,
            line_items: dto.line_items,
          },
          null,
          2,
        ),
      );
      throw new BadRequestException(
        error?.error?.description ||
        error?.description ||
        error?.message ||
        'Invoice creation failed',
      );
    }
  }

  async fetchInvoices(user?: JwtUser) {
    try {
      const result = await this.razorpay.invoices.all();

      let transformed = result.items.map((item) => ({
        invoice_id: item.id,

        entity: item.entity,

        status: item.status,

        currency: item.currency,

        amount_paisa: item.amount,

        amount_paid_paisa: item.amount_paid,

        amount_due_paisa: item.amount_due,

        amount_rupees: fromPaise(Number(item.amount || 0)),

        amount_paid_rupees: fromPaise(Number(item.amount_paid || 0)),

        amount_due_rupees: fromPaise(Number(item.amount_due || 0)),

        order_id: item.order_id,

        receipt: item.receipt,

        customer_id: item.customer_id,

        customer_name: item.customer_details?.name,

        customer_email: item.customer_details?.email,

        customer_contact: item.customer_details?.contact,

        description: item.description,

        issued_at_readable: item.issued_at
          ? new Date(item.issued_at * 1000).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
          })
          : null,

        expire_by_readable: item.expire_by
          ? new Date(item.expire_by * 1000).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
          })
          : null,

        created_at_readable: new Date(item.created_at * 1000).toLocaleString(
          'en-IN',
          {
            timeZone: 'Asia/Kolkata',
          },
        ),

        created_at_iso: new Date(item.created_at * 1000).toISOString(),
      }));

      if (
        user &&
        user.role !== Role.SUPERADMIN &&
        user.role !== Role.ADMIN_STAFF
      ) {
        const isFranchise =
          user.role === Role.FRANCHISE_OWNER ||
          user.role === Role.FRANCHISE_STAFF;
        if (isFranchise) {
          const franchiseId =
            user.role === Role.FRANCHISE_STAFF
              ? user.franchiseOwnerId
              : user.franchiseId;
          const orders = await this.prisma.order.findMany({
            where: { franchiseId },
            select: { id: true, orderNumber: true },
          });
          const stockRequests = await this.prisma.stockRequest.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          const franchise = await this.prisma.franchise.findUnique({
            where: { id: franchiseId },
            select: { ownerEmail: true, ownerPhone: true },
          });

          const orderIds = new Set(orders.map((o) => o.id));
          const orderNumbers = new Set(orders.map((o) => o.orderNumber));
          const stockRequestIds = new Set(stockRequests.map((sr) => sr.id));

          const financialEvents = await this.prisma.financialEvent.findMany({
            where: {
              OR: [
                {
                  metadata: {
                    path: ['franchiseId'],
                    equals: franchiseId,
                  },
                },
                {
                  ledgerEntries: {
                    some: {
                      actorType: 'FRANCHISE',
                      actorId: franchiseId,
                    },
                  },
                },
              ],
            },
            select: { razorpayOrderId: true },
          });
          const allowedRazorpayOrderIds = new Set(
            financialEvents.map((fe) => fe.razorpayOrderId).filter(Boolean),
          );

          transformed = transformed.filter((item) => {
            const invoiceContactClean = item.customer_contact
              ? String(item.customer_contact).replace(/\s+/g, '').slice(-10)
              : undefined;
            const ownerPhoneClean = franchise?.ownerPhone
              ? String(franchise.ownerPhone).replace(/\s+/g, '').slice(-10)
              : undefined;

            return (
              (item.order_id && allowedRazorpayOrderIds.has(item.order_id)) ||
              (item.receipt && orderIds.has(item.receipt)) ||
              (item.receipt && orderNumbers.has(item.receipt)) ||
              (item.receipt && stockRequestIds.has(item.receipt)) ||
              item.customer_email === franchise?.ownerEmail ||
              (invoiceContactClean &&
                ownerPhoneClean &&
                invoiceContactClean === ownerPhoneClean)
            );
          });
        } else {
          // Customer
          const orders = await this.prisma.order.findMany({
            where: { customerId: user.sub },
            select: { id: true, orderNumber: true },
          });
          const customerUser = await this.prisma.user.findUnique({
            where: { id: user.sub },
            select: {
              email: true,
              customer: {
                select: {
                  phone: true,
                },
              },
            },
          });
          const customerPhone = customerUser?.customer?.phone;

          const orderIds = new Set(orders.map((o) => o.id));
          const orderNumbers = new Set(orders.map((o) => o.orderNumber));

          const financialEvents = await this.prisma.financialEvent.findMany({
            where: {
              metadata: {
                path: ['customerId'],
                equals: user.sub,
              },
            },
            select: { razorpayOrderId: true },
          });
          const allowedRazorpayOrderIds = new Set(
            financialEvents.map((fe) => fe.razorpayOrderId).filter(Boolean),
          );

          transformed = transformed.filter((item) => {
            const invoiceContactClean = item.customer_contact
              ? String(item.customer_contact).replace(/\s+/g, '').slice(-10)
              : undefined;
            const customerPhoneClean = customerPhone
              ? String(customerPhone).replace(/\s+/g, '').slice(-10)
              : undefined;

            return (
              (item.order_id && allowedRazorpayOrderIds.has(item.order_id)) ||
              (item.receipt && orderIds.has(item.receipt)) ||
              (item.receipt && orderNumbers.has(item.receipt)) ||
              item.customer_email === customerUser?.email ||
              (invoiceContactClean &&
                customerPhoneClean &&
                invoiceContactClean === customerPhoneClean)
            );
          });
        }
      }

      return {
        data: transformed,

        meta: {
          source: 'Razorpay',

          count: transformed.length,

          summary: {
            totalAmount:
              transformed.reduce(
                (acc, item) => acc + Number(item.amount_paisa || 0),
                0,
              ) / 100,

            totalPaid:
              transformed.reduce(
                (acc, item) => acc + Number(item.amount_paid_paisa || 0),
                0,
              ) / 100,

            totalDue:
              transformed.reduce(
                (acc, item) => acc + Number(item.amount_due_paisa || 0),
                0,
              ) / 100,
          },
        },
      };
    } catch (error) {
      this.handleError(error, 'Invoice fetch');
    }
  }

  async fetchInvoice(invoiceId: string, user?: JwtUser) {
    try {
      const result = await this.razorpay.invoices.fetch(invoiceId);

      if (
        user &&
        user.role !== Role.SUPERADMIN &&
        user.role !== Role.ADMIN_STAFF
      ) {
        const isFranchise =
          user.role === Role.FRANCHISE_OWNER ||
          user.role === Role.FRANCHISE_STAFF;
        let allowed = false;

        if (isFranchise) {
          const franchiseId =
            user.role === Role.FRANCHISE_STAFF
              ? user.franchiseOwnerId
              : user.franchiseId;
          const orders = await this.prisma.order.findMany({
            where: { franchiseId },
            select: { id: true, orderNumber: true },
          });
          const stockRequests = await this.prisma.stockRequest.findMany({
            where: { franchiseId },
            select: { id: true },
          });
          const franchise = await this.prisma.franchise.findUnique({
            where: { id: franchiseId },
            select: { ownerEmail: true, ownerPhone: true },
          });

          const orderIds = new Set(orders.map((o) => o.id));
          const orderNumbers = new Set(orders.map((o) => o.orderNumber));
          const stockRequestIds = new Set(stockRequests.map((sr) => sr.id));

          const financialEvents = await this.prisma.financialEvent.findMany({
            where: {
              OR: [
                {
                  metadata: {
                    path: ['franchiseId'],
                    equals: franchiseId,
                  },
                },
                {
                  ledgerEntries: {
                    some: {
                      actorType: 'FRANCHISE',
                      actorId: franchiseId,
                    },
                  },
                },
              ],
            },
            select: { razorpayOrderId: true },
          });
          const allowedRazorpayOrderIds = new Set(
            financialEvents.map((fe) => fe.razorpayOrderId).filter(Boolean),
          );

          const invoiceContactClean = result.customer_details?.contact
            ? String(result.customer_details.contact)
              .replace(/\s+/g, '')
              .slice(-10)
            : undefined;
          const ownerPhoneClean = franchise?.ownerPhone
            ? String(franchise.ownerPhone).replace(/\s+/g, '').slice(-10)
            : undefined;

          if (
            (result.order_id && allowedRazorpayOrderIds.has(result.order_id)) ||
            (result.receipt && orderIds.has(result.receipt)) ||
            (result.receipt && orderNumbers.has(result.receipt)) ||
            (result.receipt && stockRequestIds.has(result.receipt)) ||
            result.customer_details?.email === franchise?.ownerEmail ||
            (invoiceContactClean &&
              ownerPhoneClean &&
              invoiceContactClean === ownerPhoneClean)
          ) {
            allowed = true;
          }
        } else {
          // Customer
          const orders = await this.prisma.order.findMany({
            where: { customerId: user.sub },
            select: { id: true, orderNumber: true },
          });
          const customerUser = await this.prisma.user.findUnique({
            where: { id: user.sub },
            select: {
              email: true,
              customer: {
                select: {
                  phone: true,
                },
              },
            },
          });
          const customerPhone = customerUser?.customer?.phone;

          const orderIds = new Set(orders.map((o) => o.id));
          const orderNumbers = new Set(orders.map((o) => o.orderNumber));

          const financialEvents = await this.prisma.financialEvent.findMany({
            where: {
              metadata: {
                path: ['customerId'],
                equals: user.sub,
              },
            },
            select: { razorpayOrderId: true },
          });
          const allowedRazorpayOrderIds = new Set(
            financialEvents.map((fe) => fe.razorpayOrderId).filter(Boolean),
          );

          const invoiceContactClean = result.customer_details?.contact
            ? String(result.customer_details.contact)
              .replace(/\s+/g, '')
              .slice(-10)
            : undefined;
          const customerPhoneClean = customerPhone
            ? String(customerPhone).replace(/\s+/g, '').slice(-10)
            : undefined;

          if (
            (result.order_id && allowedRazorpayOrderIds.has(result.order_id)) ||
            (result.receipt && orderIds.has(result.receipt)) ||
            (result.receipt && orderNumbers.has(result.receipt)) ||
            result.customer_details?.email === customerUser?.email ||
            (invoiceContactClean &&
              customerPhoneClean &&
              invoiceContactClean === customerPhoneClean)
          ) {
            allowed = true;
          }
        }

        if (!allowed) {
          throw new ForbiddenException('Unauthorized to view this invoice');
        }
      }

      return {
        invoice_id: result.id,
        entity: result.entity,
        receipt: result.receipt,
        invoice_number: result.invoice_number,
        customer_id: result.customer_id,
        customer_details: result.customer_details,
        order_id: result.order_id,
        line_items: result.line_items.map((item) => ({
          id: item.id,
          item_id: item.item_id,
          ref_id: item.ref_id,
          ref_type: item.ref_type,
          name: item.name,
          description: item.description,
          amount: item.amount,
          amount_rupees: fromPaise(Number(item.amount)),
          unit_amount: item.unit_amount,
          unit_amount_rupees: fromPaise(Number(item.unit_amount)),
          gross_amount: item.gross_amount,
          gross_amount_rupees: fromPaise(Number(item.gross_amount)),
          tax_amount: item.tax_amount,
          taxable_amount: item.taxable_amount,
          taxable_amount_rupees: fromPaise(Number(item.taxable_amount)),
          net_amount: item.net_amount,
          net_amount_rupees: fromPaise(Number(item.net_amount)),
          currency: item.currency,
          type: item.type,
          tax_inclusive: item.tax_inclusive,
          hsn_code: item.hsn_code,
          sac_code: item.sac_code,
          tax_rate: item.tax_rate,
          unit: item.unit,
          quantity: item.quantity,
          taxes: item.taxes.map((tax) => ({
            name: tax.name,
            amount: tax.amount,
            amount_rupees: fromPaise(Number(tax.amount)),
            currency: tax.currency,
            tax_rate: tax.tax_rate,
          })),
        })),
        payment_id: result.payment_id,
        status: result.status,
        expire_by: result.expire_by,
        issued_at: result.issued_at,
        paid_at: result.paid_at,
        cancelled_at: result.cancelled_at,
        expired_at: result.expired_at,
        sms_status: result.sms_status,
        email_status: result.email_status,
        date: result.date,
        terms: result.terms,
        partial_payment: result.partial_payment,
        gross_amount: result.gross_amount,
        tax_amount: result.tax_amount,
        taxable_amount: result.taxable_amount,
        amount: result.amount,
        amount_paid: result.amount_paid,
        amount_due: result.amount_due,
        currency: result.currency,
        currency_symbol: result.currency_symbol,
        description: result.description,
        notes: result.notes,
        comment: result.comment,
        short_url: result.short_url,
        view_less: result.view_less,
        billing_start: result.billing_start,
        billing_end: result.billing_end,
        type: result.type,
        group_taxes_discounts: result.group_taxes_discounts,
        created_at: result.created_at,
        idempotency_key: result.idempotency_key,
        ref_num: result.ref_num,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.handleError(error, 'Invoice fetch');
    }
  }
}
