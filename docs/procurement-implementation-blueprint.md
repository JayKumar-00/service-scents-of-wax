# Gift Factory Procurement & Inventory Management Blueprint

## 1. Executive Summary

This blueprint introduces a procurement-first inventory model for Gift Factory while preserving the current warehouse, stock-request, delivery, and supply-chain flows. The design is intentionally aligned with existing NestJS + Prisma + PostgreSQL + Redis + BullMQ patterns already present in this repository.

Key goals:
- Make warehouse inventory procurement-driven.
- Introduce supplier, purchase order, ASN, GRN, quality control, ledger, valuation, and dashboard capabilities.
- Preserve current stock-request and inbound-delivery behavior by making procurement upstream of warehouse availability.
- Ensure no stock enters sellable inventory through ad-hoc manual adjustments except controlled adjustment workflows.

## 2. Business Architecture

### 2.1 Core Business Domains

1. Supplier Management
   - Supplier master data and onboarding.
   - Status lifecycle: ACTIVE, INACTIVE, BLOCKED.

2. Procurement Ordering
   - Purchase order creation, approval, dispatch, and lifecycle tracking.
   - Status lifecycle: DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_RECEIVED → RECEIVED → CLOSED → CANCELLED.

3. Receiving & Logistics
   - ASN for pre-arrival notification.
   - GRN for actual goods receipt and inventory posting.

4. Quality Control
   - Inspection of received goods.
   - Failed or partial goods routed to blocked inventory.

5. Inventory Control
   - Immutable ledger for every stock movement.
   - Procurement-driven warehouse stock increase.
   - Inventory valuation using weighted average and landed cost.

6. Franchise Fulfillment
   - Stock requests and inbound deliveries remain the downstream execution path.
   - Starter bundles consume warehouse stock through existing supply-chain handling.

### 2.2 Non-Breaking Design Principles

- Existing stock requests continue to work as the franchise demand channel.
- Existing warehouse stock and franchise stock remain the inventory surfaces.
- New procurement flows only change how stock arrives into warehouse inventory.
- Manual stock adjustment remains available, but only for approved discrepancy workflows.

---

## 3. Domain-Driven Design

### 3.1 Aggregates

- SupplierAggregate
  - Supplier master and bank/payment metadata.
  - Owns supplier status, onboarding state, and audit history.

- PurchaseOrderAggregate
  - Header + lines + approvals + lifecycle.
  - Emits domain events on state transition.

- AsnAggregate
  - Supplier shipment notification and shipment lines.
  - Tracks expected arrival and receiving readiness.

- GoodsReceiptAggregate
  - GRN header + lines + quality outcome + posting state.
  - Central aggregate for inventory increase.

- QualityInspectionAggregate
  - QC template, checklist, result, and re-inspection state.

- InventoryLedgerAggregate
  - Immutable ledger entries and valuation snapshots.

- BundleAllocationAggregate
  - Franchise starter bundle fulfillment from warehouse stock.

### 3.2 Value Objects

- MoneyAmount
- Quantity
- SupplierReference
- WarehouseReference
- ProductReference
- ApprovalDecision
- InventoryDisposition

### 3.3 Domain Events

- PurchaseOrderCreated
- PurchaseOrderApproved
- PurchaseOrderSentToSupplier
- AsnCreated
- AsnArrived
- GrnDrafted
- GrnQualityChecked
- GrnPosted
- InventoryLedgerCommitted
- InventoryValuationRecomputed
- BundleAllocationRequested
- BundleAllocationFailed
- BundleShortStockDetected

---

## 4. Database Schema

The schema should be added alongside the existing warehouse and supply-chain models in Prisma.

### 4.1 Core Enums

```prisma
enum ProcurementSupplierStatus {
  ACTIVE
  INACTIVE
  BLOCKED
}

enum PurchaseOrderStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  SENT
  PARTIALLY_RECEIVED
  RECEIVED
  CLOSED
  CANCELLED
}

enum AsnStatus {
  DRAFT
  SUBMITTED
  IN_TRANSIT
  ARRIVED
  CANCELLED
}

enum GrnStatus {
  DRAFT
  QUALITY_CHECK_PENDING
  QUALITY_CHECK_PASSED
  QUALITY_CHECK_FAILED
  POSTED
  REVERSED
  CANCELLED
}

enum QualityInspectionStatus {
  PENDING
  PASSED
  FAILED
  PARTIAL
}

enum LedgerEntryType {
  PURCHASE
  SALE
  RETURN
  TRANSFER
  DAMAGE
  ADJUSTMENT
  BUNDLE_ALLOCATION
}

enum ApprovalDecision {
  APPROVED
  REJECTED
  PENDING
}
```

