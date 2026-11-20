import { ShipmentPaymentMode } from '@prisma/client';
import { ShipmentOrderType } from '../dto/create-shipment.dto';

export interface AssignShipmentPayload {
  shipment_id: string;
  courier_id: string;
  status?: string;
}

export interface AssignShipmentResult {
  awb: string;
  courierName: string;
  shipmentId: string;
  invoice_no: string;
  company_id: string;
  courier_company_id: string;
}

export interface GeneratePickupPayload {
  shipmentIds: number[]; // <-- array
  retry?: boolean;
  pickupDate?: string; // YYYY-MM-DD
}

export interface GeneratePickupResult {
  pickupScheduledDate: string;
  pickupTokenNumber: string;
  pickupGeneratedDate: string;
  pickupMessage: string;
}

export interface GenerateLabelPayload {
  shipmentIds: number[]; // <-- array
}

export interface GenerateLabelResult {
  labelUrl: string;
  labelMessage: string;
  failedLabels: string[];
}

export interface GenerateInvoicePayload {
  shiprocketOrderIds: number[]; // <-- array
}

export interface GenerateInvoiceResult {
  invoiceUrl: string;
  failedInvoices: string[];
}

export interface TrackingSuccess {
  awb: string;
  courierName?: string;
  currentStatus?: string;
  deliveredDate?: string;
  trackUrl?: string;
  activities?: {
    date: string;
    status: string;
    activity: string;
    location: string;
  }[];
}

export interface TrackingUnavailable {
  awb?: string;
  shipment_id?: string;
  status: string;
}

export type TrackingResult = TrackingSuccess | TrackingUnavailable;

export interface TransportHookResult {
  shipment_id: string;
  shipment_status: string;
  awb?: string; // Optional: AWB may be assigned later by Shiprocket
  courier_name?: string; // Optional: Courier name from webhook payload
}

export interface AddPickupLocationPayload {
  pickup_location: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  address_2?: string;
  city: string;
  state: string;
  country: string;
  pin_code: string;
  lat?: string | number | undefined;
  long?: string | number | undefined;
  open_time?: string | null;
  close_time?: string | null;
}

export interface GenerateManifestPayload {
  shipmentIds: number[];
}

export interface PrintManifestPayload {
  order_ids: number[];
}

export interface GetShipmentsResult {
  message: string;
  data: unknown[];
  meta: unknown;
}

export interface ShirocketMeta {
  pagination: {
    total: number;
    count: number;
    per_page: number;
    current_page: number;
    total_pages: number;
    links: unknown;
  };
}

export interface OrderItemPayload {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
  tax?: number;
  hsn?: number;
}

interface Product {
  id: number;
  order_id: number;
  product_id: number;

  name: string;
  sku: string;
  description: string;

  custom_field?: string;
  custom_field_value?: string;
  custom_field_value_string?: string;

  channel_order_product_id: string;
  channel_sku: string;

  hsn: string;

  model?: string | null;
  manufacturer?: string | null;

  brand: string;
  color: string;
  size?: string | null;

  weight: number;
  dimensions: string;

  price: number;
  cost: number;
  mrp: number;

  quantity: number;
  returnable_quantity: number;

  tax: number;
  status: number;

  net_total: number;
  discount: number;

  product_options: unknown[];

  selling_price: number;
  tax_percentage: number;

  discount_including_tax: number;

  channel_category: string;

  packaging_material: string;
  additional_material: string;
  is_free_product: string;
}

interface Shipment {
  id: number;
  order_id: number;
  order_product_id?: string | number | null;

  cost: string;
  tax: string;

  awb?: string | null;

  status: string;

  quantity: number;

  weight: number;
  volumetric_weight: number;

  dimensions: string;

  courier: string;
  channel_id: number;
  comment?: string;
  code?: string;
  pod?: string | null;
  eway_bill_number: string;
  eway_bill_date: string | null;
  rto_initiated_date?: string;
  rto_delivered_date?: string;
  shipped_date?: string;
  package_images?: string;
  eway_required: boolean;
  invoice_link: string;
  is_darkstore_courier: number;
  courier_custom_rule: string;
  rto_awb?: string | null;
  awb_assign_date: string | null;
  etd?: string;
  delivered_date?: string | null;
  cod_charges: string;
  number: string;
  name: string;
  order_item_id: null;
  courier_id?: string;
  manifest_id?: string;
  manifest_escalate: boolean;
  isd_code: string;
  created_at: string;
  updated_at: string;

