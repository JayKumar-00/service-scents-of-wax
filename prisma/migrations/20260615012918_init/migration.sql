-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('BLOCKED', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FranchiseGender" AS ENUM ('MALE', 'FEMALE', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "CreditAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CreditDurationEnum" AS ENUM ('DAY_15', 'DAY_30', 'DAY_45');

-- CreateEnum
CREATE TYPE "StockRequestPaymentMode" AS ENUM ('CREDIT', 'DIRECT');

-- CreateEnum
CREATE TYPE "CreditTransactionEnum" AS ENUM ('ORDER', 'PAYMENT', 'COMMISSION', 'ADJUSTMENT', 'PENALTY', 'REFUND', 'CASH_IN', 'CREDIT_ACCOUNT', 'PAYOUT');

-- CreateEnum
CREATE TYPE "DirectionEnum" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "CreditDueStatus" AS ENUM ('PENDING', 'OVERDUE', 'PAID');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'OUT_OF_STOCK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PaymentModeEnum" AS ENUM ('CASH', 'CARD', 'UPI', 'QR', 'NETBANKING', 'COD', 'ONLINE');

-- CreateEnum
CREATE TYPE "ReturnInventoryEnum" AS ENUM ('RETURN', 'EXCHANGE', 'REFUND');

-- CreateEnum
CREATE TYPE "ReturnSourceType" AS ENUM ('ORDER', 'STOCK_REQUEST', 'CUSTOMER_ORDER');

-- CreateEnum
CREATE TYPE "ReturnConflictInventoryStatus" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED', 'PENDING_QC');

-- CreateEnum
CREATE TYPE "ReturnInventoryKind" AS ENUM ('DEFECTIVE', 'CONFLICT', 'RETURN');

-- CreateEnum
CREATE TYPE "OrderRequestStatus" AS ENUM ('SEARCHING_FRANCHISE', 'PROPOSAL_SENT', 'ACCEPTED', 'FULFILLED_BY_WAREHOUSE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarehouseFulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN_STAFF', 'FRANCHISE_OWNER', 'FRANCHISE_STAFF', 'CUSTOMER', 'FRANCHISE_AUDITOR');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PROCESSING', 'SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'PACKED', 'OUT_FOR_DELIVERY');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('ONLINE', 'POS');

