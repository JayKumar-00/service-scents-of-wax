import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderStatus, OnlinePaymentStatus, OrderChannel } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReturnExchangeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a new exchange order based on the approved items in the return request.
   * Links the new exchange order ID to the ReturnRequest.
   * Runs inside a transaction context (tx).
   */
  async createExchangeOrder(tx: any, returnRequestId: string): Promise<any> {
    // 1. Load the ReturnRequest with items, exchangeItems, and original order
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

    if (!returnRequest.order) {
      throw new BadRequestException(
        'Cannot create exchange order without an original order reference.',
      );
    }

    const originalOrder = returnRequest.order;

    // Fetch the replacement exchangeItems
    const exchangeItems = returnRequest.exchangeItems;
    if (!exchangeItems || exchangeItems.length === 0) {
      throw new BadRequestException(
        'No replacement items selected for this exchange request.',
      );
    }

    // 2. Prepare order items for the new exchange order based on replacement items
    const newOrderItemsData: any[] = [];
    let exchangeTotal = new Prisma.Decimal(0);

    for (const exItem of exchangeItems) {
      const dbProduct = await tx.product.findUnique({
        where: { id: exItem.productId },
        include: {
          variants: true,
        },
      });

      if (!dbProduct) {
        throw new NotFoundException(`Product ${exItem.productId} not found.`);
      }

      let price = dbProduct.price;
      let mrpPrice = dbProduct.mrpPrice;
      let sku = dbProduct.slug;
      const productName = dbProduct.name;
      let variantName = null;
      let gstPercent = dbProduct.defaultGstRatePercent
        ? new Prisma.Decimal(dbProduct.defaultGstRatePercent)
        : new Prisma.Decimal(18);

      if (exItem.variantId) {
        const variant = dbProduct.variants.find(
          (v: any) => v.id === exItem.variantId,
        );
        if (!variant) {
          throw new NotFoundException(
            `Variant ${exItem.variantId} not found for product ${exItem.productId}`,
          );
        }
        price = variant.price;
        mrpPrice = variant.mrpPrice;
        sku = variant.sku;
        variantName = variant.attributeSummary;
        gstPercent = new Prisma.Decimal(variant.gstTax ?? 18);
      }

      const qty = exItem.quantity;
      const unitPrice = new Prisma.Decimal(price);
      const mrpPriceDec = mrpPrice ? new Prisma.Decimal(mrpPrice) : null;

      // Compute tax and final totals
      const lineSubtotal = unitPrice.mul(qty);
      const taxAmount = lineSubtotal
        .mul(gstPercent.div(100))
        .toDecimalPlaces(2);
      const finalAmount = lineSubtotal.add(taxAmount);

      exchangeTotal = exchangeTotal.add(finalAmount);

      newOrderItemsData.push({
        productId: exItem.productId,
        variantId: exItem.variantId ?? null,
        quantity: qty,
        unitPrice: unitPrice,
        mrpPrice: mrpPriceDec,
        productName: productName,
        sku: sku,
        variantName: variantName,
        gstPercent: gstPercent,
        discountAmount: new Prisma.Decimal(0),
        taxAmount: taxAmount,
        finalAmount: finalAmount,
        imageUrl: dbProduct.imageUrl,
      });
    }

    // Generate unique order number and invoice number
    const uniqueId = Date.now().toString(36).toUpperCase();
    const orderNumber = `GF-EX-${uniqueId}`;
    const invoiceNumber = originalOrder.invoiceNumber
      ? `POS-EX-${originalOrder.franchiseId}-${uniqueId}`
      : null;

    // 3. Create the exchange order record
    const exchangeOrder = await tx.order.create({
      data: {
        orderNumber,
        status: OrderStatus.CONFIRMED, // Exchange orders start as confirmed
        channel: originalOrder.channel,
        saleType: originalOrder.saleType,
        franchiseId: originalOrder.franchiseId,
        customerId: originalOrder.customerId,
        retailCustomerId: originalOrder.retailCustomerId,
        total: exchangeTotal,
        latitude: originalOrder.latitude,
        longitude: originalOrder.longitude,
        addressJson: originalOrder.addressJson,
        giftMessage: `Exchange Order for Return Request #${returnRequest.returnNumber}`,
        giftWrap: originalOrder.giftWrap,
        giftWrapperFee: originalOrder.giftWrapperFee,
        invoiceNumber,
        paymentMode: originalOrder.paymentMode,
        onlinePaymentStatus: OnlinePaymentStatus.PAID, // Set to paid as the exchange balance is settled
        soldByUserId: returnRequest.requestedById,
        franchisePaybleAmount: exchangeTotal,
        items: {
          create: newOrderItemsData,
        },
      },
    });

    // 4. Update the return request with the exchange order ID
    await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        exchangeOrderId: exchangeOrder.id,
      },
    });

    return exchangeOrder;
  }
}
