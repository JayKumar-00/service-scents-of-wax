import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReturnExchangeService } from '../../returns-v2/services/return-exchange.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CreateExchangeMemoDto } from '../dto/exchange-memo.dto';
import {
  InvoiceType,
  ReturnStatus,
  ReturnType,
  InvoiceStatus,
  InvoicePaymentStatus,
  RefundStatus,
  RefundMethod,
  PaymentModeEnum,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExchangeExtensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly returnExchangeService: ReturnExchangeService,
  ) {}

  async createExchangeMemo(
    returnRequestId: string,
    dto: CreateExchangeMemoDto,
    user: JwtUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch Return Request
      const returnRequest = await tx.returnRequest.findUnique({
        where: { id: returnRequestId },
        include: {
          items: true,
          exchangeItems: true,
          order: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!returnRequest) {
        throw new NotFoundException(
          `Return request ${returnRequestId} not found.`,
        );
      }

      if (
        returnRequest.returnType !== ReturnType.EXCHANGE &&
        returnRequest.returnType !== ReturnType.SAME_PRODUCT_EXCHANGE
      ) {
        throw new BadRequestException(
          'Exchange documents can only be generated for EXCHANGE or SAME_PRODUCT_EXCHANGE return requests.',
        );
      }

      // Allow generating if status is QC_PASSED or EXCHANGE_ORDER_CREATED
      if (
        returnRequest.status !== ReturnStatus.QC_PASSED &&
        returnRequest.status !== ReturnStatus.EXCHANGE_ORDER_CREATED
      ) {
        throw new BadRequestException(
          `Return request must be in QC_PASSED or EXCHANGE_ORDER_CREATED status. Current: ${returnRequest.status}`,
        );
      }

      // Check if Exchange Memo or Exchange Receipt already exists for this return request
      const existingMemoOrReceipt = await tx.invoice.findFirst({
        where: {
          returnRequestId: returnRequest.id,
          type: {
            in: [InvoiceType.EXCHANGE_MEMO, InvoiceType.EXCHANGE_RECEIPT],
          },
          isDeleted: false,
        },
      });

      if (existingMemoOrReceipt) {
        throw new BadRequestException(
          'Exchange documents have already been generated for this return request.',
        );
      }

      // 2. Fetch original Payment Invoice
      const originalInvoice = await tx.invoice.findFirst({
        where: {
          orderId: returnRequest.orderId,
          type: InvoiceType.PAYMENT,
          isDeleted: false,
        },
      });

      if (!originalInvoice) {
        throw new NotFoundException(
          `Original invoice for return request ${returnRequestId} not found.`,
        );
      }

      // 3. Ensure exchange order is created
      let exchangeOrderId = returnRequest.exchangeOrderId;
      let exchangeOrder;

      if (!exchangeOrderId) {
        // Create the exchange order via ReturnExchangeService
        exchangeOrder = await this.returnExchangeService.createExchangeOrder(
          tx,
          returnRequestId,
        );
        exchangeOrderId = exchangeOrder.id;
      } else {
        exchangeOrder = await tx.order.findUnique({
          where: { id: exchangeOrderId },
          include: { items: true },
        });
      }

      if (!exchangeOrder) {
        throw new NotFoundException(
          `Exchange order ${exchangeOrderId} not found.`,
        );
      }

      // Fetch exchange order items if not loaded
      if (!exchangeOrder.items) {
        exchangeOrder = await tx.order.findUnique({
          where: { id: exchangeOrderId },
          include: { items: true },
        });
      }

      const isSameProduct =
        returnRequest.returnType === ReturnType.SAME_PRODUCT_EXCHANGE;

      // Map exchange order items to snapshot array
      const replacementItems = (exchangeOrder.items || []).map((item: any) => ({
        productId: item.productId,
        variantId: item.variantId,
        title: item.productName || 'Product',
        variantName: item.variantName,
        sku: item.sku || '',
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice).toNumber(),
        discount: new Prisma.Decimal(item.discountAmount ?? 0).toNumber(),
        taxableAmount: new Prisma.Decimal(item.finalAmount ?? 0)
          .sub(new Prisma.Decimal(item.taxAmount ?? 0))
          .toNumber(),
        gstRate: new Prisma.Decimal(item.gstPercent ?? 18).toNumber(),
        totalAmount: new Prisma.Decimal(item.finalAmount ?? 0).toNumber(),
      }));

      if (isSameProduct) {
        // --- SAME PRODUCT EXCHANGE ---
        // Generates EXCHANGE_RECEIPT, closes return request, no Credit Note or Refund.
        const receiptNumber = await this.generateUniqueDocNumber('GFER', tx);

        const exchangeReceipt = await tx.invoice.create({
          data: {
            invoiceNumber: receiptNumber,
            type: InvoiceType.EXCHANGE_RECEIPT,
            parentInvoice: originalInvoice.id
              ? { connect: { id: originalInvoice.id } }
              : undefined,
            order: exchangeOrderId
              ? { connect: { id: exchangeOrderId } }
              : undefined,
            stockRequest: originalInvoice.stockRequestId
              ? { connect: { id: originalInvoice.stockRequestId } }
              : undefined,
            buyerName: originalInvoice.buyerName,
            buyerPhone: originalInvoice.buyerPhone,
            buyerEmail: originalInvoice.buyerEmail,
            storeName: originalInvoice.storeName,
            latitude: originalInvoice.latitude,
            longitude: originalInvoice.longitude,
            billingAddress: originalInvoice.billingAddress ?? undefined,
            shippingAddress: originalInvoice.shippingAddress ?? undefined,
            pickupAddress: originalInvoice.pickupAddress ?? undefined,
            length: originalInvoice.length,
            breadth: originalInvoice.breadth,
            height: originalInvoice.height,
            weight: originalInvoice.weight,
            sellerGstin: originalInvoice.sellerGstin,
            buyerGstin: originalInvoice.buyerGstin,
            placeOfSupply: originalInvoice.placeOfSupply,
            shipmentPaymentMode: originalInvoice.shipmentPaymentMode,
            items: replacementItems,
            subtotal: exchangeOrder.total,
            gst: 0,
            grandTotal: exchangeOrder.total,
            paymentStatus: InvoicePaymentStatus.PAID,
            status: InvoiceStatus.DELIVERED,
            returnRequest: returnRequest.id
              ? { connect: { id: returnRequest.id } }
              : undefined,
          },
        });

        // Close Return Request
        await tx.returnRequest.update({
          where: { id: returnRequest.id },
          data: { status: ReturnStatus.CLOSED },
        });

        return {
          type: 'SAME_PRODUCT_EXCHANGE',
          exchangeReceipt,
        };
      } else {
        // --- DIFFERENT PRODUCT EXCHANGE ---
        // Calculate returned items value
        let returnedSubtotal = new Prisma.Decimal(0);
        let returnedGst = new Prisma.Decimal(0);
        const returnedItemsSnapshot: any[] = [];

        for (const retItem of returnRequest.items) {
          const approvedQty = retItem.approvedQty ?? 0;
          if (approvedQty <= 0) continue;

          const originalItem = returnRequest.order?.items.find(
            (oi: any) =>
              oi.productId === retItem.productId &&
              oi.variantId === retItem.variantId,
          );

          if (!originalItem) {
            throw new BadRequestException(
              `Returned item Product ID ${retItem.productId} not found in the original order.`,
            );
          }

          const unitPrice = new Prisma.Decimal(originalItem.unitPrice);
          const gstPercent =
            originalItem.gstPercent !== undefined &&
            originalItem.gstPercent !== null
              ? new Prisma.Decimal(originalItem.gstPercent)
              : new Prisma.Decimal(18);

          const lineSubtotal = unitPrice.mul(approvedQty);
          const lineTax = lineSubtotal
            .mul(gstPercent.div(100))
            .toDecimalPlaces(2);
          const lineTotal = lineSubtotal.add(lineTax);

          returnedSubtotal = returnedSubtotal.add(lineSubtotal);
          returnedGst = returnedGst.add(lineTax);

          returnedItemsSnapshot.push({
            productId: retItem.productId,
            variantId: retItem.variantId,
            title: originalItem.productName || 'Product',
            variantName: originalItem.variantName,
            sku: originalItem.sku || '',
            quantity: approvedQty,
            unitPrice: unitPrice.toNumber(),
            discount: 0,
            taxableAmount: lineSubtotal.toNumber(),
            gstRate: gstPercent.toNumber(),
            totalAmount: lineTotal.toNumber(),
          });
        }

        const returnedTotal = returnedSubtotal.add(returnedGst);
        const replacementTotal = new Prisma.Decimal(exchangeOrder.total);

        // Generate Exchange Memo (representing replacement value)
        const memoNumber = await this.generateUniqueDocNumber('GFEM', tx);
        const exchangeMemo = await tx.invoice.create({
          data: {
            invoiceNumber: memoNumber,
            type: InvoiceType.EXCHANGE_MEMO,
            parentInvoice: originalInvoice.id
              ? { connect: { id: originalInvoice.id } }
              : undefined,
            order: exchangeOrderId
              ? { connect: { id: exchangeOrderId } }
              : undefined,
            stockRequest: originalInvoice.stockRequestId
              ? { connect: { id: originalInvoice.stockRequestId } }
              : undefined,
            buyerName: originalInvoice.buyerName,
            buyerPhone: originalInvoice.buyerPhone,
            buyerEmail: originalInvoice.buyerEmail,
            storeName: originalInvoice.storeName,
            latitude: originalInvoice.latitude,
            longitude: originalInvoice.longitude,
            billingAddress: originalInvoice.billingAddress ?? undefined,
            shippingAddress: originalInvoice.shippingAddress ?? undefined,
            pickupAddress: originalInvoice.pickupAddress ?? undefined,
            length: originalInvoice.length,
            breadth: originalInvoice.breadth,
            height: originalInvoice.height,
            weight: originalInvoice.weight,
            sellerGstin: originalInvoice.sellerGstin,
            buyerGstin: originalInvoice.buyerGstin,
            placeOfSupply: originalInvoice.placeOfSupply,
            shipmentPaymentMode: originalInvoice.shipmentPaymentMode,
            items: replacementItems,
            subtotal: exchangeOrder.total, // replacement subtotal roughly equals total for invoice metadata
            gst: 0,
            grandTotal: replacementTotal,
            paymentStatus: InvoicePaymentStatus.PENDING,
            status: InvoiceStatus.GENERATED,
            returnRequest: returnRequest.id
              ? { connect: { id: returnRequest.id } }
              : undefined,
          },
        });

        if (replacementTotal.gte(returnedTotal)) {
          // --- HIGHER/EQUAL VALUE ---
          // Generate new payment invoice for difference
          const diffAmount = replacementTotal.sub(returnedTotal);
          const paymentNumber = await this.generateUniqueDocNumber('GFPI', tx);

          const paymentInvoice = await tx.invoice.create({
            data: {
              invoiceNumber: paymentNumber,
              type: InvoiceType.PAYMENT,
              parentInvoice: originalInvoice.id
                ? { connect: { id: originalInvoice.id } }
                : undefined,
              order: exchangeOrderId
                ? { connect: { id: exchangeOrderId } }
                : undefined,
              stockRequest: originalInvoice.stockRequestId
                ? { connect: { id: originalInvoice.stockRequestId } }
                : undefined,
              buyerName: originalInvoice.buyerName,
              buyerPhone: originalInvoice.buyerPhone,
              buyerEmail: originalInvoice.buyerEmail,
              storeName: originalInvoice.storeName,
              latitude: originalInvoice.latitude,
              longitude: originalInvoice.longitude,
              billingAddress: originalInvoice.billingAddress ?? undefined,
              shippingAddress: originalInvoice.shippingAddress ?? undefined,
              pickupAddress: originalInvoice.pickupAddress ?? undefined,
              length: originalInvoice.length,
              breadth: originalInvoice.breadth,
              height: originalInvoice.height,
              weight: originalInvoice.weight,
              sellerGstin: originalInvoice.sellerGstin,
              buyerGstin: originalInvoice.buyerGstin,
              placeOfSupply: originalInvoice.placeOfSupply,
              shipmentPaymentMode: originalInvoice.shipmentPaymentMode,
              items: [
                {
                  description: 'Exchange payment difference',
                  amount: diffAmount.toNumber(),
                },
              ],
              subtotal: diffAmount,
              gst: 0,
              grandTotal: diffAmount,
              paymentStatus: diffAmount.isZero()
                ? InvoicePaymentStatus.PAID
                : InvoicePaymentStatus.PENDING,
              status: InvoiceStatus.GENERATED,
              returnRequest: returnRequest.id
                ? { connect: { id: returnRequest.id } }
                : undefined,
            },
          });

          // Close Return Request
          await tx.returnRequest.update({
            where: { id: returnRequest.id },
            data: { status: ReturnStatus.CLOSED },
          });

          return {
            type: 'DIFFERENT_PRODUCT_HIGHER_OR_EQUAL',
            exchangeMemo,
            paymentInvoice,
          };
        } else {
          // --- LOWER VALUE ---
          // Generate new payment invoice for the replacement value (paid using return credit)
          const paymentNumber = await this.generateUniqueDocNumber('GFPI', tx);
          const paymentInvoice = await tx.invoice.create({
            data: {
              invoiceNumber: paymentNumber,
              type: InvoiceType.PAYMENT,
              parentInvoice: originalInvoice.id
                ? { connect: { id: originalInvoice.id } }
                : undefined,
              order: exchangeOrderId
                ? { connect: { id: exchangeOrderId } }
                : undefined,
              stockRequest: originalInvoice.stockRequestId
                ? { connect: { id: originalInvoice.stockRequestId } }
                : undefined,
              buyerName: originalInvoice.buyerName,
              buyerPhone: originalInvoice.buyerPhone,
              buyerEmail: originalInvoice.buyerEmail,
              storeName: originalInvoice.storeName,
              latitude: originalInvoice.latitude,
              longitude: originalInvoice.longitude,
              billingAddress: originalInvoice.billingAddress ?? undefined,
              shippingAddress: originalInvoice.shippingAddress ?? undefined,
              pickupAddress: originalInvoice.pickupAddress ?? undefined,
              length: originalInvoice.length,
              breadth: originalInvoice.breadth,
              height: originalInvoice.height,
              weight: originalInvoice.weight,
              sellerGstin: originalInvoice.sellerGstin,
              buyerGstin: originalInvoice.buyerGstin,
              placeOfSupply: originalInvoice.placeOfSupply,
              shipmentPaymentMode: originalInvoice.shipmentPaymentMode,
              items: replacementItems,
              subtotal: exchangeOrder.total,
              gst: 0,
              grandTotal: replacementTotal,
              paymentStatus: InvoicePaymentStatus.PAID,
              status: InvoiceStatus.GENERATED,
              returnRequest: returnRequest.id
                ? { connect: { id: returnRequest.id } }
                : undefined,
            },
          });

          // Generate CREDIT_NOTE for the returned value
          const cnNumber = await this.generateUniqueDocNumber('GFCN', tx);
          const creditNote = await tx.invoice.create({
            data: {
              invoiceNumber: cnNumber,
              type: InvoiceType.CREDIT_NOTE,
              parentInvoice: originalInvoice.id
                ? { connect: { id: originalInvoice.id } }
                : undefined,
              order: originalInvoice.orderId
                ? { connect: { id: originalInvoice.orderId } }
                : undefined,
              stockRequest: originalInvoice.stockRequestId
                ? { connect: { id: originalInvoice.stockRequestId } }
                : undefined,
              buyerName: originalInvoice.buyerName,
              buyerPhone: originalInvoice.buyerPhone,
              buyerEmail: originalInvoice.buyerEmail,
              storeName: originalInvoice.storeName,
              latitude: originalInvoice.latitude,
              longitude: originalInvoice.longitude,
              billingAddress: originalInvoice.billingAddress ?? undefined,
              shippingAddress: originalInvoice.shippingAddress ?? undefined,
              pickupAddress: originalInvoice.pickupAddress ?? undefined,
              length: originalInvoice.length,
              breadth: originalInvoice.breadth,
              height: originalInvoice.height,
              weight: originalInvoice.weight,
              sellerGstin: originalInvoice.sellerGstin,
              buyerGstin: originalInvoice.buyerGstin,
              placeOfSupply: originalInvoice.placeOfSupply,
              shipmentPaymentMode: originalInvoice.shipmentPaymentMode,
              items: returnedItemsSnapshot,
              subtotal: returnedSubtotal,
              gst: returnedGst,
              grandTotal: returnedTotal,
              paymentStatus: InvoicePaymentStatus.PENDING,
              status: InvoiceStatus.GENERATED,
              returnRequest: returnRequest.id
                ? { connect: { id: returnRequest.id } }
                : undefined,
            },
          });

          // Generate Refund for difference
          const refundDiff = returnedTotal.sub(replacementTotal);
          const refundNumber = await this.generateUniqueRefundNumber(tx);
          const refundMethod =
            returnRequest.order?.paymentMode === PaymentModeEnum.COD
              ? RefundMethod.UPI
              : RefundMethod.ORIGINAL_SOURCE;

          const refund = await tx.refund.create({
            data: {
              refundNumber,
              returnId: returnRequest.id,
              invoiceId: originalInvoice.id,
              creditNoteId: creditNote.id,
              amount: refundDiff,
              method: refundMethod,
              status: RefundStatus.PROCESSED,
              processedAt: new Date(),
              remarks: `Refund difference of ₹${refundDiff} for lower-value exchange.`,
            },
          });

          // Generate Refund Receipt for difference
          const receiptNumber = await this.generateUniqueDocNumber('GFRR', tx);
          const refundReceipt = await tx.invoice.create({
            data: {
              invoiceNumber: receiptNumber,
              type: InvoiceType.REFUND_RECEIPT,
              parentInvoice: originalInvoice.id
                ? { connect: { id: originalInvoice.id } }
                : undefined,
              order: exchangeOrderId
                ? { connect: { id: exchangeOrderId } }
                : undefined,
              stockRequest: originalInvoice.stockRequestId
                ? { connect: { id: originalInvoice.stockRequestId } }
                : undefined,
              buyerName: originalInvoice.buyerName,
              buyerPhone: originalInvoice.buyerPhone,
              buyerEmail: originalInvoice.buyerEmail,
              storeName: originalInvoice.storeName,
              latitude: originalInvoice.latitude,
              longitude: originalInvoice.longitude,
              billingAddress: originalInvoice.billingAddress ?? undefined,
              shippingAddress: originalInvoice.shippingAddress ?? undefined,
              pickupAddress: originalInvoice.pickupAddress ?? undefined,
              length: originalInvoice.length,
              breadth: originalInvoice.breadth,
              height: originalInvoice.height,
              weight: originalInvoice.weight,
              sellerGstin: originalInvoice.sellerGstin,
              buyerGstin: originalInvoice.buyerGstin,
              placeOfSupply: originalInvoice.placeOfSupply,
              shipmentPaymentMode: originalInvoice.shipmentPaymentMode,
              items: [
                {
                  refundNumber: refund.refundNumber,
                  refundAmount: refundDiff.toNumber(),
                  refundMethod,
                  processedAt: new Date().toISOString(),
                },
              ],
              subtotal: refundDiff,
              gst: 0,
              grandTotal: refundDiff,
              paymentStatus: InvoicePaymentStatus.PAID,
              status: InvoiceStatus.DELIVERED,
              returnRequest: returnRequest.id
                ? { connect: { id: returnRequest.id } }
                : undefined,
            },
          });

          // Close Return Request
          await tx.returnRequest.update({
            where: { id: returnRequest.id },
            data: { status: ReturnStatus.CLOSED },
          });

          return {
            type: 'DIFFERENT_PRODUCT_LOWER_VALUE',
            exchangeMemo,
            paymentInvoice,
            creditNote,
            refund,
            refundReceipt,
          };
        }
      }
    });
  }

  async getExchangeMemo(id: string) {
    const memo = await this.prisma.invoice.findFirst({
      where: {
        id,
        type: InvoiceType.EXCHANGE_MEMO,
        isDeleted: false,
      },
    });
    if (!memo) {
      throw new NotFoundException(`Exchange Memo with ID ${id} not found.`);
    }
    return memo;
  }

  async getExchangeReceipt(id: string) {
    const receipt = await this.prisma.invoice.findFirst({
      where: {
        id,
        type: InvoiceType.EXCHANGE_RECEIPT,
        isDeleted: false,
      },
    });
    if (!receipt) {
      throw new NotFoundException(`Exchange Receipt with ID ${id} not found.`);
    }
    return receipt;
  }

  async listExchangeMemos() {
    return this.prisma.invoice.findMany({
      where: {
        type: InvoiceType.EXCHANGE_MEMO,
        isDeleted: false,
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  private async generateUniqueDocNumber(
    prefix: string,
    tx: any,
  ): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    let isUnique = false;
    let docNumber = '';
    while (!isUnique) {
      const randomStr = randomBytes(3).toString('hex').toUpperCase();
      docNumber = `${prefix}-${dateStr}-${randomStr}`;

      const count = await tx.invoice.count({
        where: { invoiceNumber: docNumber },
      });
      if (count === 0) {
        isUnique = true;
      }
    }
    return docNumber;
  }

  private async generateUniqueRefundNumber(tx: any): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    let isUnique = false;
    let rfNumber = '';
    while (!isUnique) {
      const randomStr = randomBytes(3).toString('hex').toUpperCase();
      rfNumber = `GFRF-${dateStr}-${randomStr}`;

      const count = await tx.refund.count({
        where: { refundNumber: rfNumber },
      });
      if (count === 0) {
        isUnique = true;
      }
    }
    return rfNumber;
  }
}
