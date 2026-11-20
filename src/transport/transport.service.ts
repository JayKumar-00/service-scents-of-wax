import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransportShipmentDto } from './dto/custom-order.dto';
import {
  TransportShipmentOrderIDPayload,
  TransportShipmentOrderIDResult,
} from './interfaces/shiprocket.interface';
import { ShiprocketService } from './shiprocket.service';
import {
  CreateShipmentDto,
  ShipmentPaymentMode as DtoShipmentPaymentMode,
  ShipmentOrderType,
} from './dto/create-shipment.dto';
import {
  InvoiceStatus,
  Prisma,
  ShipmentPaymentMode,
  ShipmentStatus,
} from '@prisma/client';
import { AuditService } from 'src/audit/audit.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';

type InvoiceAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  zipCode: string;
  state: string;
  country?: string;
};

type InvoiceItemSnapshot = {
  title?: string;
  sku?: string;
  quantity?: number;
  unitPrice?: number | string;
  discount?: number | string;
};

@Injectable()
export class TransportService {
  private readonly logger = new Logger(TransportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shiprocket: ShiprocketService,
    private readonly audit: AuditService,
  ) {}

  private toNumber(value: Prisma.Decimal | number | string | null | undefined) {
    if (value == null) return 0;
    return Number(value);
  }

  private isJsonObject(value: unknown): value is Prisma.JsonObject {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private readString(
    source: Prisma.JsonObject,
    keys: string[],
    fallback = '',
  ): string {
    for (const key of keys) {
      const val = source[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
    }
    return fallback;
  }

  private toJsonObject(
    value: Prisma.JsonValue | string | null | undefined,
  ): Prisma.JsonObject | undefined {
    if (value == null) {
      return undefined;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (this.isJsonObject(parsed)) {
          return parsed;
        }
      } catch {
        return { addressLine1: trimmed } as Prisma.JsonObject;
      }

      return { addressLine1: trimmed } as Prisma.JsonObject;
    }

    if (this.isJsonObject(value)) {
      return value;
    }

    return undefined;
  }

  private addressFromLegacyOrderJson(
    value: string | null | undefined,
  ): Partial<InvoiceAddress> | undefined {
    if (!value?.trim()) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(value);
      if (!this.isJsonObject(parsed)) {
        return undefined;
      }

      const delivery = parsed.delivery;
      if (!this.isJsonObject(delivery)) {
        return undefined;
      }

      const address = delivery.address;
      if (!this.isJsonObject(address)) {
        return undefined;
      }

      return {
        addressLine1: this.readString(address, [
          'addressLine1',
          'street',
          'address',
          'line1',
        ]),
        addressLine2: this.readString(address, ['addressLine2', 'line2']),
        city: this.readString(address, ['city']),
        zipCode: this.readString(address, ['zipCode', 'postalCode', 'pincode']),
        state: this.readString(address, ['state']),
        country: this.readString(address, ['country'], 'India'),
      };
    } catch {
      return undefined;
    }
  }