  length: number;
  breadth: number;
  height: number;

  is_rto: boolean;
  is_single_shipment: boolean;
}

interface AwbData {
  awb: string;
  applied_weight: string;
  charged_weight: string;
  billed_weight: string;

  routing_code: string;
  rto_routing_code: string;

  charges: {
    zone: string;
    cod_charges: string;
    applied_weight_amount: string;
    freight_charges: string;
    applied_weight: string;
    charged_weight: string;
    charged_weight_amount: string;
    charged_weight_amount_rto: string;
    applied_weight_amount_rto: string;
    service_type_id: string;
  };
}

interface OrderInsurance {
  insurance_status: string;
  policy_no: string;
  claim_enable: boolean;
}

interface ReturnPickup {
  id: number;
  name: string;
  email: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  country: string;
  pin_code: string;
  phone: string;
  lat: string | null;
  long: string | null;
  order_id: number;
  created_at: string;
  updated_at: string;
}

interface Others {
  weight: string;
  quantity: number;

  shipping_city: string;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string;

  shipping_state: string;
  shipping_address: string;

  shipping_country: string;
  shipping_pincode: string;
  buyer_psid: null | string | number;
  dimensions: string;
  api_order_id?: string;
  company_name: string;
  currency_code: string;
  package_count: string;
  custom_order_id: number | string | null;
  billing_isd_code: string;
  forward_order_id: string | number | null;
  shipping_charges: string;
  shipping_address_2: string;
}

interface ExtraInfo {
  qc_check: number;
  qc_params: string;
  order_type: number;

  amazon_dg_status: boolean;
  forward_order_id: string;

  bluedart_dg_status: boolean;
  other_courier_dg_status: boolean;

  insurace_opted_at_order_creation: boolean;
}

interface RefundDetail {
  refund_mode: string;
  account_holder_name: string;
  account_number: string;
  bank_ifsc: string;
  bank_name: string;
}

interface ProductQC {
  product_id: number | string;
  qc_values: Record<
    string,
    {
      value: string;
      name: string;
    }
  >;
}

interface ShippingAddress {
  id: number | string;
  pickup_location: string;
  address_type: string | null;
  address: string;
  address_2: string;
  updated_address: boolean;
  old_address?: string;
  old_address2?: string;
  tag?: string;
  tag_value?: string;
  instruction?: string;
  city: string;
  state: string;
  country: string;
  pin_code: string;
  email: string;
  is_first_mile_pickup: number | string;
  phone: string;
  name: string;
  company_id: number | string;
  gstin: string | number | null;
  vendor_name: string | null;
  status: number | null | string;
  phone_verified: number;
  lat: string;
  long: string;
  open_time: string | null;
  close_time: string | null;
  warehouse_code: string | number | null;
  alternate_phone?: string | number | null;
  rto_address_id: number | string | null;
  lat_long_status: number | string;
  new: number;
  associated_rto_address: string | null;
  is_primary_location: number | string;
}

export interface TransportShipmentOrderIDPayload {
  order_id: string;
  order_date: string;
  pickup_location: string;
  comment?: string;

  billing_customer_name: string;
  billing_last_name?: string;

  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;

  shipping_is_billing: boolean;

  shipping_customer_name: string;
  shipping_last_name?: string;

  shipping_address: string;
  shipping_address_2?: string;
  shipping_city: string;
  shipping_pincode: string;
  shipping_country: string;
  shipping_state: string;
  shipping_email: string;
  shipping_phone: string;

  order_items: OrderItemPayload[];

  payment_method: ShipmentPaymentMode;
  shipping_charges: number;
  giftwrap_charges?: number;
  transaction_charges?: number;

  total_discount: number;
  sub_total: number;

  length: number;
  breadth: number;
  height: number;
  weight: number;

  invoice_number?: string;
  ewaybill_no?: string;
  order_type: ShipmentOrderType;
}

