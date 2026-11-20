import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CreateCreditNoteDto } from '../dto/credit-note.dto';
import {
  InvoiceType,
  ReturnStatus,
  ReturnType,
  InvoiceStatus,
  InvoicePaymentStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CreditNoteService {
  constructor(private readonly prisma: PrismaService) {}

  async createCreditNote(
    invoiceNumber: string | null | undefined,
    dto: CreateCreditNoteDto,
    user: JwtUser,
    tx?: Prisma.TransactionClient,
  ) {
    const execute = async (transactionClient: Prisma.TransactionClient) => {
      // 1. Fetch Return Request
      const returnRequest = await transactionClient.returnRequest.findUnique({
        where: { id: dto.returnRequestId },
        include: {
          items: true,
          order: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!returnRequest) {
        throw new NotFoundException(
          `Return request ${dto.returnRequestId} not found.`,
        );
      }

      if (returnRequest.returnType !== ReturnType.REFUND) {
        throw new BadRequestException(
          'Credit Notes can only be generated for REFUND return requests.',
        );
      }

      if (returnRequest.status !== ReturnStatus.QC_PASSED) {
        throw new BadRequestException(
          `Return request must be in QC_PASSED status. Current: ${returnRequest.status}`,
        );
      }

      // Check if Credit Note already exists for this return request
      const existingCN = await transactionClient.invoice.findFirst({
        where: {
          returnRequestId: returnRequest.id,
          type: InvoiceType.CREDIT_NOTE,
          isDeleted: false,
        },
      });

      if (existingCN) {
        throw new BadRequestException(
          'A Credit Note has already been generated for this return request.',
        );
      }

      // 2. Fetch original Payment Invoice internally via orderId relationships
      const originalInvoice = await transactionClient.invoice.findFirst({
        where: {
          orderId: returnRequest.orderId,
          type: InvoiceType.PAYMENT,
          isDeleted: false,
        },
      });

      if (!originalInvoice) {
        throw new NotFoundException(
          `Original payment invoice for return request ${dto.returnRequestId} and order ${returnRequest.orderId} not found.`,
        );
      }

      if (originalInvoice.type !== InvoiceType.PAYMENT) {
        throw new BadRequestException(
          'Credit Note must be linked to a PAYMENT invoice.',
        );
      }

      // 3. Calculate adjustment details from approved return items
      const creditedItems: any[] = [];
      let subtotal = new Prisma.Decimal(0);
      let gstAmount = new Prisma.Decimal(0);

      for (const retItem of returnRequest.items) {
        const approvedQty = retItem.approvedQty ?? 0;
        if (approvedQty <= 0) continue;

        // Find corresponding item in original order to get correct price and tax snapshot
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

        subtotal = subtotal.add(lineSubtotal);
        gstAmount = gstAmount.add(lineTax);

        creditedItems.push({
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

      if (creditedItems.length === 0) {
        throw new BadRequestException(
          'No approved items with positive quantity found for Credit Note.',
        );
      }

      const grandTotal = subtotal.add(gstAmount);

      // 4. Generate unique Credit Note number
      const cnNumber = await this.generateUniqueDocNumber(
        'GFCN',
        transactionClient,
      );

      // 5. Create Credit Note record
      const creditNote = await transactionClient.invoice.create({
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
          items: creditedItems,
          subtotal,
          gst: gstAmount,
          grandTotal,
          paymentStatus: InvoicePaymentStatus.PENDING,
          status: InvoiceStatus.GENERATED,
          returnRequest: returnRequest.id
            ? { connect: { id: returnRequest.id } }
            : undefined,
        },
      });

      // 6. Transition Return Request status to CREDIT_NOTE_GENERATED
      await transactionClient.returnRequest.update({
        where: { id: returnRequest.id },
        data: { status: ReturnStatus.CREDIT_NOTE_GENERATED },
      });

      return creditNote;
    };

    if (tx) {
      return execute(tx);
    } else {
      return this.prisma.$transaction(execute);
    }
  }

  async getCreditNote(id: string) {
    const cn = await this.prisma.invoice.findFirst({
      where: {
        id,
        type: InvoiceType.CREDIT_NOTE,
        isDeleted: false,
      },
    });

    if (!cn) {
      throw new NotFoundException(`Credit Note with ID ${id} not found.`);
    }

    return cn;
  }

  async listCreditNotes(user: JwtUser) {
    return this.prisma.invoice.findMany({
      where: {
        type: InvoiceType.CREDIT_NOTE,
        isDeleted: false,
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getLedger(invoiceId: string) {
    const paymentInvoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        order: true,
      },
    });

    if (!paymentInvoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found.`);
    }

    const subDocuments = await this.prisma.invoice.findMany({
      where: {
        parentInvoiceId: invoiceId,
        isDeleted: false,
      },
      orderBy: { issuedAt: 'asc' },
    });

    const creditNotes = subDocuments.filter(
      (doc) => doc.type === InvoiceType.CREDIT_NOTE,
    );
    const refundReceipts = subDocuments.filter(
      (doc) => doc.type === InvoiceType.REFUND_RECEIPT,
    );
    const exchangeMemos = subDocuments.filter(
      (doc) => doc.type === InvoiceType.EXCHANGE_MEMO,
    );
    const exchangeReceipts = subDocuments.filter(
      (doc) => doc.type === InvoiceType.EXCHANGE_RECEIPT,
    );

    const refunds = await this.prisma.refund.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'asc' },
    });

    const returns = paymentInvoice.orderId
      ? await this.prisma.returnRequest.findMany({
          where: { orderId: paymentInvoice.orderId },
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    return {
      paymentInvoice,
      creditNotes,
      refunds,
      refundReceipts,
      exchangeMemos,
      exchangeReceipts,
      returns,
    };
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
}
