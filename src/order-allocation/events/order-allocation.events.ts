import { ORDER_ALLOCATION_EVENTS } from '../constants/order-allocation.constants';
import {
  OrderRequestStatus,
  ProposalStatus,
  WarehouseFulfillmentStatus,
} from '../constants/order-allocation.enums';

export type OrderAllocationEventName =
  (typeof ORDER_ALLOCATION_EVENTS)[keyof typeof ORDER_ALLOCATION_EVENTS];

export type OrderRequestCreatedEvent = {
  requestId: string;
  customerId: string;
  customerUId: string;
  status: OrderRequestStatus;
};

export type FranchiseProposalSentEvent = {
  requestId: string;
  proposalId: string;
  franchiseId: string;
  franchiseName: string;
  franchiseUserIds: string[];
  attemptNumber: number;
  expiresAt: Date;
  status: ProposalStatus;
  distanceKm?: number;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  products?: Array<{
    productId: string;
    variantId?: string | null;
    productName: string;
    variantName?: string | null;
    Qty: number;
  }>;
};

export type FranchiseProposalResolvedEvent = {
  requestId: string;
  proposalId: string;
  franchiseId: string;
  customerId: string;
  customerUId: string;
  status: ProposalStatus;
  reason?: string | null;
  orderId?: string;
  orderNumber?: string;
  totalAmount?: string;
};

export type OrderCreatedEvent = {
  requestId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerUId: string;
  franchiseId: string;
  totalAmount: string;
  isForcefullyAssigned?: boolean;
};

export type OrderAllocationFailedEvent = {
  requestId: string;
  customerId: string;
  customerUId: string;
  reason: string;
  status: WarehouseFulfillmentStatus | OrderRequestStatus.FAILED;
};

export type OrderAllocationEventPayloadMap = {
  'order-request.created': OrderRequestCreatedEvent;
  'franchise-proposal.sent': FranchiseProposalSentEvent;
  'franchise-proposal.accepted': FranchiseProposalResolvedEvent;
  'franchise-proposal.rejected': FranchiseProposalResolvedEvent;
  'franchise-proposal.expired': FranchiseProposalResolvedEvent;
  'order.created': OrderCreatedEvent;
  'order-allocation.failed': OrderAllocationFailedEvent;
};