### 4.2 Proposed Prisma Models

```prisma
model Supplier {
  id                String                  @id @default(cuid())
  code              String                  @unique
  name              String
  contactPerson     String?
  email             String?
  phone             String?
  gstNumber         String?
  panNumber         String?
  address           String?
  paymentTerms      String?
  bankDetails       Json?
  notes             String?
  status            ProcurementSupplierStatus @default(ACTIVE)
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt
  purchaseOrders    PurchaseOrder[]
  asns              Asn[]
  grns              GoodsReceiptNote[]
  auditLogs         ProcurementAuditLog[]
}

model PurchaseOrder {
  id                  String              @id @default(cuid())
  poNumber            String              @unique
  supplierId          String
  warehouseNodeId     String?
  currency            String              @default("INR")
  expectedDeliveryDate DateTime?
  status              PurchaseOrderStatus @default(DRAFT)
  notes               String?
  totalAmount         Decimal?            @db.Decimal(12, 2)
  createdByUserId     String?
  approvedByUserId    String?
  approvedAt          DateTime?
  sentAt              DateTime?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  supplier            Supplier            @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  warehouseNode       StockingNode?       @relation(fields: [warehouseNodeId], references: [id])
  lines               PurchaseOrderLine[]
  asns                Asn[]
  grns                GoodsReceiptNote[]
  approvals           PurchaseOrderApproval[]
  auditLogs           ProcurementAuditLog[]
}

model PurchaseOrderLine {
  id                String          @id @default(cuid())
  purchaseOrderId   String
  productId         String
  variantId         String?
  orderedQty        Int
  unitCost          Decimal         @db.Decimal(12, 2)
  gstPercent        Decimal?        @db.Decimal(5, 2)
  lineTotal         Decimal         @db.Decimal(12, 2)
  receivedQty       Int             @default(0)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  purchaseOrder     PurchaseOrder   @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  product           Product         @relation(fields: [productId], references: [id])
  variant           ProductVariant? @relation(fields: [variantId], references: [id])
  grnLines          GrnLine[]
}

model Asn {
  id                  String      @id @default(cuid())
  asnNumber           String      @unique
  purchaseOrderId     String?
  supplierId          String
  supplierInvoiceNo  String?
  vehicleNumber       String?
  courier             String?
  trackingNumber     String?
  expectedArrival     DateTime?
  status              AsnStatus   @default(DRAFT)
  shipmentNote        String?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  purchaseOrder       PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id])
  supplier            Supplier       @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  lines               AsnLine[]
  grns                GoodsReceiptNote[]
}

model AsnLine {
  id            String   @id @default(cuid())
  asnId         String
  purchaseOrderLineId String?
  productId     String
  variantId     String?
  expectedQty   Int
  shippedQty    Int      @default(0)
  createdAt     DateTime @default(now())

  asn           Asn            @relation(fields: [asnId], references: [id], onDelete: Cascade)
  purchaseOrderLine PurchaseOrderLine? @relation(fields: [purchaseOrderLineId], references: [id])
  product       Product        @relation(fields: [productId], references: [id])
  variant       ProductVariant? @relation(fields: [variantId], references: [id])
}

model GoodsReceiptNote {
  id                  String          @id @default(cuid())
  grnNumber           String          @unique
  purchaseOrderId     String
  asnId               String?
  supplierId          String
  warehouseNodeId     String?
  status              GrnStatus       @default(DRAFT)
  postedAt            DateTime?
  postedByUserId      String?
  reversalReason      String?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  purchaseOrder       PurchaseOrder   @relation(fields: [purchaseOrderId], references: [id], onDelete: Restrict)
  asn                 Asn?            @relation(fields: [asnId], references: [id])
  supplier            Supplier        @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  warehouseNode       StockingNode?   @relation(fields: [warehouseNodeId], references: [id])
  lines               GrnLine[]
  qualityInspections  QualityInspection[]
  ledgerEntries       InventoryLedgerEntry[]
}

model GrnLine {
  id                  String             @id @default(cuid())
  grnId               String
  purchaseOrderLineId String
  productId           String
  variantId           String?
  receivedQty         Int
  acceptedQty         Int
  damagedQty          Int
  rejectedQty         Int
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  grn                 GoodsReceiptNote   @relation(fields: [grnId], references: [id], onDelete: Cascade)
  purchaseOrderLine   PurchaseOrderLine  @relation(fields: [purchaseOrderLineId], references: [id])
  product             Product            @relation(fields: [productId], references: [id])
  variant             ProductVariant?    @relation(fields: [variantId], references: [id])
  qualityInspection   QualityInspection?
}

model QualityInspection {
  id                  String                  @id @default(cuid())
  grnId               String
  grnLineId           String?                @unique
  templateId          String?
  status              QualityInspectionStatus @default(PENDING)
  inspectedByUserId   String?
  inspectedAt         DateTime?
  approvedByUserId    String?
  approvedAt          DateTime?
  notes               String?
  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt

  grn                 GoodsReceiptNote        @relation(fields: [grnId], references: [id], onDelete: Cascade)
  grnLine             GrnLine?                @relation(fields: [grnLineId], references: [id])
  results             QualityInspectionResult[]
}

model QualityInspectionResult {
  id                  String   @id @default(cuid())
  inspectionId        String
  checklistKey        String
  expectedValue       String?
  actualValue         String?
  passed              Boolean
  createdAt           DateTime @default(now())

  inspection          QualityInspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)
}

model InventoryLedgerEntry {
  id                  String          @id @default(cuid())
  grnId               String?
  productId           String
  variantId           String?
  warehouseNodeId     String?
  transactionType     LedgerEntryType
  quantity            Int
  unitCost            Decimal         @db.Decimal(12, 2)
  runningBalance      Int
  referenceType       String
  referenceId         String
  note                String?
  createdAt           DateTime        @default(now())

  grn                 GoodsReceiptNote? @relation(fields: [grnId], references: [id])
  product             Product          @relation(fields: [productId], references: [id])
  variant             ProductVariant?  @relation(fields: [variantId], references: [id])
  warehouseNode       StockingNode?    @relation(fields: [warehouseNodeId], references: [id])
}

model InventoryValuationSnapshot {
  id                  String   @id @default(cuid())
  productId           String
  variantId           String?
  warehouseNodeId     String?
  onHandQty           Int
  weightedAvgCost     Decimal  @db.Decimal(12, 2)
  landedCost          Decimal  @db.Decimal(12, 2)
  inventoryValue      Decimal  @db.Decimal(12, 2)
  sourceRefType       String
  sourceRefId         String
  createdAt           DateTime @default(now())
}

model ProcurementApproval {
  id                 String            @id @default(cuid())
  entityType         String
  entityId           String
  approverUserId     String
  decision           ApprovalDecision
  comment            String?
  createdAt          DateTime          @default(now())
}

model ProcurementAuditLog {
  id                 String   @id @default(cuid())
  entityType         String
  entityId           String
  action             String
  actorUserId        String?
  details            Json?
  createdAt          DateTime @default(now())

  supplier           Supplier? @relation(fields: [id], references: [id])
  purchaseOrder      PurchaseOrder? @relation(fields: [id], references: [id])
}
```