export interface TransportShipmentOrderIDResult {
  order_id?: string | number;
  channel_order_id?: string | number;
  shipment_id?: string | number;
  status?: string | number;
  status_code?: number | string;
  onboarding_completed_now?: boolean;
  awb_code?: string | number; // Sometimes AWB is assigned immediately, other times it may be assigned later via webhook or manual assignment
  courier_company_id?: string | number; // possibliy has empty string if not available at this stage
  courier_name?: string; // possibliy has empty string if not available at this stage
  new_channel?: boolean;
  packaging_box_errord?: string | number | boolean;
}

export interface TransportShipmentOrderWithChannelID extends TransportShipmentOrderIDPayload {
  channel_id: string;
}

export interface GetAllPickupLocationsResult {
  data: any[];

  meta: {
    count: number;
    totalItems: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

export interface AddPickupLocationResult {
  address: {
    company_id: number;
    pickup_code: string;
    address: string;
    address_2?: string;
    address_type: string | null;
    city: string;
    state: string;
    country: string;
    gstin: string | null;
    pin_code: string | number;
    phone: string;
    email: string;
    name: string;
    alternate_phone: string | number | null;
    lat: string | number | null;
    long: string | number | null;
    status: number;
    phone_verified: number;
    rto_address_id: number | string | null;
    extra_info: string | null;
    updated_at: string;
    created_at: string;
    id: number | string;
  };
  pickup_id: number | string;
  company_name: string;
  full_name: string;
}

export interface UpdatePickupLocationResult {
  message: string;
}

export interface UpdateDeliverylocationResult {
  message: string;
}

export interface AddProductResult {
  success: boolean;
  message?: string;
}

export interface UpdateShipmentOrderResult {
  partially_update: boolean;
  not_updated_fields: string;
  order_id: number;
  shipment_id: number;
  new_order_status: string;
  old_order_status: number;
  awb_code?: string;
  courier_company_id: string | number;
  courier_name?: string;
}

export interface ConvertToQCProductResult {
  success: boolean;
  message: string;
}

export interface GetShipmentOrdersResult {
  data: [
    {
      id: number;
      channel_id: number;
      channel_name: string;
      base_channel_code: string;
      channel_order_id: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string;
      pickup_location: string;
      payment_status?: string;
      total: string;
      tax: string | number;
      sla: string;
      shipping_method: string;
      expedited: number;
      status: string;
      status_code: number;
      payment_method: string;
      is_international: number;
      purpose_of_shipment: number;
      channel_created_at: string;
      created_at: string;
      products: [
        {
          id: number;
          channel_order_product_id: string | number;
          name: string;
          channel_sku: string;
          quantity: number;
          product_id: number;
          available: number;
          status: string;
          hsn: string;
        },
      ];
      shipments: [
        {
          id: number | string;
          isd_code?: string;
          courier?: string;
          weight: number;
          dimensions: string;
          pickup_scheduled_date: string | null;
          pickup_token_number: string | null;
          awb?: string;
          return_awb?: string;
          volumetric_weight: number | string | null;
          pod: number | string | null;
          etd: string;
          rto_delivered_date: string | null;
          delivered_date: string | null;
          etd_escalation_btn: boolean;
        },
      ];
      activities: string[];
      allow_return: number;
      is_incomplete: number;
      errors: unknown;
      show_escalation_btn: number;
      escalation_status?: string;
      escalation_history: unknown;
    },
  ];

  meta: ShirocketMeta;
}

export interface GetShipmentOrderResult {
  id: number;
  channel_id: number;
  channel_name: string;
  base_channel_code: string;

  is_international: number;
  is_document: number;

  channel_order_id: string;

  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_address_2?: string | null;
  customer_city: string;
  customer_state: string;
  customer_pincode: string;
  customer_country: string;

  pickup_code: string;
  pickup_location: string;
  pickup_location_id: string;
  pickup_id: string;

  ship_type: string;
  courier_mode: string;

  currency: string;
  country_code: number;

  exchange_rate_usd: number;
  exchange_rate_inr: number;
  state_code: number;

  payment_status: string;
  delivery_code: string;

  total: number;
  total_inr: number;
  total_usd: number;

  net_total: string;
  other_charges: string;
  other_discounts: string;
  giftwrap_charges: string;

  expedited: number;
  sla: string;
  cod: number;

  tax: number;
  total_kerala_cess: string;

  discount: number;

  status: string;
  sub_status?: string | null;
  status_code: number;

  master_status: string;

  payment_method: string;
  purpose_of_shipment: number;

  channel_created_at: string;
  created_at: string;
  order_date: string;
  updated_at: string;

  products: Product[];

  invoice_no: string;

  shipments: Shipment;

  awb_data: AwbData;

  order_insurance: OrderInsurance;

  return_pickup_data: ReturnPickup;

  company_logo?: string | null;

  allow_return: number;
  is_return: number;
  is_incomplete: number;

  errors?: string | null;

  payment_code?: string | null;

  coupon_is_visible: boolean;
  coupons: string;

  billing_city: string;
  billing_name: string;
  billing_email: string;
  billing_phone: string;
  billing_alternate_phone: string;
  billing_state_name: string;
  billing_address: string;
  billing_country_name: string;
  billing_pincode: string;
  billing_address_2: string;

  billing_mobile_country_code: string;

  isd_code: string;
  billing_state_id: string;
  billing_country_id: string;

  freight_description: string;

  reseller_name: string;

  shipping_is_billing: number;
  company_name: string;

  shipping_title: string;

  allow_channel_order_sync: boolean;

  'uib-tooltip-text': string;

  api_order_id: string;

  allow_multiship: number;

  other_sub_orders: unknown[];

  others: Others;

  is_order_verified: number;

  extra_info: ExtraInfo;

  dup: number;
  is_blackbox_seller: boolean;

  shipping_method: string;

  refund_detail: RefundDetail;

  pickup_address: unknown[];

  eway_bill_number: string;
  eway_bill_url: string;
  eway_required: boolean;

  irn_no: string;

  engage?: string | null;

  seller_can_edit: boolean;
  seller_can_cancell: boolean;
  is_post_ship_status: boolean;

  order_tag: string;

  qc_status: string;
  qc_reason: string;
  qc_image: string;

  product_qc: ProductQC[];

  seller_request?: string | null;

  change_payment_mode: boolean;

  etd_date?: string | null;
  out_for_delivery_date?: string | null;
  delivered_date?: string | null;

  remittance_date: string;
  remittance_utr: string;
  remittance_status: string;

  insurance_excluded: boolean;
  can_edit_dimension: boolean;
}

export interface ExportOrdersResult {
  is_background_downloading: string | number;
}

export interface GetAllProductsResult {
  data: {
    id: number;
    sku: string;
    hsn: string;
    name: string;
    description?: string;
    category_code: string;
    category_name: string;
    category_tax_code: string;
    image: string;
    weight: string;
    size: string;
    cost_price: string;
    mrp: string;
    tax_code: string | number; // ✅ fixed
    low_stock: number;
    ean?: string;
    upc?: string;
    isbn?: string;
    created_at: string;
    updated_at: string;
    quantity: number;
    color: string;
    brand: string;
    dimensions: string;
    status: string;
    type: string;
    is_dropship?: boolean;
  }[];

  meta: ShirocketMeta;
}

export interface GetProductResult {
  id: number;
  sku: string;
  name: string;
  description?: string;
  category_code?: string;
  category_name?: string;
  category_tax_code?: string | number;
  image: string;
  weight: string;
  size: string;
  cost_price: string;
  mrp: string;
  tax_code?: string | number;
  low_stock: number;
  ean: string;
  upc: string;
  isbn: string;
  created_at: string;
  updated_at: string;
  quantity: number;
  color?: string;
  brand?: string;
  dimensions: string;
  status: string;
  is_combo: number;
}

export interface GetChannelsResult {
  id: number;
  name: string;
  store_name: string;
  status: string;
  connection_response: string | number | null;
  channel_updated_at: string;
  status_code: number;
  settings: {
    dimensions: string;
    weight: number;
    order_status?: string;
    allow_dropship: number;
  };
  auth: unknown;
  connection: number;
  orders_sync: number;
  inventory_sync: number;
  catalog_sync: number;
  orders_synced_on: string;
  inventory_synced_on: string;
  base_channel_code: string;
  base_channel: {
    id: number;
    name: string;
    code: string;
    type: string;
    logo: string;
    settings_sample: {
      name: string;
      help?: string;
      settings: {
        brand_name: {
          code: string;
          name: string;
          placeholder: string;
          type: string;
        };
        brand_logo: {
          code: string;
          name: string;
          placeholder: string;
          type: string;
        };
      };
    };
    auth_sample: unknown[];
    description: string;
  };
  catalog_synced_on: string;
  order_status_mapper: string;
  payment_status_mapper: string;
  brand_name: string;
  brand_logo: string;
  brand_id: number;
  allow_mark_as_paid: boolean;
  warehouse_locations: unknown;
  skip_unpaid_prepaid: boolean;
  vendor_id: number;
  b2b_channels: unknown;
  allow_marketplace_list: string[];
  is_b2b_channel: number;
  allow_e_invoice: number;
  allow_rocketbox: number;
  allow_dropship: number;
  acms: number;
  acas: number;
  use_external_invoice_details: number;
}

export interface UpdateInventoryResult {
  available_quantity: number;
  blocked_quantity: number;
  total_quantity: number;
}

export interface GetInventoryResult {
  data: {
    id: number;
    total_quantity: number;
    available_quantity: number;
    blocked_quantity: number;
    category_name: string;
    updated_on: string;
    sku: string;
    is_combo: number;
    name: string;
    type: string;
    color?: string;
    brand?: string;
  }[];
  meta: ShirocketMeta;
}

export interface GetCountryResult {
  id: number;
  name: string;
  iso_code_2: string;
  iso_code_3: string;
  isd_code: string;
  address_format: string;
  postcode_required: number;
  status: number;
}

export interface GetZoneResult {
  id: number;
  country_id: number;
  code: string;
  state_code: string | number | null;
  name: string;
  status: number;
}

export interface GetLocalityResult {
  postcode_details: {
    postcode: string;
    city: string;
    locality: [string, string, string, string, string];
    state: string;
    state_code: string;
    longitude: string;
    latitude: string;
  };
}

export interface GetStatementResult {
  transaction_id: string;
  order_id: string;
  channel_order_id: string;
  awb_code: string;
  return_awb_code: number | string | null;
  applied_weight: string;
  charged_weight: string;
  billed_weight: string;
  action: string;
  charge: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
  balance_amount: string;
  balance_weight: number;
  volumetric_weight: string;
  entered_weight: string;
  created_at: string;
  can_ship: boolean;
}

export interface GetDiscrepancyResult {
  data: unknown[];
  upper_fold_text: string;
  lower_fild_text: string;
}

export interface GetImportResult {
  status: string;
  message: string;
}

export interface ExchangeShimentResult {
  forward_orders: {
    order_id: number;
    channel_order_id: string;
    shipment_id: number;
    status: string;
    status_code: number;
    awb_code?: string;
    courier_company_id?: string;
    courier_name: string;
  };
  return_orders: {
    order_id?: number;
    channel_order_id: string;
    shipment_id: number;
    status: string;
    status_code: number;
    awb_code: string;
    courier_company_id: string;
    courier_name: string;
  };
}

export interface UpdateReturnOrderResult {
  product_details: {
    success: boolean;
    msg: string;
  };
  return_warehouse_address: {
    success: boolean;
    msg: string;
  };
}

export interface GetReturnOrdersResult {
  data: {
    id: number;
    channel_id: number;
    channel_name: string;
    base_channel_code: string;
    channel_order_id: string;

    customer_name: string;
    customer_email: string;
    customer_phone: string;
    customer_pincode: string;

    pickup_code: string;
    pickup_location: string;

    payment_status: string;
    total: string;

    expedited: number;
    sla: string;
    shipping_method: string;

    status: string;
    status_code: number;

    payment_method: string;

    is_international: number;
    purpose_of_shipment: number;

    channel_created_at: string;
    created_at: string;

    products: unknown[];

    delivery_code: string;
    cod: number;

    shipment_id: number;
    in_queue: number;

    shipments: unknown[];
  }[];
  meta: ShirocketMeta;
}
