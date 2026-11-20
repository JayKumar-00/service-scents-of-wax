export interface AddressSnapshot {
  fullName?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  landmark?: string;
}

export interface InvoiceItemSnapshot {
  productId: string;
  variantId?: string;
  title: string;
  variantName?: string;
  sku: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxableAmount: number;
  gstRate: number;
  totalAmount: number;
}

export interface InvoiceViewModel {
  invoiceNumber: string;
  type: string;
  status: string;
  issuedAt: Date;
  orderDate: Date;
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  storeName?: string;
  billingAddress?: AddressSnapshot;
  shippingAddress?: AddressSnapshot;
  pickupAddress?: AddressSnapshot;
  items: InvoiceItemSnapshot[];
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  platformFee: number;
  gst: number;
  grandTotal: number;
  shipmentPaymentMode?: string;
  paymentStatus?: string;
  paymentReferenceId?: string;
  paidAt?: Date;
  shipmentProvider?: string;
  shipmentOrderId?: string;
  shipmentId?: string;
  courierName?: string;
  awb?: string;
  trackingUrl?: string;
  sellerGstin?: string;
  buyerGstin?: string;
  placeOfSupply?: string;
  orderId?: string;
  stockRequestId?: string;
  isInterState?: boolean;
}

// Retain for backward compatibility with other services/files
export interface InvoiceAddress extends AddressSnapshot {}