---

## 5. Module Structure

Add a new procurement domain under the existing NestJS application structure:

```text
src/procurement/
  procurement.module.ts
  procurement.controller.ts
  procurement.service.ts
  suppliers/
    suppliers.controller.ts
    suppliers.service.ts
    dto/
  purchase-orders/
    purchase-orders.controller.ts
    purchase-orders.service.ts
    dto/
  asn/
    asn.controller.ts
    asn.service.ts
    dto/
  grn/
    grn.controller.ts
    grn.service.ts
    dto/
  qc/
    qc.controller.ts
    qc.service.ts
    dto/
  ledger/
    ledger.service.ts
  valuation/
    valuation.service.ts
  dashboard/
    dashboard.service.ts
  events/
    procurement-events.service.ts
  jobs/
    procurement.jobs.ts
```

### 5.1 Integration With Existing Modules

- Reuse existing inventory surfaces: WarehouseStock, FranchiseStock, StockingNode, InventoryReservation.
- Reuse existing supply-chain event infrastructure: SupplyChainEvent and DomainEventOutbox.
- Reuse existing audit service: AuditService.
- Reuse existing Redis and BullMQ setup for queues and distributed locking.

---

## 6. API Endpoints

### Supplier Endpoints

- POST /procurement/suppliers
- GET /procurement/suppliers
- GET /procurement/suppliers/:id
- PATCH /procurement/suppliers/:id
- PATCH /procurement/suppliers/:id/status

