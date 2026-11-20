import { DashboardPeriod } from './dashboard-query.dto';

export class FranchiseOverviewDto {
  totalSales!: number;
  completedOrders!: number;
  totalOrders!: number;
  openDeliveries!: number;
  atpUnits!: number;
  completionPercentage!: number;
}

export class MonthlySalesItemDto {
  month!: string;
  revenue!: number;
}

export class MonthlyDeliveriesItemDto {
  month!: string;
  deliveries!: number;
}

export class FranchiseChartsDto {
  monthlySales!: MonthlySalesItemDto[];
  monthlyDeliveries!: MonthlyDeliveriesItemDto[];
}

export class LowStockProductDto {
  productId!: string;
  productName!: string;
  availableQty!: number;
  totalQty!: number;
  reservedQty!: number;
  stockPercentage!: number;
}

export class CategoryBreakdownDto {
  categoryId!: string | null;
  categoryName!: string;
  units!: number;
  percentage!: number;
}

export class FranchiseInventoryDto {
  totalInventoryRows!: number;
  atpUnits!: number;
  lowStockProducts!: LowStockProductDto[];
  categoryBreakdown!: CategoryBreakdownDto[];
}

export class FranchiseReorderSuggestionDto {
  productId!: string;
  productName!: string;
  categoryName!: string | null;
  currentQty!: number;
  availableQty!: number;
  lowStockThreshold!: number | null;
  suggestedOrderQty!: number;
}

export class FranchiseRecentOrderDto {
  orderId!: string;
  orderNumber!: string;
  amount!: number;
  status!: string;
  createdAt!: Date;
}

export class FranchiseRecentDeliveryDto {
  deliveryId!: string;
  status!: string;
  createdAt!: Date;
}

export class FranchiseTopCustomerDto {
  customerId!: string;
  name!: string;
  phone!: string | null;
  email!: string | null;
  totalOrders!: number;
}

export class FranchiseFaqPreviewDto {
  id!: string;
  question!: string;
  answer!: string;
}

export class FranchiseOperationalSummaryDto {
  pendingStockRequests!: number;
  inTransitTransfers!: number;
  openSupportTickets!: number;
}

export class FranchiseDashboardResponseDto {
  overview!: FranchiseOverviewDto;
  charts!: FranchiseChartsDto;
  inventory!: FranchiseInventoryDto;
  reorderSuggestions!: FranchiseReorderSuggestionDto[];
  recentOrders!: FranchiseRecentOrderDto[];
  recentDeliveries!: FranchiseRecentDeliveryDto[];
  topCustomers!: FranchiseTopCustomerDto[];
  faqPreview!: FranchiseFaqPreviewDto[];
  operationalSummary!: FranchiseOperationalSummaryDto;
  period?: DashboardPeriod;
  range?: { from?: string; to?: string };

  // Future widgets/fields can be added without breaking contract
  [key: string]: any;
}
