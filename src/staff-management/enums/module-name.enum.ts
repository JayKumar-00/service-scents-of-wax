import { Role } from '@prisma/client';

export enum PermissionAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXPORT = 'EXPORT',
}

export enum ModuleName {
  ANALYTICS = 'analytics',
  STOCK_REQUESTS = 'stock-requests',
  ORDERS = 'orders',
}

export enum SuperAdminModuleEnum {
  ANALYTICS = 'analytics',
  ATTRIBUTES = 'attributes',
  ADMIN_PRODUCTS = 'products',
  CATEGORIES = 'categories',
  BRANDS = 'brands',
  MEDIA_LIBRARY = 'media',
  BANNERS = 'banners',
  DISCOUNTS = 'discounts',
  PROMOTIONS = 'promotions',
  WAREHOUSE = 'warehouse',
  SUPPLY_CHAIN = 'supply-chain',
  DELIVERIES = 'distributions',
  ADMIN_FRANCHISE = 'franchises',
  STAFF_MANAGEMENT = 'staff-management',
  CUSTOMERS = 'customers',
  CREDIT_LIMIT = 'credit-limit',
  BRADGES = 'badges',
  ORDERS = 'orders',
  RETURNS_REFUND = 'returns',
  USERS = 'users',
  ROLES = 'roles',
  AUDIT_LOGS = 'audit',
  FAQ = 'faq',
  FRANCHISE_NOTICES = 'notices',
  TICKETS = 'tickets',
  WEBHOOKS = 'webhooks',
  APP_ROLE = 'app-role',
  REPORT = 'reports',
  STARTER_BUNDLES = 'starter-bundles',

  STOCK_REQUESTS = 'stock-requests',
  FRANCHISE_RETURNS = 'franchise-returns',
  RETAIL_CUSTOMERS = 'retail-customers',
  AUDIT = 'audit',
  GEO = 'geo',
  CARTS = 'carts',
  COUPON = 'coupon',
  NOTIFICATION = 'notification',
  INVOICE = 'invoice',
  TRANSPORT = 'transport',
  PAYMENT = 'payment',
  OPS = 'ops',
  REVIEWS = 'reviews',
  CUSTOMER_ORDERS = 'customer-orders',
  REFUNDS = 'refunds',
  STOCK_RETURN = 'stock-return',
  PAYOUTS = 'payouts',
  SETTING = 'setting',
  USER_RETENTION = 'user-retention',
}

export enum FranchiseOwnerModuleEnum {
  ORDERS = 'orders',
  CUSTOMERS = 'customers',
  STOCK_REQUESTS = 'stock-requests',
  INVETORY = 'inventory', // Fracnhise
  NETWORK = 'network', // Supply-Chain
  APP_ROLE = 'roles',
  DELIVERIES = 'distribution',
  RETURNS_REFUND = 'returns',
  PAYMENT = 'payment',
  ANALYTICS = 'analytics',
  FRANCHISE_NOTICES = 'notices',
  // TICKETS = 'tickets',
  FRACHISE_DOCUMENT = 'vault', // Upload and manage important documents related to franchise

  WAREHOUSE = 'warehouse',
  SUPPLY_CHAIN = 'supply-chain',
  FRANCHISE = 'franchises',
  CREDIT_LIMIT = 'credit-limit',
  BRADGES = 'badges',
  AUDIT_LOGS = 'audit',
  // FAQ = 'faq',

  FRANCHISE_RETURNS = 'franchise-returns',
  RETAIL_CUSTOMERS = 'retail-customers',
  AUDIT = 'audit',
  // GEO = 'geo',
  // NOTIFICATION = 'notification',
  // INVOICE = 'invoice',
  TRANSPORT = 'transport',

  STAFF_MANAGEMENT = 'users', // Staff-Management
  PROPOSAL = 'proposal',
  POS = 'pos',
  PAYOUT = 'payout',
  ORDER_RETURN = 'order-returns',
  REPORT = 'reports',
}

export type AppRoleModuleEnum = SuperAdminModuleEnum | FranchiseOwnerModuleEnum;

export const APP_ROLE_MODULE_VALUES = [
  ...Object.values(SuperAdminModuleEnum),
  ...Object.values(FranchiseOwnerModuleEnum),
];

export function resolveAppRoleModuleEnum(
  role: Role,
): typeof SuperAdminModuleEnum | typeof FranchiseOwnerModuleEnum {
  return role === Role.SUPERADMIN
    ? SuperAdminModuleEnum
    : FranchiseOwnerModuleEnum;
}

export function resolveAppRoleModuleValues(role: Role): string[] {
  return Object.values(resolveAppRoleModuleEnum(role));
}