### Purchase Order Endpoints

- POST /procurement/purchase-orders
- GET /procurement/purchase-orders
- GET /procurement/purchase-orders/:id
- PATCH /procurement/purchase-orders/:id
- POST /procurement/purchase-orders/:id/approve
- POST /procurement/purchase-orders/:id/send
- POST /procurement/purchase-orders/:id/cancel

### ASN Endpoints

- POST /procurement/asn
- GET /procurement/asn
- GET /procurement/asn/:id
- PATCH /procurement/asn/:id/submit
- PATCH /procurement/asn/:id/arrive

### GRN Endpoints

- POST /procurement/grn
- GET /procurement/grn
- GET /procurement/grn/:id
- PATCH /procurement/grn/:id/quality-check
- POST /procurement/grn/:id/post
- POST /procurement/grn/:id/reverse

### QC Endpoints

- POST /procurement/qc/templates
- POST /procurement/qc/inspections
- PATCH /procurement/qc/inspections/:id/approve
- POST /procurement/qc/inspections/:id/reinspect

### Ledger & Valuation Endpoints

- GET /procurement/ledger
- GET /procurement/ledger/products/:productId
- GET /procurement/valuation
- GET /procurement/valuation/history

### Dashboard Endpoints

- GET /procurement/dashboard/summary
- GET /procurement/dashboard/supplier-performance
- GET /procurement/dashboard/low-stock

---

## 7. Service Layer Design

### 7.1 SupplierService

Responsibilities:
- Create/update supplier master data.
- Enforce status rules and validation.
- Emit audit events.

### 7.2 PurchaseOrderService

Responsibilities:
- Create draft purchase orders.
- Validate supplier, warehouse, product, and pricing data.
- Enforce state transitions.
- Manage approval workflow and domain events.

### 7.3 AsnService

Responsibilities:
- Create ASN before delivery.
- Track expected arrival, courier, and shipment metadata.
- Link ASN to PO and receive shipment lines.

### 7.4 GrnService

Responsibilities:
- Create GRN drafts.
- Validate that received + damaged + rejected = received quantity.
- Trigger QC workflow.
- Post inventory only once per GRN.
- Create immutable ledger entries and update valuation.

### 7.5 QualityInspectionService

Responsibilities:
- Evaluate goods against QC template and checklist.
- Route passed, failed, or partial goods to proper inventory disposition.
- Move failed inventory to blocked inventory and prevent sellable stock consumption.

### 7.6 InventoryLedgerService

Responsibilities:
- Write immutable movement entries.
- Maintain running balances.
- Support reporting and reconciliation.

### 7.7 InventoryValuationService

Responsibilities:
- Recompute weighted average cost after each GRN.
- Maintain landed cost components.
- Persist valuation snapshots for historical reporting.

### 7.8 DashboardService

Responsibilities:
- Aggregate procurement and warehouse KPIs.
- Expose executive and operational metrics.

---

## 8. Event-Driven Architecture

### 8.1 Domain Events

Use the existing outbox pattern to publish procurement events:
- PurchaseOrderCreated
- PurchaseOrderApproved
- AsnSubmitted
- GrnPosted
- InventoryLedgerCommitted
- InventoryValuationUpdated
- BundleAllocationRequested

### 8.2 Event Consumers

- Notification service for supplier and warehouse stakeholders.
- BullMQ jobs for valuation recomputation and dashboard aggregation.
- Supply-chain event propagation for warehouse inventory changes.

---

## 9. Redis Usage

Use Redis for:
- Distributed locks during GRN posting.
- Temporary cache for dashboard metrics.
- Idempotency keys and request deduplication.
- Rate limiting on supplier and procurement APIs.

Suggested keys:
- procurement:grn:{grnId}:lock
- procurement:po:{poId}:approval
- procurement:dashboard:summary

---

## 10. BullMQ Jobs

### 10.1 Recommended Queues