-- CreateEnum
CREATE TYPE "OnlinePaymentStatus" AS ENUM ('UNPAID', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "FranchiseStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StockRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockRequestPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FranchiseReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "InboundDiscrepancyStatus" AS ENUM ('NONE', 'REPORTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NoticeAudience" AS ENUM ('ALL_FRANCHISES', 'SINGLE_FRANCHISE');

-- CreateEnum
CREATE TYPE "SupportTicketType" AS ENUM ('GENERAL', 'DISPUTE', 'BILLING', 'STOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FranchiseDocumentKind" AS ENUM ('KYC', 'AGREEMENT', 'LICENSE', 'GST', 'OTHER', 'PAN_CARD', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'GST_CERTIFICATE', 'MSME_CERTIFICATE', 'SHOP_LICENSE', 'SOP_CERTIFICATE', 'TRAINING_CERTIFICATE', 'ELECTRICITY_BILL', 'RENT_AGREEMENT', 'PROFILE_PHOTO', 'SELFIE', 'SHOP_PHOTO', 'OFFICE_PHOTO');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "StockingNodeType" AS ENUM ('CENTRAL_DC', 'REGIONAL_HUB', 'STORE', 'WAREHOUSE_STOCK');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DomainOutboxStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "InventoryReservationKind" AS ENUM ('OUTLET_ONLINE_ORDER', 'CENTRAL_STOCK_REQUEST');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ORDERED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CartSource" AS ENUM ('GUEST', 'USER');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('ADMIN', 'SELLER', 'FRANCHISE', 'CUSTOMER', 'AFFILIATE', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y', 'CASHBACK');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('PRODUCT', 'CATEGORY', 'CART', 'SHIPPING');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'CANCELLED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER', 'PAYMENT', 'DELIVERY', 'SUPPORT', 'STOCK', 'SYSTEM', 'FRANCHISE_CREDIT', 'FRANCHISE_STOCK_REQUEST', 'FRANCHISE_STOCK_APPROVE', 'FRANCHISE_ACTIVATION', 'FRANCHISE_REGISTRATION', 'LOW_STOCK');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PAYMENT', 'SHIPMENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('GENERATED', 'SENT', 'AWAITING_SHIPMENT_ASSIGNMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ShipmentPaymentMode" AS ENUM ('PREPAID', 'COD');

-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SearchHistoryType" AS ENUM ('SEARCH', 'VIEW');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('SYTEM', 'STAFF');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('RETAIL', 'WHOLESALE', 'ECOMMERCE', 'MANUFACTURING', 'SERVICE', 'LOGISTICS', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('ADMIN_PROFILE', 'FRANCHISE_STAFF', 'FRANCHISE');

-- CreateEnum
CREATE TYPE "FaqAudience" AS ENUM ('CUSTOMER', 'FRANCHISE', 'ALL');

-- CreateEnum
CREATE TYPE "FaqStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BannerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "BannerType" AS ENUM ('PRODUCT', 'BRAND', 'CATEGORY');

-- CreateEnum
CREATE TYPE "BannerRedirectType" AS ENUM ('URL', 'PRODUCT', 'BRAND', 'CATEGORY');

-- CreateEnum
CREATE TYPE "BannerPlatform" AS ENUM ('WEB', 'MOBILE', 'BOTH');

-- CreateEnum
CREATE TYPE "BannerPosition" AS ENUM ('HOME_HERO', 'HOME_MIDDLE', 'CATEGORY_TOP', 'POPUP');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('ALL', 'OWN', 'ORG');

-- CreateEnum
CREATE TYPE "PanelType" AS ENUM ('ADMIN', 'FRANCHISE');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('PAN', 'AADHAAR', 'GST', 'DRIVING_LICENSE', 'VOTER_ID', 'PASSPORT');

-- CreateEnum
CREATE TYPE "VerificationProvider" AS ENUM ('SUREPASS', 'SANDBOX');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "CustomerLifecycleStage" AS ENUM ('NEW_VISITOR', 'REGISTERED', 'FIRST_ORDER', 'ACTIVATED', 'REPEAT_CUSTOMER', 'LOYAL_CUSTOMER', 'VIP_CUSTOMER', 'DORMANT', 'CHURNED', 'REACTIVATED');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('REGISTRATION', 'NEWSLETTER_SIGNUP', 'FIRST_ORDER', 'SPEND', 'REVIEW', 'REFERRAL_PURCHASE', 'REDEMPTION', 'REFUND', 'EXPIRY');

-- CreateEnum
CREATE TYPE "NewsletterSource" AS ENUM ('REGISTER', 'FOOTER', 'REFERRAL');

-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('RETURN', 'REFUND', 'EXCHANGE', 'SAME_PRODUCT_EXCHANGE');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('GOOD', 'DEFECTIVE', 'CONFLICT');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKUP_COMPLETED', 'RECEIVED_AT_FRANCHISE', 'IN_TRANSIT_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE', 'UNDER_INSPECTION', 'WAREHOUSE_QC', 'QC_PASSED', 'QC_FAILED', 'QC_CONFLICT', 'REFUND_PROCESSED', 'EXCHANGE_ORDER_CREATED', 'EXCHANGE_ORDER_DELIVERED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASSED', 'FAILED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "ReturnInventoryMovementType" AS ENUM ('CUSTOMER_TO_RETURN', 'RETURN_TO_FRANCHISE', 'RETURN_TO_WAREHOUSE', 'FRANCHISE_TO_CUSTOMER', 'FRANCHISE_TO_RETURN', 'RETURN_TO_DEFECTIVE', 'RETURN_TO_BLOCKED');

-- CreateEnum
CREATE TYPE "ReturnMediaType" AS ENUM ('CUSTOMER_PROOF', 'RECEIVING_PROOF', 'QC_PROOF');

-- CreateEnum
CREATE TYPE "ReturnMovementType" AS ENUM ('CUSTOMER_TO_RETURN', 'RETURN_TO_FRANCHISE', 'RETURN_TO_WAREHOUSE', 'FRANCHISE_TO_CUSTOMER', 'FRANCHISE_TO_RETURN', 'RETURN_TO_DEFECTIVE', 'RETURN_TO_BLOCKED');

-- CreateEnum
CREATE TYPE "DefectiveSource" AS ENUM ('CUSTOMER_RETURN', 'FRANCHISE_STOCK');

-- CreateEnum
CREATE TYPE "WarehouseDisposition" AS ENUM ('RESTOCK', 'REPAIR', 'SCRAP', 'FRANCHISE_CLAIM');

-- CreateEnum
CREATE TYPE "ReturnDisposition" AS ENUM ('RESTOCK_FRANCHISE', 'RETURN_TO_WAREHOUSE', 'BLOCKED');

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'INDIA',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailCustomer" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "phoneNorm" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "gstin" TEXT,
    "billingStreet" TEXT,
    "billingCity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "altEmail" TEXT,
    "phone" TEXT,
    "gender" "Gender",
    "dob" TIMESTAMP(3),
    "gstin" TEXT,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "avatar" TEXT,
    "firebaseUid" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Franchise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "FranchiseStatus" NOT NULL DEFAULT 'ACTIVE',
    "acceptingOrders" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "territory" TEXT,
    "addressLine1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'INDIA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycNote" TEXT,
    "ownerFullName" TEXT,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT,
    "businessName" TEXT,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "basicDetailsCompleted" BOOLEAN NOT NULL DEFAULT false,
    "gstDetailsCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sopChecklistCompleted" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "kycDocumentType" TEXT,
    "kycDocumentNumber" TEXT,
    "kycVerifiedAt" TIMESTAMP(3),
    "sopTrainingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sopBrandingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sopInfraAuditCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sopPosSetupCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sopSafetyCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sopLastReviewedAt" TIMESTAMP(3),
    "sopNote" TEXT,
    "badge" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "state" TEXT,
    "dob" TEXT,
    "gender" "FranchiseGender" NOT NULL DEFAULT 'NOT_SPECIFIED',

    CONSTRAINT "Franchise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "totalCredit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usedCredit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "availableCredit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "duration" "CreditDurationEnum",
    "payLater" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advanceBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "walletBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CreditAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "freezeReason" TEXT,
    "frozenAt" TIMESTAMP(3),
    "frozenBy" TEXT,
    "termConditionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "autoPenaltyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoCreditIncreaseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "automationPausedUntil" TIMESTAMP(3),

    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "type" "CreditTransactionEnum" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" "DirectionEnum" NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditDue" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "outstanding" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "CreditDueStatus" NOT NULL DEFAULT 'PENDING',
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditDue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditProcessingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "referenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "CreditProcessingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "payoutCode" TEXT,
    "franchiseId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "referenceId" TEXT,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseSettlement" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "totalSales" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "netPayable" DECIMAL(12,2) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FranchiseSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "gatewayStatus" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(12,2) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "direction" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaLibrary" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tag" TEXT,
    "orientation" TEXT,
    "size" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeName" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeValue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "attributeNameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sku" TEXT NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "wholesalePrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "mrpPrice" DECIMAL(10,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "gstTax" INTEGER NOT NULL DEFAULT 18,
    "imageUrl" TEXT,
    "imageUrls" JSONB,
    "attributeSummary" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "stock" INTEGER DEFAULT 0,
    "gstTax" INTEGER DEFAULT 18,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibility" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT,
    "fastDelivery" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "occasions" TEXT,
    "ratingAvg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "defaultGstRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "imageUrls" JSONB,
    "explicitAttributes" JSONB,
    "basePrice" DECIMAL(10,2) DEFAULT 0,
    "wholesalePrice" DECIMAL(10,2) DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "mrpPrice" DECIMAL(10,2),
    "returnWindow" INTEGER DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantAttribute" (
    "variantId" TEXT NOT NULL,
    "attributeValueId" TEXT NOT NULL,

    CONSTRAINT "VariantAttribute_pkey" PRIMARY KEY ("variantId","attributeValueId")
);

-- CreateTable
CREATE TABLE "SeoMeta" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keywords" TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productId" TEXT NOT NULL,

    CONSTRAINT "SeoMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseStock" (
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "reserved" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "FranchiseStock" (
    "franchiseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "reserved" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FranchiseStock_pkey" PRIMARY KEY ("franchiseId","productId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderRequestId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "franchiseId" TEXT NOT NULL,
    "customerId" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "addressJson" TEXT NOT NULL,
    "giftMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "channel" "OrderChannel" NOT NULL DEFAULT 'ONLINE',
    "saleType" TEXT,
    "billingSnapshot" JSONB,
    "paymentMode" "PaymentModeEnum" NOT NULL,
    "soldByUserId" TEXT,
    "retailCustomerId" TEXT,
    "onlinePaymentStatus" "OnlinePaymentStatus" DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "paymentProvider" TEXT,
    "paymentReference" TEXT,
    "cartId" TEXT,
    "discountAmount" DECIMAL(10,2),
    "couponCode" TEXT,
    "invoiceNumber" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedByUserId" TEXT,
    "franchisePaybleAmount" DECIMAL(10,2) DEFAULT 0.00,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "productName" TEXT,
    "sku" TEXT,
    "variantName" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "mrpPrice" DECIMAL(10,2),
    "gstPercent" DECIMAL(5,2),
    "discountAmount" DECIMAL(10,2),
    "taxAmount" DECIMAL(10,2),
    "finalAmount" DECIMAL(10,2),
    "imageUrl" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRequest" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "StockRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "paymentMode" "StockRequestPaymentMode",
    "creditDuration" "CreditDurationEnum",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedQuantity" INTEGER,
    "unitPriceAtApproval" DECIMAL(10,2),
    "gstRatePercent" DECIMAL(5,2),
    "billingSubtotal" DECIMAL(12,2),
    "billingTax" DECIMAL(12,2),
    "billingTotal" DECIMAL(12,2),
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(12,2),
    "isFullyPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentStatus" "StockRequestPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentReceivedAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "paymentNote" TEXT,
    "invoiceNumber" TEXT,

    CONSTRAINT "StockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundDelivery" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "stockRequestId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "carrier" TEXT,
    "trackingCode" TEXT,
    "expectedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockApplied" BOOLEAN NOT NULL DEFAULT false,
    "dispatchedAt" TIMESTAMP(3),
    "transportLaneId" TEXT,
    "carrierReference" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "asnPayload" JSONB,
    "quantityShipped" INTEGER,
    "quantityReceived" INTEGER,
    "discrepancyNote" TEXT,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "discrepancyStatus" "InboundDiscrepancyStatus" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "InboundDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseReturn" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "stockRequestId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "resolutionNote" TEXT,
    "refundRequested" BOOLEAN NOT NULL DEFAULT false,
    "returnType" "ReturnInventoryEnum",
    "oldItems" JSONB,
    "newItems" JSONB,
    "oldTotalAmount" DECIMAL(12,2),
    "newTotalAmount" DECIMAL(12,2),
    "finalPayableAmount" DECIMAL(12,2),
    "processedAt" TIMESTAMP(3),
    "status" "FranchiseReturnStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnInventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "franchiseId" TEXT NOT NULL,
    "customerId" TEXT,
    "quantity" INTEGER NOT NULL,
    "sourceType" "ReturnSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "kind" "ReturnInventoryKind" NOT NULL,
    "status" "ReturnConflictInventoryStatus" DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "percentOff" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applyToAll" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionProduct" (
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "PromotionProduct_pkey" PRIMARY KEY ("promotionId","productId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "NoticeAudience" NOT NULL,
    "franchiseId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FranchiseNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseNoticeRead" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FranchiseNoticeRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "type" "SupportTicketType" NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseDocument" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "kind" "FranchiseDocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" TEXT NOT NULL DEFAULT '*',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "responseCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockingNode" (
    "id" TEXT NOT NULL,
    "type" "StockingNodeType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" TEXT,
    "franchiseId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockingNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubInventory" (
    "stockingNodeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HubInventory_pkey" PRIMARY KEY ("stockingNodeId","productId")
);

-- CreateTable
CREATE TABLE "TransportLane" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originNodeId" TEXT NOT NULL,
    "destNodeId" TEXT NOT NULL,
    "defaultSlaHours" INTEGER NOT NULL DEFAULT 72,
    "allocationPriority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportLane_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantityRequested" INTEGER NOT NULL,
    "quantityShipped" INTEGER,
    "quantityReceived" INTEGER,

    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentPolicy" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 0,
    "maxQty" INTEGER NOT NULL DEFAULT 10,
    "reorderPoint" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyChainEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "stockingNodeId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "quantityDelta" INTEGER,
    "refType" TEXT NOT NULL,
    "refId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEventOutbox" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DomainOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),

    CONSTRAINT "DomainEventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "kind" "InventoryReservationKind" NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "franchiseId" TEXT,
    "stockRequestId" TEXT,
    "orderId" TEXT,
    "orderRequestId" TEXT,
    "proposalId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderRequestStatus" NOT NULL DEFAULT 'SEARCHING_FRANCHISE',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "addressJson" JSONB NOT NULL,
    "giftMessage" TEXT,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "requestSnapshot" JSONB,
    "maxFranchiseAttempts" INTEGER NOT NULL DEFAULT 10,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "proposalTimeoutMinutes" INTEGER NOT NULL DEFAULT 3,
    "reservationTimeoutMinutes" INTEGER NOT NULL DEFAULT 15,
    "totalAmount" DECIMAL(12,2),
    "selectedFranchiseId" TEXT,
    "acceptedProposalId" TEXT,
    "actualOrderId" TEXT,
    "warehouseFulfillmentOrderId" TEXT,
    "failureReason" TEXT,
    "searchingStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cartId" TEXT,

    CONSTRAINT "OrderRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "sku" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "gstRatePercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseProposal" (
    "id" TEXT NOT NULL,
    "proposalCode" TEXT,
    "requestId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'SENT',
    "attemptNumber" INTEGER NOT NULL,
    "distanceKm" DECIMAL(10,2),
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "cancellationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseFulfillmentOrder" (
    "id" TEXT NOT NULL,
    "fulfillmentNumber" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "WarehouseFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "addressJson" JSONB NOT NULL,
    "giftMessage" TEXT,
    "totalAmount" DECIMAL(12,2),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WarehouseFulfillmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseFulfillmentOrderItem" (
    "id" TEXT NOT NULL,
    "warehouseFulfillmentOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "sku" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseFulfillmentOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "sessionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "stockLockedAt" TIMESTAMP(3),
    "lockExpiresAt" TIMESTAMP(3),
    "isMerged" BOOLEAN NOT NULL DEFAULT false,
    "mergedAt" TIMESTAMP(3),
    "source" "CartSource" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "priceAtAddition" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "DiscountType" NOT NULL,
    "scope" "DiscountScope" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minOrderAmount" DECIMAL(10,2),
    "maxDiscountAmount" DECIMAL(10,2),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountUsage" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT,
    "rating" INTEGER,
    "comment" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT NOT NULL,
    "courierName" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "trackingPayload" JSONB,
    "franchiseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "orderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "marketing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL DEFAULT 'PAYMENT',
    "orderId" TEXT,
    "stockRequestId" TEXT,
    "buyerName" TEXT,
    "buyerPhone" TEXT,
    "buyerEmail" TEXT,
    "storeName" TEXT,
    "latitude" TEXT,
    "longitude" TEXT,
    "billingAddress" JSONB,
    "shippingAddress" JSONB,
    "pickupAddress" JSONB,
    "items" JSONB[],
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "shipmentPaymentMode" "ShipmentPaymentMode",
    "paymentStatus" "InvoicePaymentStatus",
    "paymentReferenceId" TEXT,
    "shipmentProvider" TEXT,
    "shipmentOrderId" TEXT,
    "shipmentId" TEXT,
    "courierName" TEXT,
    "awb" TEXT,
    "trackingUrl" TEXT,
    "length" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "breadth" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "height" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "weight" DECIMAL(10,2) NOT NULL DEFAULT 0.5,
    "sellerGstin" TEXT,
    "buyerGstin" TEXT,
    "placeOfSupply" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "type" "SearchHistoryType" NOT NULL DEFAULT 'SEARCH',
    "query" TEXT NOT NULL,
    "categoryId" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordSearchSuggestion" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "suggestions" TEXT[],
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordSearchSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_admins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "profileImage" TEXT,
    "companyName" TEXT NOT NULL,
    "companyLogo" TEXT,
    "companyEmail" TEXT,
    "companyPhone" TEXT,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "businessType" "BusinessType" NOT NULL DEFAULT 'OTHER',
    "website" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "timezone" TEXT,
    "currency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "company_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseStaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT,
    "designation" TEXT,
    "phoneNumber" TEXT,
    "aadharNumber" TEXT,
    "panNumber" TEXT,
    "profileImage" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseStaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileDocument" (
    "id" TEXT NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" "FranchiseDocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "audience" "FaqAudience" NOT NULL DEFAULT 'ALL',
    "status" "FaqStatus" NOT NULL DEFAULT 'DRAFT',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subTitle" TEXT,
    "description" TEXT,
    "type" "BannerType" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "mobileImageUrl" TEXT,
    "ctaText" TEXT,
    "redirectType" "BannerRedirectType" NOT NULL,
    "redirectId" TEXT,
    "redirectUrl" TEXT,
    "shortCode" TEXT,
    "platform" "BannerPlatform" NOT NULL DEFAULT 'BOTH',
    "position" "BannerPosition" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "impressionCount" INTEGER NOT NULL DEFAULT 0,
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    "status" "BannerStatus" NOT NULL DEFAULT 'DRAFT',
    "campaignId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRole" (
    "id" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "franchiseId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionMatrix" (
    "moduleName" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL DEFAULT 'OWN',
    "actions" "PermissionAction"[],
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionMatrix_pkey" PRIMARY KEY ("roleId","moduleName")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "franchiseId" TEXT,
    "adminId" TEXT,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordResetTokenHash" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "franchiseOwnerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "deviceType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankDetails" (
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,

    CONSTRAINT "BankDetails_pkey" PRIMARY KEY ("userId","accountNumber")
);

-- CreateTable
CREATE TABLE "system_themes" (
    "id" TEXT NOT NULL,
    "panelType" "PanelType" NOT NULL DEFAULT 'ADMIN',
    "siteName" TEXT,
    "tagline" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "secondaryColor" TEXT NOT NULL DEFAULT '#64748b',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f8fafc',
    "surfaceColor" TEXT NOT NULL DEFAULT '#ffffff',
    "borderColor" TEXT NOT NULL DEFAULT '#e2e8f0',
    "headingColor" TEXT NOT NULL DEFAULT '#0f172a',
    "textColor" TEXT NOT NULL DEFAULT '#334155',
    "mutedColor" TEXT NOT NULL DEFAULT '#64748b',
    "sidebarBgColor" TEXT NOT NULL DEFAULT '#0f172a',
    "sidebarTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "sidebarActiveBgColor" TEXT NOT NULL DEFAULT '#1e293b',
    "sidebarActiveTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "sidebarHoverBgColor" TEXT NOT NULL DEFAULT '#334155',
    "sidebarHoverTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "sidebarFontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "sidebarBorderRadius" TEXT NOT NULL DEFAULT '8px',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "headingFontFamily" TEXT,
    "baseFontSize" TEXT NOT NULL DEFAULT '14px',
    "customCss" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL DEFAULT 'Gift Factory',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter, sans-serif',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#161615',
    "primaryColor" TEXT NOT NULL DEFAULT '#cc176b',
    "primaryForeground" TEXT NOT NULL DEFAULT '#ffffff',
    "secondaryColor" TEXT NOT NULL DEFAULT '#62182d',
    "secondaryForeground" TEXT NOT NULL DEFAULT '#ffffff',
    "borderColor" TEXT NOT NULL DEFAULT '#e0e0e0',
    "headerPromoBg" TEXT NOT NULL DEFAULT '#cc176b',
    "headerPromoText" TEXT NOT NULL DEFAULT '#ffffff',
    "headerCategoryPillBg" TEXT NOT NULL DEFAULT '#fde7f3',
    "headerCategoryPillText" TEXT NOT NULL DEFAULT '#cc176b',
    "footerBg" TEXT NOT NULL DEFAULT '#050b18',
    "footerText" TEXT NOT NULL DEFAULT '#cbd5e1',
    "footerBorder" TEXT NOT NULL DEFAULT '#0f172a',
    "cartBadgeBg" TEXT NOT NULL DEFAULT '#cc176b',
    "cartBadgeText" TEXT NOT NULL DEFAULT '#ffffff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "provider" "VerificationProvider" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "response" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionSnapshot" (
    "customerId" TEXT NOT NULL,
    "stage" "CustomerLifecycleStage" NOT NULL DEFAULT 'REGISTERED',
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalSpend" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "firstOrderAt" TIMESTAMP(3),
    "lastOrderAt" TIMESTAMP(3),
    "daysSinceLastOrder" INTEGER,
    "engagementCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionSnapshot_pkey" PRIMARY KEY ("customerId")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "customerId" TEXT,
    "source" "NewsletterSource" NOT NULL DEFAULT 'FOOTER',
    "status" "NewsletterStatus" NOT NULL DEFAULT 'SUBSCRIBED',
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openRate" DECIMAL(5,2),
    "clickRate" DECIMAL(5,2),
    "conversionRate" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterMetric" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "pointsAwarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "sourceType" "ReturnSourceType" NOT NULL,
    "orderId" TEXT,
    "stockRequestId" TEXT,
    "returnType" "ReturnType" NOT NULL,
    "status" "ReturnStatus" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "franchiseId" TEXT,
    "reason" TEXT,
    "remarks" TEXT,
    "exchangeOrderId" TEXT,
    "images" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentReturnId" TEXT,
    "warehouseReturnRequestId" TEXT,
    "disposition" "ReturnDisposition",
    "warehouseDisposition" "WarehouseDisposition",
    "warehouseId" TEXT,
    "courierName" TEXT,
    "awbNumber" TEXT,
    "trackingNumber" TEXT,
    "shipmentStatus" TEXT,
    "trackingEvents" JSONB,
    "requestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "inspectedByUserId" TEXT,
    "closedByUserId" TEXT,
    "receivedFranchiseId" TEXT,
    "receivedByUserId" TEXT,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "requestedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER,
    "approvedQty" INTEGER,
    "condition" "ReturnCondition",
    "warehouseDisposition" "WarehouseDisposition",
    "remarks" TEXT,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnInspection" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "inspectedById" TEXT NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "remarks" TEXT,
    "images" JSONB,
    "inspectedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRefund" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "RefundStatus" NOT NULL,
    "referenceNumber" TEXT,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ReturnRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnExchangeItem" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ReturnExchangeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "type" "ReturnInventoryMovementType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnMedia" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "type" "ReturnMediaType" NOT NULL,
    "files" TEXT[],
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnInventoryMovement" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "movementType" "ReturnMovementType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnInventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefectiveInventory" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "source" "DefectiveSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefectiveInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedInventory" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAddress_fullName_idx" ON "CustomerAddress"("fullName");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- CreateIndex
CREATE INDEX "CustomerAddress_postalCode_idx" ON "CustomerAddress"("postalCode");

-- CreateIndex
CREATE INDEX "RetailCustomer_franchiseId_updatedAt_idx" ON "RetailCustomer"("franchiseId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RetailCustomer_franchiseId_phoneNorm_key" ON "RetailCustomer"("franchiseId", "phoneNorm");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_latitude_longitude_idx" ON "Customer"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_code_key" ON "Franchise"("code");

-- CreateIndex
CREATE INDEX "Franchise_ownerPhone_idx" ON "Franchise"("ownerPhone");

-- CreateIndex
CREATE INDEX "Franchise_ownerEmail_idx" ON "Franchise"("ownerEmail");

-- CreateIndex
CREATE INDEX "Franchise_name_idx" ON "Franchise"("name");

-- CreateIndex
CREATE INDEX "Franchise_code_idx" ON "Franchise"("code");

-- CreateIndex
CREATE INDEX "Franchise_status_idx" ON "Franchise"("status");

-- CreateIndex
CREATE INDEX "Franchise_status_acceptingOrders_idx" ON "Franchise"("status", "acceptingOrders");

-- CreateIndex
CREATE INDEX "Franchise_createdAt_idx" ON "Franchise"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_franchiseId_key" ON "CreditAccount"("franchiseId");

-- CreateIndex
CREATE INDEX "CreditTransaction_franchiseId_createdAt_idx" ON "CreditTransaction"("franchiseId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_accountId_idx" ON "CreditTransaction"("accountId");

-- CreateIndex
CREATE INDEX "CreditDue_franchiseId_status_idx" ON "CreditDue"("franchiseId", "status");

-- CreateIndex
CREATE INDEX "CreditDue_dueDate_status_idx" ON "CreditDue"("dueDate", "status");

-- CreateIndex
CREATE INDEX "CreditProcessingEvent_franchiseId_type_idx" ON "CreditProcessingEvent"("franchiseId", "type");

-- CreateIndex
CREATE INDEX "CreditProcessingEvent_status_idx" ON "CreditProcessingEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_payoutCode_key" ON "Payout"("payoutCode");

-- CreateIndex
CREATE INDEX "Payout_franchiseId_idx" ON "Payout"("franchiseId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEvent_razorpayOrderId_key" ON "FinancialEvent"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEvent_razorpayPaymentId_key" ON "FinancialEvent"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeName_slug_key" ON "AttributeName"("slug");

-- CreateIndex
CREATE INDEX "AttributeName_title_idx" ON "AttributeName"("title");

-- CreateIndex
CREATE INDEX "AttributeName_slug_idx" ON "AttributeName"("slug");

-- CreateIndex
CREATE INDEX "AttributeValue_title_idx" ON "AttributeValue"("title");

-- CreateIndex
CREATE INDEX "AttributeValue_slug_idx" ON "AttributeValue"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeValue_slug_attributeNameId_key" ON "AttributeValue"("slug", "attributeNameId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_searchText_idx" ON "ProductVariant"("searchText");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_price_idx" ON "ProductVariant"("price");

-- CreateIndex
CREATE INDEX "ProductVariant_stock_idx" ON "ProductVariant"("stock");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_attributeSummary_key" ON "ProductVariant"("productId", "attributeSummary");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_isFeatured_idx" ON "Product"("isFeatured");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_visibility_idx" ON "Product"("visibility");

-- CreateIndex
CREATE INDEX "Product_viewCount_idx" ON "Product"("viewCount");

-- CreateIndex
CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VariantAttribute_attributeValueId_idx" ON "VariantAttribute"("attributeValueId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoMeta_productId_key" ON "SeoMeta"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderRequestId_key" ON "Order"("orderRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Order_franchiseId_channel_idx" ON "Order"("franchiseId", "channel");

-- CreateIndex
CREATE INDEX "Order_cartId_idx" ON "Order"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "StockRequest_invoiceNumber_key" ON "StockRequest"("invoiceNumber");

-- CreateIndex
CREATE INDEX "InboundDelivery_transportLaneId_idx" ON "InboundDelivery"("transportLaneId");

-- CreateIndex
CREATE INDEX "FranchiseReturn_franchiseId_status_idx" ON "FranchiseReturn"("franchiseId", "status");

-- CreateIndex
CREATE INDEX "FranchiseReturn_orderId_idx" ON "FranchiseReturn"("orderId");

-- CreateIndex
CREATE INDEX "FranchiseReturn_customerId_idx" ON "FranchiseReturn"("customerId");

-- CreateIndex
CREATE INDEX "FranchiseReturn_stockRequestId_idx" ON "FranchiseReturn"("stockRequestId");

-- CreateIndex
CREATE INDEX "FranchiseReturn_returnType_idx" ON "FranchiseReturn"("returnType");

-- CreateIndex
CREATE INDEX "FranchiseReturn_isDeleted_createdAt_idx" ON "FranchiseReturn"("isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnInventory_franchiseId_createdAt_idx" ON "ReturnInventory"("franchiseId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnInventory_productId_idx" ON "ReturnInventory"("productId");

-- CreateIndex
CREATE INDEX "ReturnInventory_sourceType_sourceId_idx" ON "ReturnInventory"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ReturnInventory_status_idx" ON "ReturnInventory"("status");

-- CreateIndex
CREATE INDEX "ReturnInventory_kind_idx" ON "ReturnInventory"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_slug_key" ON "Promotion"("slug");

-- CreateIndex
CREATE INDEX "PromotionProduct_productId_idx" ON "PromotionProduct"("productId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseNoticeRead_noticeId_userId_key" ON "FranchiseNoticeRead"("noticeId", "userId");

-- CreateIndex
CREATE INDEX "SupportTicket_franchiseId_status_idx" ON "SupportTicket"("franchiseId", "status");

-- CreateIndex
CREATE INDEX "FranchiseDocument_franchiseId_idx" ON "FranchiseDocument"("franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseDocument_franchiseId_kind_key" ON "FranchiseDocument"("franchiseId", "kind");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockingNode_code_key" ON "StockingNode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockingNode_franchiseId_key" ON "StockingNode"("franchiseId");

-- CreateIndex
CREATE INDEX "StockingNode_parentId_idx" ON "StockingNode"("parentId");

-- CreateIndex
CREATE INDEX "StockingNode_type_active_idx" ON "StockingNode"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TransportLane_code_key" ON "TransportLane"("code");

-- CreateIndex
CREATE INDEX "TransportLane_originNodeId_destNodeId_idx" ON "TransportLane"("originNodeId", "destNodeId");

-- CreateIndex
CREATE INDEX "StockTransfer_fromNodeId_status_idx" ON "StockTransfer"("fromNodeId", "status");

-- CreateIndex
CREATE INDEX "StockTransfer_toNodeId_status_idx" ON "StockTransfer"("toNodeId", "status");

-- CreateIndex
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferLine_variantId_idx" ON "StockTransferLine"("variantId");

-- CreateIndex
CREATE INDEX "ReplenishmentPolicy_franchiseId_active_idx" ON "ReplenishmentPolicy"("franchiseId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentPolicy_franchiseId_productId_key" ON "ReplenishmentPolicy"("franchiseId", "productId");

-- CreateIndex
CREATE INDEX "SupplyChainEvent_productId_createdAt_idx" ON "SupplyChainEvent"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplyChainEvent_variantId_createdAt_idx" ON "SupplyChainEvent"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplyChainEvent_stockingNodeId_createdAt_idx" ON "SupplyChainEvent"("stockingNodeId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplyChainEvent_eventName_createdAt_idx" ON "SupplyChainEvent"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "DomainEventOutbox_status_createdAt_idx" ON "DomainEventOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DomainEventOutbox_status_nextRetryAt_idx" ON "DomainEventOutbox"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_kind_status_createdAt_idx" ON "InventoryReservation"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_orderId_status_idx" ON "InventoryReservation"("orderId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_orderRequestId_status_idx" ON "InventoryReservation"("orderRequestId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_proposalId_status_idx" ON "InventoryReservation"("proposalId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_stockRequestId_status_idx" ON "InventoryReservation"("stockRequestId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_franchiseId_status_idx" ON "InventoryReservation"("franchiseId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRequest_actualOrderId_key" ON "OrderRequest"("actualOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRequest_warehouseFulfillmentOrderId_key" ON "OrderRequest"("warehouseFulfillmentOrderId");

-- CreateIndex
CREATE INDEX "OrderRequest_customerId_createdAt_idx" ON "OrderRequest"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OrderRequest_status_createdAt_idx" ON "OrderRequest"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OrderRequest_selectedFranchiseId_status_idx" ON "OrderRequest"("selectedFranchiseId", "status");

-- CreateIndex
CREATE INDEX "OrderRequest_cartId_idx" ON "OrderRequest"("cartId");

-- CreateIndex
CREATE INDEX "OrderRequestItem_requestId_idx" ON "OrderRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "OrderRequestItem_productId_idx" ON "OrderRequestItem"("productId");

-- CreateIndex
CREATE INDEX "OrderRequestItem_variantId_idx" ON "OrderRequestItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseProposal_proposalCode_key" ON "FranchiseProposal"("proposalCode");

-- CreateIndex
CREATE INDEX "FranchiseProposal_requestId_status_idx" ON "FranchiseProposal"("requestId", "status");

-- CreateIndex
CREATE INDEX "FranchiseProposal_franchiseId_status_idx" ON "FranchiseProposal"("franchiseId", "status");

-- CreateIndex
CREATE INDEX "FranchiseProposal_status_expiresAt_idx" ON "FranchiseProposal"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseProposal_requestId_franchiseId_key" ON "FranchiseProposal"("requestId", "franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseProposal_requestId_attemptNumber_key" ON "FranchiseProposal"("requestId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseFulfillmentOrder_fulfillmentNumber_key" ON "WarehouseFulfillmentOrder"("fulfillmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseFulfillmentOrder_requestId_key" ON "WarehouseFulfillmentOrder"("requestId");

-- CreateIndex
CREATE INDEX "WarehouseFulfillmentOrder_status_createdAt_idx" ON "WarehouseFulfillmentOrder"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WarehouseFulfillmentOrderItem_warehouseFulfillmentOrderId_idx" ON "WarehouseFulfillmentOrderItem"("warehouseFulfillmentOrderId");

-- CreateIndex
CREATE INDEX "WarehouseFulfillmentOrderItem_productId_idx" ON "WarehouseFulfillmentOrderItem"("productId");

-- CreateIndex
CREATE INDEX "Cart_userId_idx" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "Cart_status_expiresAt_lockExpiresAt_idx" ON "Cart"("status", "expiresAt", "lockExpiresAt");

-- CreateIndex
CREATE INDEX "Cart_sessionId_status_idx" ON "Cart"("sessionId", "status");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_key" ON "CartItem"("cartId", "productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_code_key" ON "Discount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_userId_productId_orderId_key" ON "ProductReview"("userId", "productId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentId_key" ON "Shipment"("shipmentId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_stockRequestId_idx" ON "Invoice"("stockRequestId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_awb_idx" ON "Invoice"("awb");

-- CreateIndex
CREATE INDEX "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");

-- CreateIndex
CREATE INDEX "SearchHistory_customerId_createdAt_idx" ON "SearchHistory"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SearchHistory_customerId_type_createdAt_idx" ON "SearchHistory"("customerId", "type", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "KeywordSearchSuggestion_query_key" ON "KeywordSearchSuggestion"("query");

-- CreateIndex
CREATE INDEX "KeywordSearchSuggestion_query_idx" ON "KeywordSearchSuggestion"("query");

-- CreateIndex
CREATE UNIQUE INDEX "company_admins_userId_key" ON "company_admins"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_admins_code_key" ON "company_admins"("code");

-- CreateIndex
CREATE INDEX "company_admins_companyName_idx" ON "company_admins"("companyName");

-- CreateIndex
CREATE INDEX "company_admins_city_state_idx" ON "company_admins"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseStaffProfile_userId_key" ON "FranchiseStaffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseStaffProfile_code_key" ON "FranchiseStaffProfile"("code");

-- CreateIndex
CREATE INDEX "ProfileDocument_ownerType_ownerId_idx" ON "ProfileDocument"("ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileDocument_ownerType_ownerId_kind_key" ON "ProfileDocument"("ownerType", "ownerId", "kind");

-- CreateIndex
CREATE INDEX "Faq_audience_status_isVisible_isDeleted_idx" ON "Faq"("audience", "status", "isVisible", "isDeleted");

-- CreateIndex
CREATE INDEX "Faq_createdById_isDeleted_idx" ON "Faq"("createdById", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Banner_shortCode_key" ON "Banner"("shortCode");

-- CreateIndex
CREATE INDEX "Banner_status_type_position_priority_idx" ON "Banner"("status", "type", "position", "priority");

-- CreateIndex
CREATE INDEX "Banner_platform_idx" ON "Banner"("platform");

-- CreateIndex
CREATE INDEX "Banner_campaignId_status_idx" ON "Banner"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Banner_startDate_endDate_idx" ON "Banner"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Banner_endDate_idx" ON "Banner"("endDate");

-- CreateIndex
CREATE INDEX "AppRole_franchiseId_idx" ON "AppRole"("franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "AppRole_roleName_franchiseId_key" ON "AppRole"("roleName", "franchiseId");

-- CreateIndex
CREATE INDEX "PermissionMatrix_roleId_idx" ON "PermissionMatrix"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_fcmToken_key" ON "UserDevice"("fcmToken");

-- CreateIndex
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice"("userId");

-- CreateIndex
CREATE INDEX "UserDevice_isActive_idx" ON "UserDevice"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BankDetails_userId_key" ON "BankDetails"("userId");

-- CreateIndex
CREATE INDEX "VerificationRecord_userId_idx" ON "VerificationRecord"("userId");

-- CreateIndex
CREATE INDEX "VerificationRecord_type_idx" ON "VerificationRecord"("type");

-- CreateIndex
CREATE INDEX "VerificationRecord_status_idx" ON "VerificationRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionSnapshot_customerId_key" ON "RetentionSnapshot"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionSnapshot_referralCode_key" ON "RetentionSnapshot"("referralCode");

-- CreateIndex
CREATE INDEX "RetentionSnapshot_stage_idx" ON "RetentionSnapshot"("stage");

-- CreateIndex
CREATE INDEX "RetentionSnapshot_tier_idx" ON "RetentionSnapshot"("tier");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_customerId_idx" ON "LoyaltyTransaction"("customerId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_createdAt_idx" ON "LoyaltyTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_email_idx" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_customerId_idx" ON "NewsletterSubscriber"("customerId");

-- CreateIndex
CREATE INDEX "NewsletterMetric_campaignId_idx" ON "NewsletterMetric"("campaignId");

-- CreateIndex
CREATE INDEX "NewsletterMetric_subscriberId_idx" ON "NewsletterMetric"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeId_key" ON "Referral"("refereeId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_refereeId_idx" ON "Referral"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_returnNumber_key" ON "ReturnRequest"("returnNumber");

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailCustomer" ADD CONSTRAINT "RetailCustomer_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseSettlement" ADD CONSTRAINT "FranchiseSettlement_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "FinancialEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_attributeNameId_fkey" FOREIGN KEY ("attributeNameId") REFERENCES "AttributeName"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantAttribute" ADD CONSTRAINT "VariantAttribute_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantAttribute" ADD CONSTRAINT "VariantAttribute_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "AttributeValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoMeta" ADD CONSTRAINT "SeoMeta_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseStock" ADD CONSTRAINT "FranchiseStock_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseStock" ADD CONSTRAINT "FranchiseStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_orderRequestId_fkey" FOREIGN KEY ("orderRequestId") REFERENCES "OrderRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_retailCustomerId_fkey" FOREIGN KEY ("retailCustomerId") REFERENCES "RetailCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDelivery" ADD CONSTRAINT "InboundDelivery_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDelivery" ADD CONSTRAINT "InboundDelivery_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDelivery" ADD CONSTRAINT "InboundDelivery_transportLaneId_fkey" FOREIGN KEY ("transportLaneId") REFERENCES "TransportLane"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseReturn" ADD CONSTRAINT "FranchiseReturn_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseReturn" ADD CONSTRAINT "FranchiseReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseReturn" ADD CONSTRAINT "FranchiseReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseReturn" ADD CONSTRAINT "FranchiseReturn_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInventory" ADD CONSTRAINT "ReturnInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInventory" ADD CONSTRAINT "ReturnInventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInventory" ADD CONSTRAINT "ReturnInventory_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInventory" ADD CONSTRAINT "ReturnInventory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseNotice" ADD CONSTRAINT "FranchiseNotice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseNotice" ADD CONSTRAINT "FranchiseNotice_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseNoticeRead" ADD CONSTRAINT "FranchiseNoticeRead_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "FranchiseNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseNoticeRead" ADD CONSTRAINT "FranchiseNoticeRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseDocument" ADD CONSTRAINT "FranchiseDocument_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseDocument" ADD CONSTRAINT "FranchiseDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseDocument" ADD CONSTRAINT "FranchiseDocument_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockingNode" ADD CONSTRAINT "StockingNode_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockingNode" ADD CONSTRAINT "StockingNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StockingNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubInventory" ADD CONSTRAINT "HubInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubInventory" ADD CONSTRAINT "HubInventory_stockingNodeId_fkey" FOREIGN KEY ("stockingNodeId") REFERENCES "StockingNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLane" ADD CONSTRAINT "TransportLane_destNodeId_fkey" FOREIGN KEY ("destNodeId") REFERENCES "StockingNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLane" ADD CONSTRAINT "TransportLane_originNodeId_fkey" FOREIGN KEY ("originNodeId") REFERENCES "StockingNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "StockingNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "StockingNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentPolicy" ADD CONSTRAINT "ReplenishmentPolicy_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentPolicy" ADD CONSTRAINT "ReplenishmentPolicy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyChainEvent" ADD CONSTRAINT "SupplyChainEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyChainEvent" ADD CONSTRAINT "SupplyChainEvent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyChainEvent" ADD CONSTRAINT "SupplyChainEvent_stockingNodeId_fkey" FOREIGN KEY ("stockingNodeId") REFERENCES "StockingNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderRequestId_fkey" FOREIGN KEY ("orderRequestId") REFERENCES "OrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "FranchiseProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRequest" ADD CONSTRAINT "OrderRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRequest" ADD CONSTRAINT "OrderRequest_selectedFranchiseId_fkey" FOREIGN KEY ("selectedFranchiseId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRequestItem" ADD CONSTRAINT "OrderRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRequestItem" ADD CONSTRAINT "OrderRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRequestItem" ADD CONSTRAINT "OrderRequestItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseProposal" ADD CONSTRAINT "FranchiseProposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseProposal" ADD CONSTRAINT "FranchiseProposal_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseFulfillmentOrder" ADD CONSTRAINT "WarehouseFulfillmentOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseFulfillmentOrderItem" ADD CONSTRAINT "WarehouseFulfillmentOrderItem_warehouseFulfillmentOrderId_fkey" FOREIGN KEY ("warehouseFulfillmentOrderId") REFERENCES "WarehouseFulfillmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseFulfillmentOrderItem" ADD CONSTRAINT "WarehouseFulfillmentOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseFulfillmentOrderItem" ADD CONSTRAINT "WarehouseFulfillmentOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_admins" ADD CONSTRAINT "company_admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseStaffProfile" ADD CONSTRAINT "FranchiseStaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileDocument" ADD CONSTRAINT "ProfileDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileDocument" ADD CONSTRAINT "ProfileDocument_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppRole" ADD CONSTRAINT "AppRole_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionMatrix" ADD CONSTRAINT "PermissionMatrix_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AppRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AppRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_franchiseOwnerId_fkey" FOREIGN KEY ("franchiseOwnerId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDetails" ADD CONSTRAINT "BankDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRecord" ADD CONSTRAINT "VerificationRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionSnapshot" ADD CONSTRAINT "RetentionSnapshot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterMetric" ADD CONSTRAINT "NewsletterMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_receivedFranchiseId_fkey" FOREIGN KEY ("receivedFranchiseId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInspection" ADD CONSTRAINT "ReturnInspection_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInspection" ADD CONSTRAINT "ReturnInspection_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRefund" ADD CONSTRAINT "ReturnRefund_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnExchangeItem" ADD CONSTRAINT "ReturnExchangeItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnExchangeItem" ADD CONSTRAINT "ReturnExchangeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnExchangeItem" ADD CONSTRAINT "ReturnExchangeItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnMedia" ADD CONSTRAINT "ReturnMedia_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnMedia" ADD CONSTRAINT "ReturnMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInventoryMovement" ADD CONSTRAINT "ReturnInventoryMovement_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInventoryMovement" ADD CONSTRAINT "ReturnInventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInventoryMovement" ADD CONSTRAINT "ReturnInventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefectiveInventory" ADD CONSTRAINT "DefectiveInventory_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefectiveInventory" ADD CONSTRAINT "DefectiveInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefectiveInventory" ADD CONSTRAINT "DefectiveInventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedInventory" ADD CONSTRAINT "BlockedInventory_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedInventory" ADD CONSTRAINT "BlockedInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedInventory" ADD CONSTRAINT "BlockedInventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
