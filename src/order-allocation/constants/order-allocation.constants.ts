export const ORDER_ALLOCATION_QUEUE = 'order-allocation';

export const ORDER_ALLOCATION_JOB = {
  ALLOCATE_REQUEST: 'allocate-order-request',
  EXPIRE_PROPOSAL: 'expire-franchise-proposal',
  EXPIRE_RESERVATION: 'expire-inventory-reservation',
  EXPIRE_ONLINE_PAYMENT: 'expire-online-payment',
} as const;

export const ORDER_ALLOCATION_EVENTS = {
  ORDER_REQUEST_CREATED: 'order-request.created',
  PROPOSAL_SENT: 'franchise-proposal.sent',
  PROPOSAL_ACCEPTED: 'franchise-proposal.accepted',
  PROPOSAL_REJECTED: 'franchise-proposal.rejected',
  PROPOSAL_EXPIRED: 'franchise-proposal.expired',
  ORDER_CREATED: 'order.created',
  ORDER_ALLOCATION_FAILED: 'order-allocation.failed',
} as const;
