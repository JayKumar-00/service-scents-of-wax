export const REPORT_FIELD_BLACKLIST = [
  'password',
  'passwordHash',
  'otp',
  'token',
  'refreshToken',
  'secret',
  'accessToken',
  'internalNotes',
  'privateKey',
  'systemMetadata',
  'deletedAt',
];

export const TEMP_REPORTS_DIR_NAME = 'tmp-reports';

export const REPORT_MODULE_PRISMA_MAP: Record<string, string> = {
  orders: 'order',
  products: 'product',
  customers: 'customer',
  inventory: 'franchiseStock',
  credits: 'creditAccount',
  payouts: 'payout',
  franchises: 'franchise',
  staff: 'user',
  invoices: 'invoice',
  payments: 'financialEvent',
  transactions: 'ledgerEntry',
  loyalty: 'retentionSnapshot',
  loyalty_transactions: 'loyaltyTransaction',
  newsletter_subscribers: 'newsletterSubscriber',
  referrals: 'referral',
  categories: 'category',
  brands: 'brand',
  attributes: 'attributeName',
  media: 'mediaLibrary',
  reviews: 'productReview',
  banners: 'banner',
  discounts: 'discount',
  promotions: 'promotion',
  warehouse_inventory: 'warehouseStock',
  supply_chain: 'supplyChainEvent',
  stock_requests: 'stockRequest',
  deliveries: 'inboundDelivery',
  returns: 'returnRequest',
  refunds: 'refund',
  proposals: 'franchiseProposal',
  tickets: 'supportTicket',
  faq: 'faq',
  notices: 'franchiseNotice',
  audit: 'auditLog',
  webhooks: 'webhookEndpoint',
  settings: 'systemTheme',
  app_role: 'appRole',
  app_roles: 'appRole',
  retention: 'retentionSnapshot',
  settlements: 'orderSettlement',
  suppliers: 'supplier',
  purchase_orders: 'purchaseOrder',
  asns: 'asn',
  grns: 'goodsReceiptNote',
  quality_inspections: 'qualityInspection',
  purchase_order_approvals: 'purchaseOrderApproval',
  supplier_returns: 'supplierReturnOrder',
  starter_bundles: 'starterBundle',
  bundle_assignments: 'franchiseBundleAssignment',
  franchise_ledger: 'stockRequest',
  supplier_ledger: 'supplier',
  inventory_ledger: 'inventoryLedgerEntry',
};

export function mapModuleToPrismaModel(moduleName: string): string {
  return REPORT_MODULE_PRISMA_MAP[moduleName.toLowerCase()] || moduleName;
}

export function resolveUserFranchiseId(user: any): string | undefined {
  if (!user) return undefined;
  if (user.role === 'FRANCHISE_STAFF') {
    return user.franchiseOwnerId;
  }
  return user.franchiseId;
}
