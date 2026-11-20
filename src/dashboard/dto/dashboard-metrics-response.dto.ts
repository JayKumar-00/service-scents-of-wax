export class ExecutiveOverviewDto {
  totalRevenue!: string;
  orderCount!: number;
  customerCount!: number;
  inventoryValuation!: string;
  growthPercentage!: number;
  franchiseCount?: number;
  completedOrders?: number;
  openDeliveries?: number;
  atpUnits?: number;
  completionPercentage?: number;
  totalSales?: number;
  totalOrders?: number;
}

export class SalesAnalyticsDto {
  todaySales!: string;
  weeklySales!: string;
  monthlySales!: string;
  yearlySales!: string;
  revenueGrowthMoM!: number;
  averageOrderValue!: string;
  conversionRate?: number;
}

export class FastSlowProductDto {
  id!: string;
  name!: string;
  sku!: string;
  unitsSold!: number;
}

export class InventoryAnalyticsDto {
  totalStock!: number;
  lowStockCount!: number;
  outOfStockCount!: number;
  fastMovingProducts!: FastSlowProductDto[];
  slowMovingProducts!: FastSlowProductDto[];
  inventoryValuation!: string;
  stockAging!: {
    newStockCount: number;
    mediumStockCount: number;
    oldStockCount: number;
  };
}

export class OrderAnalyticsDto {
  statusCounts!: Record<string, number>;
  fulfillmentRate!: number;
}

export class CustomerAnalyticsDto {
  newCustomers!: number;
  returningCustomers!: number;
  customerRetentionRate!: number;
  repeatPurchaseRate!: number;
  customerLifetimeValue!: string;
}

export class FranchiseRevenueItemDto {
  id!: string;
  name!: string;
  code!: string;
  revenue!: string;
  orderCount!: number;
}

export class FranchiseAnalyticsDto {
  bestPerformingFranchise!: {
    id: string;
    name: string;
    revenue: string;
  } | null;
  lowestPerformingFranchise!: {
    id: string;
    name: string;
    revenue: string;
  } | null;
  revenueByFranchise!: FranchiseRevenueItemDto[];
}

export class OperationalAnalyticsDto {
  pendingApprovals?: number;
  stockRequestsCount!: number;
  inventoryTransfersCount?: number;
  openIssuesCount!: number;
}

export class MediaLibraryAnalyticsDto {
  totalCount!: number;
  occupiedStorage!: string;
}

export class DashboardWidgetsDto {
  executiveOverview?: ExecutiveOverviewDto;
  salesAnalytics?: SalesAnalyticsDto;
  inventoryAnalytics?: InventoryAnalyticsDto;
  orderAnalytics?: OrderAnalyticsDto;
  customerAnalytics?: CustomerAnalyticsDto;
  franchiseAnalytics?: FranchiseAnalyticsDto;
  operationalAnalytics?: OperationalAnalyticsDto;
  recentActivities?: any[];
  mediaLibrary?: MediaLibraryAnalyticsDto;
  charts?: any;
  inventory?: any;
  reorderSuggestions?: any[];
  recentDeliveries?: any[];
  topCustomers?: any[];
  faqPreview?: any[];
}

export class DashboardMetricsResponseDto {
  role!: string;
  scope!: string;
  period!: string;
  range!: {
    from: string;
    to: string;
  };
  widgets!: DashboardWidgetsDto;
}
