import { BaseReportBuilder } from './base-report.builder';
import { Prisma, Role } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  ReportFilter,
  ReportSummaryCard,
  ReportFieldRegistryItem,
} from '../interfaces/report.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveUserFranchiseId } from '../constants/report.constants';

const SCHEMA_FIELDS_OVERRIDE: Record<string, any[]> = {
  suppliers: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'CODE', label: 'Code', field: 'code', type: 'string', default: true, dbSelect: { code: true } },
    { key: 'NAME', label: 'Name', field: 'name', type: 'string', default: true, dbSelect: { name: true } },
    { key: 'CONTACT_PERSON', label: 'Contact Person', field: 'contactPerson', type: 'string', default: false, dbSelect: { contactPerson: true } },
    { key: 'EMAIL', label: 'Email', field: 'email', type: 'string', default: false, dbSelect: { email: true } },
    { key: 'PHONE', label: 'Phone', field: 'phone', type: 'string', default: false, dbSelect: { phone: true } },
    { key: 'GST_NUMBER', label: 'GST Number', field: 'gstNumber', type: 'string', default: false, dbSelect: { gstNumber: true } },
    { key: 'PAN_NUMBER', label: 'PAN Number', field: 'panNumber', type: 'string', default: false, dbSelect: { panNumber: true } },
    { key: 'ADDRESS', label: 'Address', field: 'address', type: 'string', default: false, dbSelect: { address: true } },
    { key: 'PAYMENT_TERMS', label: 'Payment Terms', field: 'paymentTerms', type: 'string', default: false, dbSelect: { paymentTerms: true } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  purchase_orders: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'PO_NUMBER', label: 'PO Number', field: 'poNumber', type: 'string', default: true, dbSelect: { poNumber: true } },
    { key: 'SUPPLIER_ID', label: 'Supplier ID', field: 'supplierId', type: 'string', default: false, dbSelect: { supplierId: true } },
    { key: 'SUPPLIER_NAME', label: 'Supplier Name', field: 'supplierName', type: 'string', default: true, dbSelect: { supplierId: true, supplier: { select: { name: true, code: true } } } },
    { key: 'WAREHOUSE_NODE_ID', label: 'Warehouse Node ID', field: 'warehouseNodeId', type: 'string', default: false, dbSelect: { warehouseNodeId: true } },
    { key: 'WAREHOUSE_NODE_NAME', label: 'Warehouse Node Name', field: 'warehouseNodeName', type: 'string', default: true, dbSelect: { warehouseNodeId: true, warehouseNode: { select: { name: true } } } },
    { key: 'CURRENCY', label: 'Currency', field: 'currency', type: 'string', default: false, dbSelect: { currency: true } },
    { key: 'EXPECTED_DELIVERY_DATE', label: 'Expected Delivery Date', field: 'expectedDeliveryDate', type: 'date', default: false, dbSelect: { expectedDeliveryDate: true } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'TOTAL_AMOUNT', label: 'Total Amount', field: 'totalAmount', type: 'currency', default: true, dbSelect: { totalAmount: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  asns: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'ASN_NUMBER', label: 'ASN Number', field: 'asnNumber', type: 'string', default: true, dbSelect: { asnNumber: true } },
    { key: 'PURCHASE_ORDER_ID', label: 'Purchase Order ID', field: 'purchaseOrderId', type: 'string', default: false, dbSelect: { purchaseOrderId: true } },
    { key: 'PO_NUMBER', label: 'PO Number', field: 'poNumber', type: 'string', default: true, dbSelect: { purchaseOrderId: true, purchaseOrder: { select: { poNumber: true } } } },
    { key: 'SUPPLIER_ID', label: 'Supplier ID', field: 'supplierId', type: 'string', default: false, dbSelect: { supplierId: true } },
    { key: 'SUPPLIER_NAME', label: 'Supplier Name', field: 'supplierName', type: 'string', default: true, dbSelect: { supplierId: true, supplier: { select: { name: true, code: true } } } },
    { key: 'SUPPLIER_INVOICE_NO', label: 'Supplier Invoice No', field: 'supplierInvoiceNo', type: 'string', default: false, dbSelect: { supplierInvoiceNo: true } },
    { key: 'VEHICLE_NUMBER', label: 'Vehicle Number', field: 'vehicleNumber', type: 'string', default: false, dbSelect: { vehicleNumber: true } },
    { key: 'COURIER', label: 'Courier', field: 'courier', type: 'string', default: false, dbSelect: { courier: true } },
    { key: 'TRACKING_NUMBER', label: 'Tracking Number', field: 'trackingNumber', type: 'string', default: false, dbSelect: { trackingNumber: true } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  grns: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'GRN_NUMBER', label: 'GRN Number', field: 'grnNumber', type: 'string', default: true, dbSelect: { grnNumber: true } },
    { key: 'PURCHASE_ORDER_ID', label: 'Purchase Order ID', field: 'purchaseOrderId', type: 'string', default: false, dbSelect: { purchaseOrderId: true } },
    { key: 'PO_NUMBER', label: 'PO Number', field: 'poNumber', type: 'string', default: true, dbSelect: { purchaseOrderId: true, purchaseOrder: { select: { poNumber: true } } } },
    { key: 'ASN_ID', label: 'ASN ID', field: 'asnId', type: 'string', default: false, dbSelect: { asnId: true } },
    { key: 'ASN_NUMBER', label: 'ASN Number', field: 'asnNumber', type: 'string', default: false, dbSelect: { asnId: true, asn: { select: { asnNumber: true } } } },
    { key: 'SUPPLIER_ID', label: 'Supplier ID', field: 'supplierId', type: 'string', default: false, dbSelect: { supplierId: true } },
    { key: 'SUPPLIER_NAME', label: 'Supplier Name', field: 'supplierName', type: 'string', default: true, dbSelect: { supplierId: true, supplier: { select: { name: true, code: true } } } },
    { key: 'WAREHOUSE_NODE_ID', label: 'Warehouse Node ID', field: 'warehouseNodeId', type: 'string', default: false, dbSelect: { warehouseNodeId: true } },
    { key: 'WAREHOUSE_NODE_NAME', label: 'Warehouse Node Name', field: 'warehouseNodeName', type: 'string', default: false, dbSelect: { warehouseNodeId: true, warehouseNode: { select: { name: true } } } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'POSTED_AT', label: 'Posted At', field: 'postedAt', type: 'date', default: false, dbSelect: { postedAt: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  quality_inspections: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'GRN_ID', label: 'GRN ID', field: 'grnId', type: 'string', default: false, dbSelect: { grnId: true } },
    { key: 'GRN_NUMBER', label: 'GRN Number', field: 'grnNumber', type: 'string', default: true, dbSelect: { grnId: true, grn: { select: { grnNumber: true } } } },
    { key: 'GRN_LINE_ID', label: 'GRN Line ID', field: 'grnLineId', type: 'string', default: false, dbSelect: { grnLineId: true } },
    { key: 'TEMPLATE_ID', label: 'Template ID', field: 'templateId', type: 'string', default: false, dbSelect: { templateId: true } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'INSPECTED_BY_USER_ID', label: 'Inspected By User ID', field: 'inspectedByUserId', type: 'string', default: false, dbSelect: { inspectedByUserId: true } },
    { key: 'INSPECTED_BY_NAME', label: 'Inspected By Name', field: 'inspectedByName', type: 'string', default: true, dbSelect: { inspectedByUserId: true } },
    { key: 'APPROVED_BY_USER_ID', label: 'Approved By User ID', field: 'approvedByUserId', type: 'string', default: false, dbSelect: { approvedByUserId: true } },
    { key: 'APPROVED_BY_NAME', label: 'Approved By Name', field: 'approvedByName', type: 'string', default: true, dbSelect: { approvedByUserId: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  starter_bundles: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'CODE', label: 'Code', field: 'code', type: 'string', default: true, dbSelect: { code: true } },
    { key: 'NAME', label: 'Name', field: 'name', type: 'string', default: true, dbSelect: { name: true } },
    { key: 'DESCRIPTION', label: 'Description', field: 'description', type: 'string', default: false, dbSelect: { description: true } },
    { key: 'TYPE', label: 'Type', field: 'type', type: 'string', default: false, dbSelect: { type: true } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'IS_DEFAULT', label: 'Is Default', field: 'isDefault', type: 'status', default: false, dbSelect: { isDefault: true } },
    { key: 'AUTO_ASSIGN_ON_CREATE', label: 'Auto Assign', field: 'autoAssignOnCreate', type: 'status', default: false, dbSelect: { autoAssignOnCreate: true } },
    { key: 'PAYMENT_STATUS', label: 'Payment Status', field: 'paymentStatus', type: 'status', default: true, dbSelect: { paymentStatus: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  franchise_ledger: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'FRANCHISE_ID', label: 'Franchise ID', field: 'franchiseId', type: 'string', default: false, dbSelect: { franchiseId: true } },
    { key: 'FRANCHISE_NAME', label: 'Franchise Name', field: 'franchiseName', type: 'string', default: true, dbSelect: { franchiseId: true, franchise: { select: { name: true, code: true } } } },
    { key: 'PRODUCT_ID', label: 'Product ID', field: 'productId', type: 'string', default: false, dbSelect: { productId: true } },
    { key: 'PRODUCT_NAME', label: 'Product Name', field: 'productName', type: 'string', default: true, dbSelect: { productId: true, product: { select: { name: true } } } },
    { key: 'VARIANT_ID', label: 'Variant ID', field: 'variantId', type: 'string', default: false, dbSelect: { variantId: true } },
    { key: 'VARIANT_NAME', label: 'Variant Name', field: 'variantName', type: 'string', default: true, dbSelect: { variantId: true, variant: { select: { sku: true, attributeSummary: true } } } },
    { key: 'QUANTITY', label: 'Quantity', field: 'quantity', type: 'number', default: true, dbSelect: { quantity: true } },
    { key: 'BILLING_TOTAL', label: 'Billing Total', field: 'billingTotal', type: 'currency', default: true, dbSelect: { billingTotal: true } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'PAYMENT_STATUS', label: 'Payment Status', field: 'paymentStatus', type: 'status', default: true, dbSelect: { paymentStatus: true } },
    { key: 'TYPE', label: 'Type', field: 'type', type: 'string', default: false, dbSelect: { type: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  supplier_ledger: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'CODE', label: 'Code', field: 'code', type: 'string', default: true, dbSelect: { code: true } },
    { key: 'NAME', label: 'Name', field: 'name', type: 'string', default: true, dbSelect: { name: true } },
    { key: 'CONTACT_PERSON', label: 'Contact Person', field: 'contactPerson', type: 'string', default: false, dbSelect: { contactPerson: true } },
    { key: 'EMAIL', label: 'Email', field: 'email', type: 'string', default: false, dbSelect: { email: true } },
    { key: 'PHONE', label: 'Phone', field: 'phone', type: 'string', default: false, dbSelect: { phone: true } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'OVERALL_PAYMENTS', label: 'Overall Payments', field: 'overallPayments', type: 'currency', default: true, dbSelect: { purchaseOrders: { select: { totalAmount: true } } } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  purchase_order_approvals: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'PURCHASE_ORDER_ID', label: 'Purchase Order ID', field: 'purchaseOrderId', type: 'string', default: false, dbSelect: { purchaseOrderId: true } },
    { key: 'PO_NUMBER', label: 'PO Number', field: 'poNumber', type: 'string', default: true, dbSelect: { purchaseOrderId: true, purchaseOrder: { select: { poNumber: true } } } },
    { key: 'APPROVER_USER_ID', label: 'Approver User ID', field: 'approverUserId', type: 'string', default: false, dbSelect: { approverUserId: true } },
    { key: 'APPROVER_NAME', label: 'Approver Name', field: 'approverName', type: 'string', default: true, dbSelect: { approverUserId: true } },
    { key: 'DECISION', label: 'Decision', field: 'decision', type: 'status', default: true, dbSelect: { decision: true } },
    { key: 'COMMENT', label: 'Comment', field: 'comment', type: 'string', default: false, dbSelect: { comment: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  supplier_returns: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'RETURN_NUMBER', label: 'Return Number', field: 'returnNumber', type: 'string', default: true, dbSelect: { returnNumber: true } },
    { key: 'PURCHASE_ORDER_ID', label: 'Purchase Order ID', field: 'purchaseOrderId', type: 'string', default: false, dbSelect: { purchaseOrderId: true } },
    { key: 'PO_NUMBER', label: 'PO Number', field: 'poNumber', type: 'string', default: true, dbSelect: { purchaseOrderId: true, purchaseOrder: { select: { poNumber: true } } } },
    { key: 'SUPPLIER_ID', label: 'Supplier ID', field: 'supplierId', type: 'string', default: false, dbSelect: { supplierId: true } },
    { key: 'SUPPLIER_NAME', label: 'Supplier Name', field: 'supplierName', type: 'string', default: true, dbSelect: { supplierId: true, supplier: { select: { name: true, code: true } } } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'TOTAL_AMOUNT', label: 'Total Amount', field: 'totalAmount', type: 'currency', default: true, dbSelect: { totalAmount: true } },
    { key: 'NOTES', label: 'Notes', field: 'notes', type: 'string', default: false, dbSelect: { notes: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  bundle_assignments: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'FRANCHISE_ID', label: 'Franchise ID', field: 'franchiseId', type: 'string', default: false, dbSelect: { franchiseId: true } },
    { key: 'FRANCHISE_NAME', label: 'Franchise Name', field: 'franchiseName', type: 'string', default: true, dbSelect: { franchiseId: true, franchise: { select: { name: true, code: true } } } },
    { key: 'BUNDLE_ID', label: 'Bundle ID', field: 'bundleId', type: 'string', default: false, dbSelect: { bundleId: true } },
    { key: 'BUNDLE_NAME', label: 'Bundle Name', field: 'bundleName', type: 'string', default: true, dbSelect: { bundleId: true, bundle: { select: { name: true, code: true } } } },
    { key: 'STATUS', label: 'Status', field: 'status', type: 'status', default: true, dbSelect: { status: true } },
    { key: 'METHOD', label: 'Method', field: 'method', type: 'string', default: true, dbSelect: { method: true } },
    { key: 'STOCK_REQUEST_ID', label: 'Stock Request ID', field: 'stockRequestId', type: 'string', default: false, dbSelect: { stockRequestId: true } },
    { key: 'INBOUND_DELIVERY_ID', label: 'Inbound Delivery ID', field: 'inboundDeliveryId', type: 'string', default: false, dbSelect: { inboundDeliveryId: true } },
    { key: 'PROVISIONED_AT', label: 'Provisioned At', field: 'provisionedAt', type: 'date', default: false, dbSelect: { provisionedAt: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  inventory_ledger: [
    { key: 'ID', label: 'ID', field: 'id', type: 'string', default: false, dbSelect: { id: true } },
    { key: 'GRN_ID', label: 'GRN ID', field: 'grnId', type: 'string', default: false, dbSelect: { grnId: true } },
    { key: 'GRN_NUMBER', label: 'GRN Number', field: 'grnNumber', type: 'string', default: true, dbSelect: { grnId: true, grn: { select: { grnNumber: true } } } },
    { key: 'PRODUCT_ID', label: 'Product ID', field: 'productId', type: 'string', default: false, dbSelect: { productId: true } },
    { key: 'PRODUCT_NAME', label: 'Product Name', field: 'productName', type: 'string', default: true, dbSelect: { productId: true, product: { select: { name: true } } } },
    { key: 'VARIANT_ID', label: 'Variant ID', field: 'variantId', type: 'string', default: false, dbSelect: { variantId: true } },
    { key: 'VARIANT_NAME', label: 'Variant Name', field: 'variantName', type: 'string', default: true, dbSelect: { variantId: true, variant: { select: { sku: true, attributeSummary: true } } } },
    { key: 'WAREHOUSE_NODE_ID', label: 'Warehouse Node ID', field: 'warehouseNodeId', type: 'string', default: false, dbSelect: { warehouseNodeId: true } },
    { key: 'WAREHOUSE_NODE_NAME', label: 'Warehouse Node Name', field: 'warehouseNodeName', type: 'string', default: true, dbSelect: { warehouseNodeId: true, warehouseNode: { select: { name: true } } } },
    { key: 'TRANSACTION_TYPE', label: 'Transaction Type', field: 'transactionType', type: 'string', default: true, dbSelect: { transactionType: true } },
    { key: 'QUANTITY', label: 'Quantity', field: 'quantity', type: 'number', default: true, dbSelect: { quantity: true } },
    { key: 'UNIT_COST', label: 'Unit Cost', field: 'unitCost', type: 'currency', default: true, dbSelect: { unitCost: true } },
    { key: 'RUNNING_BALANCE', label: 'Running Balance', field: 'runningBalance', type: 'number', default: false, dbSelect: { runningBalance: true } },
    { key: 'REFERENCE_TYPE', label: 'Reference Type', field: 'referenceType', type: 'string', default: false, dbSelect: { referenceType: true } },
    { key: 'REFERENCE_ID', label: 'Reference ID', field: 'referenceId', type: 'string', default: false, dbSelect: { referenceId: true } },
    { key: 'CREATED_AT', label: 'Created At', field: 'createdAt', type: 'date', default: false, dbSelect: { createdAt: true } },
  ],
  categories: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'NAME',
      label: 'Name',
      field: 'name',
      type: 'string',
      default: true,
      dbSelect: { name: true },
    },
    {
      key: 'SLUG',
      label: 'Slug',
      field: 'slug',
      type: 'string',
      default: true,
      dbSelect: { slug: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { id: true },
    },
  ],
  brands: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'NAME',
      label: 'Name',
      field: 'name',
      type: 'string',
      default: true,
      dbSelect: { name: true },
    },
    {
      key: 'SLUG',
      label: 'Slug',
      field: 'slug',
      type: 'string',
      default: true,
      dbSelect: { slug: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  attributes: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'NAME',
      label: 'Name',
      field: 'name',
      type: 'string',
      default: true,
      dbSelect: { title: true },
    },
    {
      key: 'DISPLAY_NAME',
      label: 'Display Name',
      field: 'displayName',
      type: 'string',
      default: true,
      dbSelect: { title: true },
    },
    {
      key: 'CODE',
      label: 'Code',
      field: 'code',
      type: 'string',
      default: true,
      dbSelect: { slug: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: false,
      dbSelect: { isActive: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  media: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'FILE_NAME',
      label: 'File Name',
      field: 'fileName',
      type: 'string',
      default: true,
      dbSelect: { url: true },
    },
    {
      key: 'MIME_TYPE',
      label: 'Mime Type',
      field: 'mimeType',
      type: 'string',
      default: true,
      dbSelect: { mimeType: true },
    },
    {
      key: 'SIZE',
      label: 'Size',
      field: 'size',
      type: 'number',
      default: true,
      dbSelect: { size: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  reviews: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'PRODUCT_ID',
      label: 'Product ID',
      field: 'productId',
      type: 'string',
      default: true,
      dbSelect: { productId: true },
    },
    {
      key: 'CUSTOMER_ID',
      label: 'Customer ID',
      field: 'customerId',
      type: 'string',
      default: true,
      dbSelect: { userId: true },
    },
    {
      key: 'RATING',
      label: 'Rating',
      field: 'rating',
      type: 'number',
      default: true,
      dbSelect: { rating: true },
    },
    {
      key: 'COMMENT',
      label: 'Comment',
      field: 'comment',
      type: 'string',
      default: false,
      dbSelect: { comment: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: false,
      dbSelect: { approved: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  banners: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'TITLE',
      label: 'Title',
      field: 'title',
      type: 'string',
      default: true,
      dbSelect: { title: true },
    },
    {
      key: 'IMAGE_URL',
      label: 'Image URL',
      field: 'imageUrl',
      type: 'string',
      default: true,
      dbSelect: { imageUrl: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  discounts: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'CODE',
      label: 'Code',
      field: 'code',
      type: 'string',
      default: true,
      dbSelect: { code: true },
    },
    {
      key: 'TYPE',
      label: 'Type',
      field: 'type',
      type: 'string',
      default: true,
      dbSelect: { type: true },
    },
    {
      key: 'VALUE',
      label: 'Value',
      field: 'value',
      type: 'number',
      default: true,
      dbSelect: { value: true },
    },
    {
      key: 'MIN_PURCHASE',
      label: 'Min Purchase',
      field: 'minPurchase',
      type: 'number',
      default: false,
      dbSelect: { minOrderAmount: true },
    },
    {
      key: 'STARTS_AT',
      label: 'Starts At',
      field: 'startsAt',
      type: 'date',
      default: false,
      dbSelect: { startsAt: true },
    },
    {
      key: 'ENDS_AT',
      label: 'Ends At',
      field: 'endsAt',
      type: 'date',
      default: false,
      dbSelect: { endsAt: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { active: true },
    },
  ],
  promotions: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'TITLE',
      label: 'Title',
      field: 'title',
      type: 'string',
      default: true,
      dbSelect: { name: true },
    },
    {
      key: 'DESCRIPTION',
      label: 'Description',
      field: 'description',
      type: 'string',
      default: true,
      dbSelect: { description: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { active: true },
    },
    {
      key: 'STARTS_AT',
      label: 'Starts At',
      field: 'startsAt',
      type: 'date',
      default: false,
      dbSelect: { startsAt: true },
    },
    {
      key: 'ENDS_AT',
      label: 'Ends At',
      field: 'endsAt',
      type: 'date',
      default: false,
      dbSelect: { endsAt: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  warehouse_inventory: [
    {
      key: 'PRODUCT_ID',
      label: 'Product ID',
      field: 'productId',
      type: 'string',
      default: true,
      dbSelect: { productId: true },
    },
    {
      key: 'QUANTITY',
      label: 'Quantity',
      field: 'quantity',
      type: 'number',
      default: true,
      dbSelect: { quantity: true },
    },
    {
      key: 'LOW_STOCK_THRESHOLD',
      label: 'Low Stock Threshold',
      field: 'lowStockThreshold',
      type: 'number',
      default: true,
      dbSelect: { lowStockThreshold: true },
    },
    {
      key: 'RESERVED',
      label: 'Reserved',
      field: 'reserved',
      type: 'number',
      default: true,
      dbSelect: { reserved: true },
    },
  ],
  supply_chain: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'EVENT_NAME',
      label: 'Event Name',
      field: 'eventName',
      type: 'string',
      default: true,
      dbSelect: { eventName: true },
    },
    {
      key: 'STOCKING_NODE_ID',
      label: 'Stocking Node ID',
      field: 'stockingNodeId',
      type: 'string',
      default: true,
      dbSelect: { stockingNodeId: true },
    },
    {
      key: 'PRODUCT_ID',
      label: 'Product ID',
      field: 'productId',
      type: 'string',
      default: true,
      dbSelect: { productId: true },
    },
    {
      key: 'VARIANT_ID',
      label: 'Variant ID',
      field: 'variantId',
      type: 'string',
      default: true,
      dbSelect: { variantId: true },
    },
    {
      key: 'QUANTITY_DELTA',
      label: 'Quantity Delta',
      field: 'quantityDelta',
      type: 'number',
      default: true,
      dbSelect: { quantityDelta: true },
    },
    {
      key: 'REF_TYPE',
      label: 'Ref Type',
      field: 'refType',
      type: 'string',
      default: false,
      dbSelect: { refType: true },
    },
    {
      key: 'REF_ID',
      label: 'Ref ID',
      field: 'refId',
      type: 'string',
      default: false,
      dbSelect: { refId: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  stock_requests: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'FRANCHISE_ID',
      label: 'Franchise ID',
      field: 'franchiseId',
      type: 'string',
      default: true,
      dbSelect: { franchiseId: true },
    },
    {
      key: 'PRODUCT_ID',
      label: 'Product ID',
      field: 'productId',
      type: 'string',
      default: true,
      dbSelect: { productId: true },
    },
    {
      key: 'VARIANT_ID',
      label: 'Variant ID',
      field: 'variantId',
      type: 'string',
      default: true,
      dbSelect: { variantId: true },
    },
    {
      key: 'QUANTITY',
      label: 'Quantity',
      field: 'quantity',
      type: 'number',
      default: true,
      dbSelect: { quantity: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { status: true },
    },
    {
      key: 'NOTE',
      label: 'Note',
      field: 'note',
      type: 'string',
      default: false,
      dbSelect: { note: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  deliveries: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'FRANCHISE_ID',
      label: 'Franchise ID',
      field: 'franchiseId',
      type: 'string',
      default: true,
      dbSelect: { franchiseId: true },
    },
    {
      key: 'STOCK_REQUEST_ID',
      label: 'Stock Request ID',
      field: 'stockRequestId',
      type: 'string',
      default: true,
      dbSelect: { stockRequestId: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { status: true },
    },
    {
      key: 'CARRIER',
      label: 'Carrier',
      field: 'carrier',
      type: 'string',
      default: false,
      dbSelect: { carrier: true },
    },
    {
      key: 'TRACKING_CODE',
      label: 'Tracking Code',
      field: 'trackingCode',
      type: 'string',
      default: false,
      dbSelect: { trackingCode: true },
    },
    {
      key: 'EXPECTED_AT',
      label: 'Expected At',
      field: 'expectedAt',
      type: 'date',
      default: false,
      dbSelect: { expectedAt: true },
    },
    {
      key: 'DELIVERED_AT',
      label: 'Delivered At',
      field: 'deliveredAt',
      type: 'date',
      default: false,
      dbSelect: { deliveredAt: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
    {
      key: 'UPDATED_AT',
      label: 'Updated At',
      field: 'updatedAt',
      type: 'date',
      default: false,
      dbSelect: { updatedAt: true },
    },
  ],
  returns: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'RETURN_NUMBER',
      label: 'Return Number',
      field: 'returnNumber',
      type: 'string',
      default: true,
      dbSelect: { returnNumber: true },
    },
    {
      key: 'SOURCE_TYPE',
      label: 'Source Type',
      field: 'sourceType',
      type: 'string',
      default: true,
      dbSelect: { sourceType: true },
    },
    {
      key: 'ORDER_ID',
      label: 'Order ID',
      field: 'orderId',
      type: 'string',
      default: true,
      dbSelect: { orderId: true },
    },
    {
      key: 'STOCK_REQUEST_ID',
      label: 'Stock Request ID',
      field: 'stockRequestId',
      type: 'string',
      default: false,
      dbSelect: { stockRequestId: true },
    },
    {
      key: 'RETURN_TYPE',
      label: 'Return Type',
      field: 'returnType',
      type: 'string',
      default: false,
      dbSelect: { returnType: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { status: true },
    },
    {
      key: 'REQUESTED_BY_ID',
      label: 'Requested By ID',
      field: 'requestedById',
      type: 'string',
      default: false,
      dbSelect: { requestedById: true },
    },
    {
      key: 'FRANCHISE_ID',
      label: 'Franchise ID',
      field: 'franchiseId',
      type: 'string',
      default: false,
      dbSelect: { franchiseId: true },
    },
    {
      key: 'REASON',
      label: 'Reason',
      field: 'reason',
      type: 'string',
      default: false,
      dbSelect: { reason: true },
    },
    {
      key: 'REMARKS',
      label: 'Remarks',
      field: 'remarks',
      type: 'string',
      default: false,
      dbSelect: { remarks: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  refunds: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'REFUND_NUMBER',
      label: 'Refund Number',
      field: 'refundNumber',
      type: 'string',
      default: true,
      dbSelect: { refundNumber: true },
    },
    {
      key: 'RETURN_ID',
      label: 'Return ID',
      field: 'returnId',
      type: 'string',
      default: true,
      dbSelect: { returnId: true },
    },
    {
      key: 'INVOICE_ID',
      label: 'Invoice ID',
      field: 'invoiceId',
      type: 'string',
      default: true,
      dbSelect: { invoiceId: true },
    },
    {
      key: 'CREDIT_NOTE_ID',
      label: 'Credit Note ID',
      field: 'creditNoteId',
      type: 'string',
      default: false,
      dbSelect: { creditNoteId: true },
    },
    {
      key: 'AMOUNT',
      label: 'Amount',
      field: 'amount',
      type: 'currency',
      default: true,
      dbSelect: { amount: true },
    },
    {
      key: 'METHOD',
      label: 'Method',
      field: 'method',
      type: 'string',
      default: false,
      dbSelect: { method: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { status: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  proposals: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'PROPOSAL_CODE',
      label: 'Proposal Code',
      field: 'proposalCode',
      type: 'string',
      default: true,
      dbSelect: { proposalCode: true },
    },
    {
      key: 'REQUEST_ID',
      label: 'Request ID',
      field: 'requestId',
      type: 'string',
      default: true,
      dbSelect: { requestId: true },
    },
    {
      key: 'FRANCHISE_ID',
      label: 'Franchise ID',
      field: 'franchiseId',
      type: 'string',
      default: true,
      dbSelect: { franchiseId: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { status: true },
    },
    {
      key: 'ATTEMPT_NUMBER',
      label: 'Attempt Number',
      field: 'attemptNumber',
      type: 'number',
      default: false,
      dbSelect: { attemptNumber: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  tickets: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'FRANCHISE_ID',
      label: 'Franchise ID',
      field: 'franchiseId',
      type: 'string',
      default: true,
      dbSelect: { franchiseId: true },
    },
    {
      key: 'TYPE',
      label: 'Type',
      field: 'type',
      type: 'string',
      default: true,
      dbSelect: { type: true },
    },
    {
      key: 'SUBJECT',
      label: 'Subject',
      field: 'subject',
      type: 'string',
      default: true,
      dbSelect: { subject: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { status: true },
    },
    {
      key: 'PRIORITY',
      label: 'Priority',
      field: 'priority',
      type: 'string',
      default: true,
      dbSelect: { priority: true },
    },
    {
      key: 'CREATED_BY_USER_ID',
      label: 'Created By User ID',
      field: 'createdByUserId',
      type: 'string',
      default: false,
      dbSelect: { createdByUserId: true },
    },
    {
      key: 'ASSIGNED_TO_USER_ID',
      label: 'Assigned To User ID',
      field: 'assignedToUserId',
      type: 'string',
      default: false,
      dbSelect: { assignedToUserId: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
    {
      key: 'UPDATED_AT',
      label: 'Updated At',
      field: 'updatedAt',
      type: 'date',
      default: false,
      dbSelect: { updatedAt: true },
    },
  ],
  faq: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'QUESTION',
      label: 'Question',
      field: 'question',
      type: 'string',
      default: true,
      dbSelect: { question: true },
    },
    {
      key: 'ANSWER',
      label: 'Answer',
      field: 'answer',
      type: 'string',
      default: true,
      dbSelect: { answer: true },
    },
    {
      key: 'AUDIENCE',
      label: 'Audience',
      field: 'audience',
      type: 'string',
      default: true,
      dbSelect: { audience: true },
    },
    {
      key: 'STATUS',
      label: 'Status',
      field: 'status',
      type: 'status',
      default: true,
      dbSelect: { status: true },
    },
    {
      key: 'IS_VISIBLE',
      label: 'Is Visible',
      field: 'isVisible',
      type: 'status',
      default: false,
      dbSelect: { isVisible: true },
    },
    {
      key: 'IS_DELETED',
      label: 'Is Deleted',
      field: 'isDeleted',
      type: 'status',
      default: false,
      dbSelect: { isDeleted: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  notices: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'TITLE',
      label: 'Title',
      field: 'title',
      type: 'string',
      default: true,
      dbSelect: { title: true },
    },
    {
      key: 'BODY',
      label: 'Body',
      field: 'body',
      type: 'string',
      default: true,
      dbSelect: { body: true },
    },
    {
      key: 'AUDIENCE',
      label: 'Audience',
      field: 'audience',
      type: 'string',
      default: true,
      dbSelect: { audience: true },
    },
    {
      key: 'FRANCHISE_ID',
      label: 'Franchise ID',
      field: 'franchiseId',
      type: 'string',
      default: false,
      dbSelect: { franchiseId: true },
    },
    {
      key: 'CREATED_BY_USER_ID',
      label: 'Created By User ID',
      field: 'createdByUserId',
      type: 'string',
      default: false,
      dbSelect: { createdByUserId: true },
    },
    {
      key: 'PUBLISHED_AT',
      label: 'Published At',
      field: 'publishedAt',
      type: 'date',
      default: false,
      dbSelect: { publishedAt: true },
    },
  ],
  audit: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'USER_ID',
      label: 'User ID',
      field: 'userId',
      type: 'string',
      default: true,
      dbSelect: { userId: true },
    },
    {
      key: 'ACTION',
      label: 'Action',
      field: 'action',
      type: 'string',
      default: true,
      dbSelect: { action: true },
    },
    {
      key: 'RESOURCE',
      label: 'Resource',
      field: 'resource',
      type: 'string',
      default: true,
      dbSelect: { resource: true },
    },
    {
      key: 'RESOURCE_ID',
      label: 'Resource ID',
      field: 'resourceId',
      type: 'string',
      default: false,
      dbSelect: { resourceId: true },
    },
    {
      key: 'IP',
      label: 'IP',
      field: 'ip',
      type: 'string',
      default: false,
      dbSelect: { ip: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  webhooks: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'LABEL',
      label: 'Label',
      field: 'label',
      type: 'string',
      default: true,
      dbSelect: { label: true },
    },
    {
      key: 'URL',
      label: 'URL',
      field: 'url',
      type: 'string',
      default: true,
      dbSelect: { url: true },
    },
    {
      key: 'EVENTS',
      label: 'Events',
      field: 'events',
      type: 'string',
      default: true,
      dbSelect: { events: true },
    },
    {
      key: 'ACTIVE',
      label: 'Active',
      field: 'active',
      type: 'status',
      default: true,
      dbSelect: { active: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  settings: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'PANEL_TYPE',
      label: 'Panel Type',
      field: 'panelType',
      type: 'string',
      default: true,
      dbSelect: { panelType: true },
    },
    {
      key: 'SITE_NAME',
      label: 'Site Name',
      field: 'siteName',
      type: 'string',
      default: true,
      dbSelect: { siteName: true },
    },
    {
      key: 'TAGLINE',
      label: 'Tagline',
      field: 'tagline',
      type: 'string',
      default: true,
      dbSelect: { tagline: true },
    },
    {
      key: 'LOGO_URL',
      label: 'Logo URL',
      field: 'logoUrl',
      type: 'string',
      default: false,
      dbSelect: { logoUrl: true },
    },
    {
      key: 'PRIMARY_COLOR',
      label: 'Primary Color',
      field: 'primaryColor',
      type: 'string',
      default: false,
      dbSelect: { primaryColor: true },
    },
    {
      key: 'SECONDARY_COLOR',
      label: 'Secondary Color',
      field: 'secondaryColor',
      type: 'string',
      default: false,
      dbSelect: { secondaryColor: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
  ],
  app_role: [
    {
      key: 'ID',
      label: 'ID',
      field: 'id',
      type: 'string',
      default: true,
      dbSelect: { id: true },
    },
    {
      key: 'ROLE_NAME',
      label: 'Role Name',
      field: 'roleName',
      type: 'string',
      default: true,
      dbSelect: { roleName: true },
    },
    {
      key: 'DESCRIPTION',
      label: 'Description',
      field: 'description',
      type: 'string',
      default: true,
      dbSelect: { description: true },
    },
    {
      key: 'IS_ACTIVE',
      label: 'Is Active',
      field: 'isActive',
      type: 'status',
      default: true,
      dbSelect: { isActive: true },
    },
    {
      key: 'IS_SYSTEM',
      label: 'Is System',
      field: 'isSystem',
      type: 'status',
      default: true,
      dbSelect: { isSystem: true },
    },
    {
      key: 'FRANCHISE_ID',
      label: 'Franchise ID',
      field: 'franchiseId',
      type: 'string',
      default: false,
      dbSelect: { franchiseId: true },
    },
    {
      key: 'CREATED_BY_ID',
      label: 'Created By ID',
      field: 'createdById',
      type: 'string',
      default: false,
      dbSelect: { createdById: true },
    },
    {
      key: 'CREATED_AT',
      label: 'Created At',
      field: 'createdAt',
      type: 'date',
      default: false,
      dbSelect: { createdAt: true },
    },
    {
      key: 'UPDATED_AT',
      label: 'Updated At',
      field: 'updatedAt',
      type: 'date',
      default: false,
      dbSelect: { updatedAt: true },
    },
  ],
};

export class GenericReportBuilder extends BaseReportBuilder {
  private readonly fields: ReportFieldRegistryItem[];

  constructor(
    private readonly moduleName: string,
    private readonly prismaModelName: string,
  ) {
    super();
    this.fields = this.buildAvailableFields();
  }

  getModuleName(): string {
    return this.moduleName;
  }

  getTitle(): string {
    const spaced = this.moduleName.replace(/[-_]/g, ' ');
    return spaced.replace(/\b\w/g, (c) => c.toUpperCase()) + ' Report';
  }

  getPrimaryEntity(): string {
    return (
      this.prismaModelName.charAt(0).toUpperCase() +
      this.prismaModelName.slice(1)
    );
  }

  getRelatedEntities(): string[] {
    return [];
  }

  getFilters(): ReportFilter[] {
    const hasCreatedAt = this.fields.some((f) => f.field === 'createdAt');
    const filters: ReportFilter[] = [];
    if (hasCreatedAt) {
      filters.push(
        {
          name: 'fromDate',
          label: 'From Date',
          type: 'date',
        },
        {
          name: 'toDate',
          label: 'To Date',
          type: 'date',
        },
      );
    }
    return filters;
  }

  getAvailableFields(): ReportFieldRegistryItem[] {
    return this.fields;
  }

  buildQuery(
    query: ReportQueryDto,
    user: JwtUser,
  ): {
    where: any;
    orderBy?: any;
    select?: any;
    include?: any;
  } {
    const where: any = {};

    if (query.fromDate || query.toDate) {
      const dateField =
        this.fields.find((f) => f.type === 'date')?.field || 'createdAt';
      if (this.fields.some((f) => f.field === dateField)) {
        where[dateField] = {};
        if (query.fromDate) {
          where[dateField].gte = new Date(query.fromDate);
        }
        if (query.toDate || query.lastDate) {
          where[dateField].lte = new Date(
            (query.toDate || query.lastDate) as string,
          );
        }
      }
    }

    const userFranchiseId = resolveUserFranchiseId(user);
    const isFranchiseRole =
      user.role === Role.FRANCHISE_OWNER || user.role === Role.FRANCHISE_STAFF;

    if (isFranchiseRole) {
      if (!userFranchiseId) {
        throw new ForbiddenException(
          'Access denied: Active franchise profile is not assigned to user.',
        );
      }

      const pModel = this.prismaModelName.toLowerCase();

      if (pModel === 'franchise') {
        where.id = userFranchiseId;
      } else if (this.fields.some((f) => f.field === 'franchiseId')) {
        if (pModel === 'franchisenotice') {
          where.OR = [{ franchiseId: userFranchiseId }, { franchiseId: null }];
        } else {
          where.franchiseId = userFranchiseId;
        }
      } else if (
        [
          'inventoryledgerentry',
          'warehousestock',
          'stockingnode',
          'goodsreceiptnote',
          'purchaseorder',
          'stocktransfer',
        ].includes(pModel)
      ) {
        where.OR = [
          { warehouseNode: { franchiseId: userFranchiseId } },
          { stockingNode: { franchiseId: userFranchiseId } },
        ];
      } else if (
        [
          'asn',
          'qualityinspection',
          'purchaseorderapproval',
          'supplierreturnorder',
        ].includes(pModel)
      ) {
        where.OR = [
          { purchaseOrder: { warehouseNode: { franchiseId: userFranchiseId } } },
          { grn: { warehouseNode: { franchiseId: userFranchiseId } } },
        ];
      } else if (pModel === 'refund') {
        where.return = { franchiseId: userFranchiseId };
      } else if (pModel === 'supplier') {
        where.purchaseOrders = {
          some: {
            OR: [
              { warehouseNode: { franchiseId: userFranchiseId } },
              { supplierId: { not: null } },
            ],
          },
        };
      }
    }

    return { where };
  }

  async getSummary(
    prisma: PrismaService,
    where: any,
  ): Promise<Record<string, ReportSummaryCard>> {
    const dbClient = (prisma as any)[this.prismaModelName];
    if (!dbClient) return {};

    try {
      const summary: Record<string, ReportSummaryCard> = {};

      // 1. Total records count
      const totalCount = await dbClient.count({ where });
      const modelLabel = this.prismaModelName
        .replace(/([A-Z])/g, ' $1')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      summary[`total${modelLabel.replace(/\s+/g, '')}`] = {
        label: `Total ${modelLabel}s`,
        value: totalCount,
        type: 'number',
      };

      // Find model fields from DMMF
      const modelMeta = Prisma.dmmf.datamodel.models.find(
        (m) => m.name.toLowerCase() === this.prismaModelName.toLowerCase(),
      );

      if (modelMeta) {
        // 2. Check for active/isActive boolean fields
        const activeField = modelMeta.fields.find(
          (f) =>
            (f.name === 'isActive' || f.name === 'active') &&
            f.type === 'Boolean',
        );
        if (activeField) {
          const activeCount = await dbClient.count({
            where: { ...where, [activeField.name]: true },
          });
          const inactiveCount = totalCount - activeCount;

          summary[`active${modelLabel.replace(/\s+/g, '')}`] = {
            label: `Active ${modelLabel}s`,
            value: activeCount,
            type: 'number',
          };
          summary[`inactive${modelLabel.replace(/\s+/g, '')}`] = {
            label: `Inactive ${modelLabel}s`,
            value: inactiveCount,
            type: 'number',
          };
        }

        // 3. Check for status enum/string fields
        const statusField = modelMeta.fields.find(
          (f) =>
            f.name === 'status' && (f.kind === 'enum' || f.type === 'String'),
        );
        if (statusField) {
          const statusGroups = await dbClient.groupBy({
            by: ['status'],
            where,
            _count: { _all: true },
          });

          for (const group of statusGroups) {
            if (group.status) {
              const statusStr = String(group.status);
              const label = statusStr
                .replace(/_/g, ' ')
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase());
              const key =
                statusStr
                  .toLowerCase()
                  .replace(/_([a-z])/g, (_, c) => c.toUpperCase()) + 'Count';
              summary[key] = {
                label: `${label} ${modelLabel}s`,
                value: group._count._all,
                type: 'number',
              };
            }
          }
        }

        // 4. Check for sum of numeric/decimal fields (like amount, total, quantity, price)
        const numericFields = modelMeta.fields.filter(
          (f) =>
            ['Decimal', 'Int', 'Float'].includes(f.type) &&
            ['amount', 'total', 'price', 'quantity', 'value'].includes(
              f.name.toLowerCase(),
            ),
        );

        for (const numField of numericFields) {
          const aggregate = await dbClient.aggregate({
            where,
            _sum: { [numField.name]: true },
          });
          const sumValue = aggregate._sum[numField.name];
          if (sumValue !== null && sumValue !== undefined) {
            const fieldLabel = numField.name
              .replace(/([A-Z])/g, ' $1')
              .replace(/\b\w/g, (c) => c.toUpperCase());
            const key = `total${numField.name.charAt(0).toUpperCase() + numField.name.slice(1)}`;
            const isCurrency = ['amount', 'total', 'price', 'value'].includes(
              numField.name.toLowerCase(),
            );

            summary[key] = {
              label: `Total ${fieldLabel}`,
              value: isCurrency
                ? Number(sumValue).toFixed(2)
                : Number(sumValue),
              type: isCurrency ? 'currency' : 'number',
            };
          }
        }
      }

      return summary;
    } catch (e) {
      return {};
    }
  }

  async transformData(records: any[]): Promise<any[]> {
    const key = this.moduleName.toLowerCase();

    return records.map((record) => {
      const mapped = { ...record };

      const formatVariantName = (variant: any): string | null => {
        if (!variant || typeof variant !== 'object') return null;

        if (
          variant.attributeSummary &&
          typeof variant.attributeSummary === 'string'
        ) {
          const parts = variant.attributeSummary
            .split('|')
            .map((s: string) => s.trim().replace(':', ': '))
            .filter(Boolean);
          if (parts.length > 0) {
            const attrFormatted = parts.join(', ');
            return variant.title && !variant.title.includes(attrFormatted)
              ? `${variant.title} (${attrFormatted})`
              : attrFormatted;
          }
        }

        if (variant.title) return String(variant.title);
        if (variant.sku) return `SKU: ${variant.sku}`;
        return null;
      };

      // 1. Preserve original record ID (do NOT overwrite mapped.id)

      // 2. Populate companion relation name properties without overwriting raw IDs
      if (record.product) {
        mapped.productName =
          record.product.name ||
          record.product.title ||
          record.productName ||
          null;
      }
      if (record.variant) {
        mapped.variantName =
          formatVariantName(record.variant) || record.variantName || null;
      }
      if (record.supplier) {
        mapped.supplierName =
          record.supplier.name ||
          record.supplier.code ||
          record.supplierName ||
          null;
      }
      if (record.franchise) {
        mapped.franchiseName =
          record.franchise.name ||
          record.franchise.code ||
          record.franchiseName ||
          null;
      }
      if (record.warehouseNode || record.stockingNode) {
        const node = record.warehouseNode || record.stockingNode;
        mapped.warehouseNodeName =
          node.name || node.code || record.warehouseNodeName || null;
      }
      if (record.customer) {
        mapped.customerName =
          record.customer.name ||
          record.customer.phone ||
          record.customerName ||
          null;
      }
      if (record.createdBy) {
        mapped.createdByName =
          record.createdBy.name ||
          record.createdBy.fullName ||
          record.createdBy.email ||
          null;
      }
      if (record.bundle) {
        mapped.bundleName =
          record.bundle.name || record.bundle.code || record.bundleName || null;
      }
      if (record.inspectedBy) {
        mapped.inspectedByName =
          record.inspectedBy.name ||
          record.inspectedBy.fullName ||
          record.inspectedBy.email ||
          record.inspectedByName ||
          null;
      }
      if (record.approver) {
        mapped.approverName =
          record.approver.name ||
          record.approver.fullName ||
          record.approver.email ||
          record.approverName ||
          null;
      }
      if (key === 'supplier_ledger') {
        mapped.overallPayments = Number(
          record.purchaseOrders?.reduce(
            (sum: number, po: any) => sum + (Number(po.totalAmount) || 0),
            0,
          ) || 0,
        ).toFixed(2);
      }

      if (key === 'categories') {
        mapped.status =
          record.isActive !== undefined
            ? record.isActive
              ? 'ACTIVE'
              : 'INACTIVE'
            : 'ACTIVE';
        mapped.createdAt = record.createdAt || new Date();
      } else if (key === 'brands') {
        mapped.status =
          record.isActive !== undefined
            ? record.isActive
              ? 'ACTIVE'
              : 'INACTIVE'
            : 'ACTIVE';
      } else if (key === 'attributes') {
        mapped.name = record.title;
        mapped.displayName = record.title;
        mapped.code = record.slug;
        mapped.status =
          record.isActive !== undefined
            ? record.isActive
              ? 'ACTIVE'
              : 'INACTIVE'
            : 'ACTIVE';
      } else if (key === 'media') {
        mapped.fileName = record.url;
        mapped.size = record.size;
      } else if (key === 'reviews') {
        mapped.customerId = record.userId;
        mapped.status =
          record.approved !== undefined
            ? record.approved
              ? 'APPROVED'
              : 'PENDING'
            : 'APPROVED';
      } else if (key === 'banners') {
        mapped.status =
          record.isActive !== undefined
            ? record.isActive
              ? 'ACTIVE'
              : 'INACTIVE'
            : 'ACTIVE';
      } else if (key === 'discounts') {
        mapped.minPurchase = record.minOrderAmount;
        mapped.status =
          record.active !== undefined
            ? record.active
              ? 'ACTIVE'
              : 'INACTIVE'
            : 'ACTIVE';
      } else if (key === 'promotions') {
        mapped.title = record.name;
        mapped.status =
          record.active !== undefined
            ? record.active
              ? 'ACTIVE'
              : 'INACTIVE'
            : 'ACTIVE';
      }

      return mapped;
    });
  }

  private buildAvailableFields(): ReportFieldRegistryItem[] {
    const key = this.moduleName.toLowerCase();
    if (SCHEMA_FIELDS_OVERRIDE[key]) {
      return SCHEMA_FIELDS_OVERRIDE[key].map((f) => ({
        ...f,
        category: 'General',
        sortable: true,
        filterable: true,
        exportable: true,
        default: f.default ?? false,
      })) as ReportFieldRegistryItem[];
    }

    const model = Prisma.dmmf.datamodel.models.find(
      (m) => m.name.toLowerCase() === this.prismaModelName.toLowerCase(),
    );
    if (!model) {
      return [];
    }

    let defaultCount = 0;
    const fieldsList: ReportFieldRegistryItem[] = [];

    for (let index = 0; index < model.fields.length; index++) {
      const f = model.fields[index];
      if (f.kind !== 'scalar' && f.kind !== 'enum') continue;

      const fieldKey = f.name.replace(/([A-Z])/g, '_$1').toUpperCase();

      const isEssentialName = [
        'id',
        'name',
        'title',
        'slug',
        'status',
        'isactive',
        'active',
        'createdat',
        'total',
        'amount',
        'code',
        'ponumber',
        'grnnumber',
        'asnnumber',
      ].includes(f.name.toLowerCase());
      const isEssential = index < 4 || isEssentialName;

      let isDefault = false;
      if (isEssential && defaultCount < 4) {
        isDefault = true;
        defaultCount++;
      }

      const dbSelect: Record<string, any> = { [f.name]: true };

      if (f.name.toLowerCase().endsWith('id')) {
        const relField = model.fields.find(
          (rf) =>
            rf.kind === 'object' &&
            (rf.relationFromFields?.includes(f.name) ||
              rf.name.toLowerCase() ===
              f.name
                .replace(/Id$/i, '')
                .replace(/UserId$/i, '')
                .replace(/ByUserId$/i, '')
                .toLowerCase()),
        );

        if (relField) {
          const targetModel = Prisma.dmmf.datamodel.models.find(
            (tm) => tm.name.toLowerCase() === relField.type.toLowerCase(),
          );
          if (targetModel) {
            const displaySelect: Record<string, boolean> = {};
            const candidateFields = [
              'name',
              'poNumber',
              'grnNumber',
              'asnNumber',
              'orderNumber',
              'invoiceNumber',
              'returnNumber',
              'title',
              'code',
              'subject',
              'fullName',
              'email',
              'phone',
              'sku',
              'attributeSummary',
            ];

            for (const cand of candidateFields) {
              if (targetModel.fields.some((tf) => tf.name === cand)) {
                displaySelect[cand] = true;
              }
            }

            if (Object.keys(displaySelect).length > 0) {
              dbSelect[relField.name] = { select: displaySelect };
            }
          }
        }
      }

      fieldsList.push({
        key: fieldKey,
        label: f.name
          .replace(/([A-Z])/g, ' $1')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        field: f.name,
        type: this.mapPrismaTypeToReportType(f.type),
        category: 'General',
        default: isDefault,
        sortable: true,
        filterable: true,
        exportable: true,
        dbSelect,
      });

      // Inject companion readable name fields for relation IDs
      if (f.name === 'productId') {
        fieldsList.push({
          key: 'PRODUCT_NAME',
          label: 'Product Name',
          field: 'productName',
          type: 'string',
          category: 'General',
          default: true,
          sortable: true,
          filterable: true,
          exportable: true,
          dbSelect: {
            productId: true,
            product: { select: { name: true } },
          },
        });
      } else if (f.name === 'variantId') {
        fieldsList.push({
          key: 'VARIANT_NAME',
          label: 'Variant Name',
          field: 'variantName',
          type: 'string',
          category: 'General',
          default: true,
          sortable: true,
          filterable: true,
          exportable: true,
          dbSelect: {
            variantId: true,
            variant: {
              select: {
                sku: true,
                attributeSummary: true,
              },
            },
          },
        });
      } else if (f.name === 'supplierId') {
        fieldsList.push({
          key: 'SUPPLIER_NAME',
          label: 'Supplier Name',
          field: 'supplierName',
          type: 'string',
          category: 'General',
          default: true,
          sortable: true,
          filterable: true,
          exportable: true,
          dbSelect: {
            supplierId: true,
            supplier: { select: { name: true, code: true } },
          },
        });
      } else if (f.name === 'franchiseId') {
        fieldsList.push({
          key: 'FRANCHISE_NAME',
          label: 'Franchise Name',
          field: 'franchiseName',
          type: 'string',
          category: 'General',
          default: true,
          sortable: true,
          filterable: true,
          exportable: true,
          dbSelect: {
            franchiseId: true,
            franchise: { select: { name: true, code: true } },
          },
        });
      } else if (f.name === 'warehouseNodeId' || f.name === 'stockingNodeId') {
        fieldsList.push({
          key: 'WAREHOUSE_NODE_NAME',
          label: 'Warehouse Node Name',
          field: 'warehouseNodeName',
          type: 'string',
          category: 'General',
          default: true,
          sortable: true,
          filterable: true,
          exportable: true,
          dbSelect: {
            warehouseNodeId: true,
            warehouseNode: { select: { name: true, code: true } },
          },
        });
      } else if (f.name === 'purchaseOrderId') {
        fieldsList.push({
          key: 'PO_NUMBER',
          label: 'PO Number',
          field: 'poNumber',
          type: 'string',
          category: 'General',
          default: true,
          sortable: true,
          filterable: true,
          exportable: true,
          dbSelect: {
            purchaseOrderId: true,
            purchaseOrder: { select: { poNumber: true } },
          },
        });
      } else if (f.name === 'grnId') {
        fieldsList.push({
          key: 'GRN_NUMBER',
          label: 'GRN Number',
          field: 'grnNumber',
          type: 'string',
          category: 'General',
          default: true,
          sortable: true,
          filterable: true,
          exportable: true,
          dbSelect: {
            grnId: true,
            grn: { select: { grnNumber: true } },
          },
        });
      } else if (f.name === 'asnId') {
        fieldsList.push({
          key: 'ASN_NUMBER',
          label: 'ASN Number',
          field: 'asnNumber',
          type: 'string',
          category: 'General',
          default: true,
          sortable: true,
          filterable: true,
          exportable: true,
          dbSelect: {
            asnId: true,
            asn: { select: { asnNumber: true } },
          },
        });
      }
    }

    return fieldsList;
  }

  private mapPrismaTypeToReportType(
    prismaType: string,
  ): 'string' | 'number' | 'currency' | 'date' | 'status' {
    switch (prismaType) {
      case 'Int':
      case 'Float':
      case 'Decimal':
        return 'number';
      case 'Boolean':
        return 'status';
      case 'DateTime':
        return 'date';
      default:
        return 'string';
    }
  }
}