- procurement-po-approval
- procurement-asn-ingest
- procurement-grn-posting
- procurement-qc-result-sync
- procurement-valuation-recompute
- procurement-dashboard-refresh
- procurement-bundle-allocation

### 10.2 Job Responsibilities

- PO approval notifications.
- ASN arrival reminders.
- GRN posting replay protection.
- QC result handling.
- Inventory valuation recomputation.
- Starter bundle allocation retries.

### 10.3 Retry Policy

- Retry 3–5 times with exponential backoff.
- Persist failure reasons in the job payload and audit logs.

---

## 11. Audit Logging

All procurement actions must write audit records.

### 11.1 Audit Fields

- entityType
- entityId
- action
- actorUserId
- createdAt
- details

### 11.2 Audit Events

- supplier created/updated/blocked
- PO created/approved/sent/cancelled
- ASN submitted/arrived
- GRN created/quality-checked/posted/reversed
- QC result approved/rejected
- inventory ledger committed
- valuation recomputed

---

## 12. Inventory Algorithms

### 12.1 GRN Posting Algorithm

A GRN may post only if the following rule holds:

$$
acceptedQty + damagedQty + rejectedQty = receivedQty
$$

### 12.2 Inventory Increase Rule

Warehouse inventory increases only through POSTED GRN lines.

```ts
if (grn.status !== 'POSTED') {
  throw new BadRequestException('GRN is not posted');
}

const delta = acceptedQty;
warehouseStock.quantity += delta;
warehouseStock.reserved += 0;
```

### 12.3 Stock Allocation Rule

- Sellable stock = warehouse quantity minus reserved quantity.
- Damaged and rejected goods must not become sellable stock.
- Blocked stock is tracked separately and never consumed for normal stock requests.

### 12.4 Weighted Average Cost Formula

$$
newWeightedAvgCost = \frac{(existingOnHandQty \times existingCost) + (receivedQty \times unitCost)}{existingOnHandQty + receivedQty}
$$

### 12.5 Landed Cost

$$
landedCost = unitCost + inboundFreight + customs + handling + insurance
$$

---

## 13. Concurrency Controls

### 13.1 Required Controls

- Use Prisma transactions for inventory updates.
- Acquire Redis lock before posting a GRN.
- Enforce idempotency on GRN posting by using a unique posting key.
- Apply row-level locking on WarehouseStock and corresponding ledger records.

### 13.2 Idempotency Strategy

- Store a posting token in the GRN record.
- Reject repeated posting requests for the same GRN.

---

## 14. Transaction Boundaries

### GRN Posting Transaction Flow

1. Start Prisma transaction.
2. Lock GRN and related PO lines.
3. Validate line math and quality status.
4. Update WarehouseStock.
5. Create ledger entries.
6. Write valuation snapshot.
7. Update GRN status to POSTED.
8. Commit transaction.
9. Publish outbox event.

### Why This Matters

This keeps procurement inventory changes atomic and prevents partial stock increase.

---

## 15. Security Controls

- RBAC guarded endpoints for admin and franchise roles.
- Validate supplier PAN/GST formats.
- Enforce approval permissions for PO and GRN posting.
- Audit every create/update/post action.
- Restrict sensitive bank details to privileged staff.
- Encrypt or mask bank details in responses.
- Require signed or internal-only webhook propagation for downstream systems.

---

## 16. RBAC Matrix

| Capability | Super Admin | Admin Staff | Franchise Owner | Franchise Staff | Franchise Auditor |
|---|---|---|---|---|---|
| Manage suppliers | Yes | Yes | No | No | No |
| Create PO | Yes | Yes | No | No | No |
| Approve PO | Yes | Yes | No | No | No |
| Create ASN | Yes | Yes | No | No | No |
| Post GRN | Yes | Yes | No | No | No |
| QC approval | Yes | Yes | No | No | No |
| View procurement dashboard | Yes | Yes | Yes | Limited | Yes |
| Create starter bundle request | No | No | Yes | Yes | No |

---

## 17. Admin UI Design

### 17.1 Screens

- Supplier Master List
- Supplier Detail and Edit Screen
- Purchase Order List and Create Screen
- PO Detail with approval timeline
- ASN List and Detail
- GRN List and Posting Screen
- QC Inspection Queue
- Inventory Ledger and Valuation screens
- Procurement Dashboard