  private addressFromFlexibleJson(
    value: Prisma.JsonValue | string | null | undefined,
  ): Partial<InvoiceAddress> | undefined {
    if (value == null) {
      return undefined;
    }

    let parsed: unknown = value;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return {
          addressLine1: trimmed,
        };
      }
    }

    if (!this.isJsonObject(parsed)) {
      return undefined;
    }

    const address = this.isJsonObject(parsed.delivery)
      ? parsed.delivery.address
      : parsed;

    if (!this.isJsonObject(address)) {
      return undefined;
    }

    const addressLine1 = this.readString(address, [
      'addressLine1',
      'street',
      'address',
      'line1',
    ]);
    const city = this.readString(address, ['city']);
    const zipCode = this.readString(address, [
      'zipCode',
      'postalCode',
      'pincode',
    ]);
    const state = this.readString(address, ['state']);
    const country = this.readString(address, ['country'], 'India');

    if (!addressLine1 && !city && !zipCode && !state) {
      return undefined;
    }

    return {
      addressLine1,
      addressLine2: this.readString(address, ['addressLine2', 'line2']),
      city,
      zipCode,
      state,
      country,
    };
  }

  private asAddress(
    value: Prisma.JsonValue | string | null | undefined,
    label: 'billing' | 'shipping',
    fallback?: Partial<InvoiceAddress>,
  ): InvoiceAddress {
    const source = this.toJsonObject(value);
    const sourceObj = source ?? {};
    const fallbackObj = (fallback ?? {}) as Record<string, unknown>;
    const hasSource = Object.keys(sourceObj).length > 0;
    const hasFallback = Object.keys(fallbackObj).length > 0;

    if (!hasSource && !hasFallback) {
      throw new BadRequestException(
        `Invalid ${label} address format in invoice`,
      );
    }

    const pick = (keys: string[], defaultValue = ''): string => {
      const fromSource = this.readString(sourceObj, keys, '');
      if (fromSource) return fromSource;
      return this.readString(
        fallbackObj as Prisma.JsonObject,
        keys,
        defaultValue,
      );
    };

    const addressLine1 = pick(['addressLine1', 'address', 'line1', 'street']);
    const city = pick(['city']);
    const zipCode = pick(['zipCode', 'postalCode', 'pincode']);
    const state = pick(['state']);
    const country = pick(['country'], 'India');
    const addressLine2 = pick(['addressLine2', 'line2']);

    if (!addressLine1 || !city || !zipCode || !state) {
      throw new BadRequestException(`Incomplete ${label} address in invoice`);
    }

    return {
      addressLine1,
      addressLine2,
      city,
      zipCode,
      state,
      country,
    };
  }

  private pickupLocationFromJson(
    value: Prisma.JsonValue | null | undefined,
  ): string | undefined {
    if (!this.isJsonObject(value)) {
      return undefined;
    }

    return (
      this.readString(
        value,
        ['pickup_location', 'pickupLocation', 'name', 'label', 'addressLine1'],
        '',
      ) || undefined
    );
  }

  private asItemSnapshots(values: Prisma.JsonValue[]): InvoiceItemSnapshot[] {
    return values
      .filter((value): value is Prisma.JsonObject => this.isJsonObject(value))
      .map((value) => ({
        title: this.readString(value, ['title', 'name'], 'Item'),
        sku: this.readString(value, ['sku'], ''),
        quantity:
          typeof value.quantity === 'number'
            ? value.quantity
            : Number(value.quantity ?? 1),
        unitPrice:
          typeof value.unitPrice === 'number' ||
          typeof value.unitPrice === 'string'
            ? value.unitPrice
            : 0,
        discount:
          typeof value.discount === 'number' ||
          typeof value.discount === 'string'
            ? value.discount
            : 0,
      }))
      .filter(
        (item) =>
          Number.isFinite(item.quantity ?? 0) && (item.quantity ?? 0) > 0,
      );
  }

  // Create for order to recieve shipmentId
  async createOrder(
    user: JwtUser,
    invoiceNumber: string,
    payload: CreateShipmentDto,
    ip?: string,
  ): Promise<TransportShipmentOrderIDResult> {
    const invoiceDetails = await this.prisma.invoice.findFirst({
      where: {
        // isDeleted: false,
        invoiceNumber: invoiceNumber,
      },
      select: {
        id: true,
        invoiceNumber: true,
        orderId: true,
        stockRequestId: true,
        order_date: true,
        buyerName: true,
        buyerPhone: true,
        buyerEmail: true,
        items: true,
        billingAddress: true,
        shippingAddress: true,
        pickupAddress: true,
        shipmentPaymentMode: true,
        shippingFee: true,
        platformFee: true,
        subtotal: true,
        length: true,
        breadth: true,
        height: true,
        weight: true,
        order: {
          select: {
            addressJson: true,
            billingSnapshot: true,
          },
        },
      },
    });

    if (!invoiceDetails) {
      throw new NotFoundException(
        `Invoice not found for invoice number: ${invoiceNumber}`,
      );
    }

    console.log('Resolved shipping address:', invoiceDetails);

    const fallbackAddress =
      this.addressFromFlexibleJson(invoiceDetails.order?.addressJson) ??
      this.addressFromFlexibleJson(invoiceDetails.order?.billingSnapshot);

    const shippingFallback =
      fallbackAddress ??
      this.addressFromFlexibleJson(invoiceDetails.shippingAddress);

    const pickupLocation =
      payload.pickup_location ??
      this.pickupLocationFromJson(invoiceDetails.pickupAddress);

    if (!pickupLocation) {
      throw new BadRequestException(
        `Pickup location missing in invoice for invoice number: ${invoiceNumber}`,
      );
    }

    const itemSnapshots = this.asItemSnapshots(invoiceDetails.items);
    if (!itemSnapshots.length) {
      throw new BadRequestException(
        `No valid item snapshots found in invoice for invoice number: ${invoiceNumber}`,
      );
    }

    const items = itemSnapshots.map((item, index) => {
      const discount = Number(item.discount ?? 0);
      return {
        name: item.title ?? `Item-${index + 1}`,
        sku: item.sku || `SKU-ITEM-${randomUUID().slice(0, 4)}`,
        units: Math.max(1, Number(item.quantity ?? 1)),
        selling_price: Number(item.unitPrice),
        ...(discount !== 0 ? { discount } : {}),
      };
    });

    if (!invoiceDetails.orderId && !invoiceDetails.stockRequestId) {
      throw new BadRequestException(
        `Neither order ID nor stock request ID found in invoice for invoice number: ${invoiceNumber}`,
      );
    }

    const shipmentOrderRef =
      invoiceDetails.orderId ?? invoiceDetails.stockRequestId;
    if (!shipmentOrderRef) {
      throw new BadRequestException(
        `Unable to resolve shipment order reference for invoice number: ${invoiceNumber}`,
      );
    }

    if (!invoiceDetails.buyerEmail) {
      throw new BadRequestException(
        `Buyer email missing in invoice for invoice number: ${invoiceNumber}`,
      );
    }

    const phoneNumber = payload.phone_number ?? invoiceDetails.buyerPhone;
    if (!phoneNumber) {
      throw new BadRequestException(
        `Buyer phone missing in invoice for invoice number: ${invoiceNumber}`,
      );
    }

    const billingAddress = this.asAddress(
      invoiceDetails.billingAddress,
      'billing',
      shippingFallback,
    );

    const shippingIsBilling = Boolean(payload.shipping_is_billing);

    const shippingAddress = shippingIsBilling
      ? billingAddress
      : this.asAddress(
          invoiceDetails.shippingAddress,
          'shipping',
          billingAddress,
        );

    const buyerName = invoiceDetails.buyerName?.trim();
    if (!buyerName) {
      throw new BadRequestException(
        `Buyer name missing in invoice for invoice number: ${invoiceNumber}`,
      );
    }

    const buyerLastName = buyerName.split(' ').slice(-1)[0] || '(User)';

    const createdPayload: TransportShipmentOrderIDPayload = {
      order_id: shipmentOrderRef,
      order_date: invoiceDetails.order_date.toISOString(),
      pickup_location: pickupLocation,
      comment: payload.comment ?? 'Order created from channel',
      billing_customer_name: buyerName,
      billing_last_name: buyerLastName,
      billing_address: billingAddress.addressLine1,
      billing_address_2: billingAddress.addressLine2 ?? '',
      billing_city: billingAddress.city,
      billing_pincode: billingAddress.zipCode,
      billing_state: billingAddress.state,
      billing_country: billingAddress.country ?? 'India',
      billing_email: invoiceDetails.buyerEmail,
      billing_phone: phoneNumber,

      shipping_is_billing: shippingIsBilling,

      shipping_customer_name: shippingIsBilling ? '' : buyerName,
      shipping_last_name: shippingIsBilling ? '' : buyerLastName,
      shipping_address: shippingIsBilling ? '' : shippingAddress.addressLine1,
      shipping_address_2: shippingIsBilling
        ? ''
        : (shippingAddress.addressLine2 ?? ''),
      shipping_city: shippingIsBilling ? '' : shippingAddress.city,
      shipping_pincode: shippingIsBilling ? '' : shippingAddress.zipCode,
      shipping_country: shippingIsBilling
        ? ''
        : (shippingAddress.country ?? 'India'),
      shipping_state: shippingIsBilling ? '' : shippingAddress.state,
      shipping_email: shippingIsBilling ? '' : invoiceDetails.buyerEmail,
      shipping_phone: shippingIsBilling ? '' : phoneNumber,
      order_items: items,
      payment_method:
        invoiceDetails.shipmentPaymentMode === ShipmentPaymentMode.COD
          ? ShipmentPaymentMode.COD
          : ShipmentPaymentMode.PREPAID,
      shipping_charges: this.toNumber(invoiceDetails.shippingFee),
      giftwrap_charges: payload.giftwrap_charges,
      transaction_charges: this.toNumber(invoiceDetails.platformFee),
      total_discount: items.reduce(
        (acc, item) => acc + Number(item.discount || 0),
        0,
      ),
      sub_total: this.toNumber(invoiceDetails.subtotal),
      length: this.toNumber(invoiceDetails.length),
      breadth: this.toNumber(invoiceDetails.breadth),
      height: this.toNumber(invoiceDetails.height),
      weight: this.toNumber(invoiceDetails.weight),
      order_type: payload.order_type ?? ShipmentOrderType.ESSENTIALS,
    };

    console.log('Created Payload for Shipment Order:', createdPayload);
    const result = await this.shiprocket.createShipment(createdPayload);

    /* ───────── Save Shipment Details to Invoice ───────── */
    const invoiceUpdatePayload: any = {
      courierName: result.courier_name,
      status: InvoiceStatus.SENT, // Mark as sent since Shiprocket accepts shipment
    };

    // Only save AWB if it's provided by Shiprocket
    if (result.awb_code) {
      invoiceUpdatePayload.awb = result.awb_code;
    } else {
      // If AWB is pending, mark invoice as awaiting assignment
      // AWB will be assigned later via webhook when Shiprocket assigns courier
      invoiceUpdatePayload.status = InvoiceStatus.AWAITING_SHIPMENT_ASSIGNMENT;
      this.logger.warn(
        `Shipment created but AWB pending for invoice number: ${invoiceNumber}. Status: Awaiting assignment.`,
      );
    }

    await this.prisma.invoice.update({
      where: { invoiceNumber: invoiceDetails.invoiceNumber },
      data: {
        courierName: invoiceUpdatePayload.courierName,
        awb: invoiceUpdatePayload.awb,
        status: invoiceUpdatePayload.status,
        shipmentOrderId:
          result.order_id != null ? String(result.order_id) : undefined,
        shipmentId:
          result.shipment_id != null ? String(result.shipment_id) : undefined,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'CREATE',
        resource: 'Shipment',
        resourceId: result.shipment_id != null ? String(result.shipment_id) : null,
        metadata: {
          to: {
            invoiceNumber: invoiceDetails.invoiceNumber,
            invoiceId: invoiceDetails.id,
            orderId: invoiceDetails.orderId,
            stockRequestId: invoiceDetails.stockRequestId,
            shipmentOrderId: result.order_id != null ? String(result.order_id) : undefined,
            courierName: result.courier_name,
            awb: result.awb_code,
            status: invoiceUpdatePayload.status,
          },
        },
        ip,
      }),
      'shipment.create',
    );

    return result;
  }

  // Create for order to recieve shipmentId
  async createCustomOrder(
    user: JwtUser,
    payload: TransportShipmentDto,
    ip?: string,
  ): Promise<TransportShipmentOrderIDResult> {
    /* ───────── Ship ───────── */
    const customPayload: TransportShipmentOrderIDPayload = {
      ...payload,
      shipping_is_billing: [true, 'true', 'yes', 'done', 'ok'].includes(
        payload.shipping_is_billing,
      )
        ? true
        : false,
      shipping_pincode: String(payload.shipping_pincode),
      shipping_email: payload.shipping_email ?? payload.billing_email,
      shipping_phone: payload.shipping_phone ?? payload.billing_phone,
      payment_method:
        payload.payment_method === DtoShipmentPaymentMode.COD
          ? ShipmentPaymentMode.COD
          : ShipmentPaymentMode.PREPAID,
      shipping_charges: payload.shipping_charges ?? 0,
      total_discount: payload.total_discount ?? 0,
      order_type: payload.order_type ?? ShipmentOrderType.ESSENTIALS,
    };

    const result = await this.shiprocket.createShipment(customPayload);

    /* ───────── Validate Shipment Creation ───────── */
    if (!result?.shipment_id) {
      throw new BadRequestException(
        'Shipment creation failed: No shipment ID returned from provider',
      );
    }

    /* CREATE SHIPMENT RECORD (MANDATORY) */
    const createdShipment = await this.prisma.shipment.create({
      data: {
        shipmentId: result.shipment_id ? String(result.shipment_id) : null,
        orderId: result.order_id ? String(result.order_id) : payload.order_id,
        courierName: result.courier_name || 'Shiprocket',
        trackingNumber: result.awb_code
          ? String(result.awb_code)
          : String(result.shipment_id),
        status: ShipmentStatus.PENDING,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'CREATE',
        resource: 'Shipment',
        resourceId: createdShipment.id,
        metadata: {
          to: {
            id: createdShipment.id,
            shipmentId: createdShipment.shipmentId,
            orderId: createdShipment.orderId,
            courierName: createdShipment.courierName,
            trackingNumber: createdShipment.trackingNumber,
            status: createdShipment.status,
          },
        },
        ip,
      }),
      'shipment.create_custom',
    );

    return result;
  }
}
