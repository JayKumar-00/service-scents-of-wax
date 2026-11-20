import { OrderStatus } from '@prisma/client';

export const ORDER_EVENTS = {
  STATUS_CHANGED: 'order.status.changed',
  STOCK_OUT_OF_STOCK: 'order.stock.out-of-stock',
  STOCK_REDUCED: 'order.stock.reduced',
  STOCK_AVAILABLE: 'order.stock.available',
} as const;

export type OrderEventName = (typeof ORDER_EVENTS)[keyof typeof ORDER_EVENTS];

export interface OrderEventSnapshot {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  customerId?: string;
  franchiseId: string;
  paymentFailureReason?: string;
  cancelledBy?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface OrderStatusChangedEvent {
  eventId: string;
  occurredAt: Date;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string;
  reason?: string;
  order: OrderEventSnapshot;
}

/* ============ STOCK AVAILABILITY EVENTS ============ */

export interface StockEventSnapshot {
  variantId: string;
  productId?: string;
  sku?: string;
  orderId?: string;
  requestedQuantity: number;
  availableStock: number;
  reservedStock?: number;
  franchiseId?: string;
}

export interface StockOutOfStockEvent {
  eventId: string;
  occurredAt: Date;
  reason: string; // e.g. "Insufficient stock for order fulfillment"
  stock: StockEventSnapshot;
}

export interface StockReducedEvent {
  eventId: string;
  occurredAt: Date;
  orderId: string;
  items: Array<{
    variantId?: string;
    productId?: string;
    quantity: number;
    previousStock: number;
    newStock: number;
  }>;
}

export interface StockAvailableEvent {
  eventId: string;
  occurredAt: Date;
  variantId: string;
  availableStock: number;
  reason?: string;
}