### 17.2 UX Requirements

- Inline validation for PO lines and GRN math.
- Bulk upload for supplier imports.
- Timeline view for PO/ASN/GRN life cycle.
- Clear blocked inventory and damaged goods visualization.

---

## 18. Franchise UI Design

### 18.1 Screens

- Bundle request creation
- Bundle approval status
- Inbound delivery tracking
- Franchise receipt confirmation
- Short-stock and failure explanations

### 18.2 Franchise Experience Rules

- Franchise users never directly seed stock.
- Franchise inventory is only populated via approved warehouse fulfillment plus inbound delivery receipt.

---

## 19. Rollout Strategy

### Phase 0 – Foundation
- Add Prisma models and migrations.
- Add procurement module skeleton and RBAC.
- Add audit logging and event outbox wiring.

### Phase 1 – Supplier + PO
- Implement supplier management and purchase orders.
- Add approval workflow and notifications.

### Phase 2 – ASN + GRN
- Implement ASN and GRN posting.
- Wire inventory increase only through GRN posting.

### Phase 3 – QC + Valuation
- Implement QC inspection and blocked inventory handling.
- Recompute valuation snapshots.

### Phase 4 – Dashboard + Bundle Integration
- Add dashboard metrics.
- Integrate starter bundles with procurement-backed warehouse inventory.

---

## 20. Migration Plan

1. Create new procurement tables and enums.
2. Add warehouse node mapping for procurement receiving.
3. Create initial supplier records and seed central warehouse node.
4. Backfill existing warehouse stock into valuation baseline.
5. Enable procurement posting behind a feature flag.
6. Run dual-write for a limited period.
7. Disable legacy manual stock-only receipt path for normal inbound transactions.

### Migration Safety

- Preserve existing stock request and inbound delivery records.
- Keep current stock adjustment workflow available only for controlled corrections.

---

## 21. Testing Strategy

### Unit Tests
- Supplier validation rules.
- PO state transitions.
- GRN quantity math.
- QC routing logic.
- Valuation formula tests.

### Integration Tests
- Prisma transaction + stock update + ledger create.
- BullMQ job handlers.
- Outbox event publishing.

### E2E Tests
- Create supplier → create PO → create ASN → post GRN → check inventory.
- Create bundle request → warehouse allocation → inbound delivery → franchise receipt.

### Concurrency Tests
- Double-post GRN protection.
- Simultaneous inventory updates from two GRN workers.

---

## 22. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Incorrect GRN math | Inventory mismatch | Server-side validation and transaction guardrails |
| Duplicate GRN posting | Double stock increase | Idempotency key and Redis lock |
| QC bypass | Bad inventory quality | Mandatory QC before posting |
| Approval bypass | Unauthorized goods receipt | RBAC and audit required |
| Bundle short stock | Failed bundle fulfillment | Reserve stock and fail gracefully |
| Legacy manual adjustments bypass | Procurement drift | Restrict manual adjustments to controlled workflows |

---

## 23. Production Readiness Checklist

- Prisma migrations verified.
- GRN posting idempotency tested.
- Ledger immutability validated.
- RBAC and audit logs verified.
- Redis locks and BullMQ retries tested.
- Dashboard metrics validated against sample data.
- Rollback strategy documented.
- Backfill scripts tested in staging.
- Monitoring alerts configured for failed postings and valuation errors.
- Support runbook for reversal and dispute handling published.

---

## 24. Recommended Implementation Sequence

1. Add procurement domain models and migrations.
2. Build Supplier and Purchase Order modules.
3. Build ASN and GRN modules.
4. Connect GRN posting to warehouse stock and inventory ledger.
5. Add QC and blocked inventory handling.
6. Add valuation snapshots and dashboard metrics.
7. Hook starter bundles into warehouse allocation flow.
8. Roll out gradually behind feature flags.

---

## 25. Compatibility Plan With Existing Gift Factory Flow

This implementation should not break the current flow:

- Existing stock requests remain the demand trigger.
- Existing inbound deliveries continue to represent shipment movement toward franchise fulfillment.
- Existing supply-chain events remain the integration backbone.
- Procurement only changes how inventory reaches warehouse stock.
- Bundle requests will consume warehouse stock through the existing fulfillment path instead of direct seeding.

This keeps the system procurement-driven while preserving the current franchise and warehouse operating model.
