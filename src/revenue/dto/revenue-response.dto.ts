import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RevenueGraphPointDto {
  @ApiProperty({ example: '2026-08-19' })
  label!: string;

  @ApiProperty({ example: '2026-08-19T00:00:00.000Z' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-19T23:59:59.999Z' })
  endDate!: string;

  // Exact fields
  @ApiProperty({ description: 'Overall earnings across interval', example: 150000.0 })
  overAllRevanure!: number;

  @ApiProperty({ description: 'Payments made to suppliers', example: 30000.0 })
  SupplierPayments!: number;

  @ApiProperty({ description: 'Revenue from customer orders', example: 100000.0 })
  CustomerOrderRevenues!: number;

  @ApiProperty({ description: 'Total losses from refunds', example: 2000.0 })
  RefundLosses!: number;

  // CamelCase aliases
  @ApiProperty({ description: 'Overall revenue alias', example: 150000.0 })
  overallRevenue!: number;

  @ApiProperty({ description: 'Supplier payments alias', example: 30000.0 })
  supplierPayments!: number;

  @ApiProperty({ description: 'Customer order revenues alias', example: 100000.0 })
  customerOrderRevenues!: number;

  @ApiProperty({ description: 'Refund losses alias', example: 2000.0 })
  refundLosses!: number;

  // Specific franchise fields
  @ApiPropertyOptional({ description: 'POS Counter revenue for specific franchise', example: 40000.0 })
  POSRevanue?: number;

  @ApiPropertyOptional({ description: 'Online Customer revenue for specific franchise', example: 60000.0 })
  OnlineCustomerRevanue?: number;

  @ApiPropertyOptional({ description: 'POS revenue alias', example: 40000.0 })
  posRevenue?: number;

  @ApiPropertyOptional({ description: 'Online customer revenue alias', example: 60000.0 })
  onlineCustomerRevenue?: number;
}

export class RevenueResponseDto {
  @ApiProperty({ example: 'DAY' })
  period!: string;

  @ApiProperty({ example: '2026-08-19T00:00:00.000Z' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-19T23:59:59.999Z' })
  endDate!: string;

  @ApiPropertyOptional({ example: '2026-08-01', description: 'Start date filter applied if provided' })
  fromDate?: string | null;

  @ApiPropertyOptional({ example: '2026-08-19', description: 'End date filter applied if provided' })
  toDate?: string | null;

  @ApiPropertyOptional({ example: 'clx123456789' })
  franchiseId?: string | null;

  @ApiPropertyOptional({ example: 'GF-MUM-01' })
  franchiseCode?: string | null;

  @ApiPropertyOptional({ example: 7, description: 'Number of graph data points requested' })
  limit?: number;

  // Primary exact fields requested
  @ApiProperty({ description: 'Overall earnings across period', example: 150000.0 })
  overAllRevanure!: number;

  @ApiProperty({ description: 'Payments made to suppliers', example: 30000.0 })
  SupplierPayments!: number;

  @ApiProperty({ description: 'Revenue from customer orders', example: 100000.0 })
  CustomerOrderRevenues!: number;

  @ApiProperty({ description: 'Total losses from refunds', example: 2000.0 })
  RefundLosses!: number;

  // CamelCase aliases
  @ApiProperty({ description: 'Overall revenue alias', example: 150000.0 })
  overallRevenue!: number;

  @ApiProperty({ description: 'Supplier payments alias', example: 30000.0 })
  supplierPayments!: number;

  @ApiProperty({ description: 'Customer order revenues alias', example: 100000.0 })
  customerOrderRevenues!: number;

  @ApiProperty({ description: 'Refund losses alias', example: 2000.0 })
  refundLosses!: number;

  // Specific franchise fields
  @ApiPropertyOptional({ description: 'POS Counter revenue for specific franchise', example: 40000.0 })
  POSRevanue?: number;

  @ApiPropertyOptional({ description: 'Online Customer revenue for specific franchise', example: 60000.0 })
  OnlineCustomerRevanue?: number;

  @ApiPropertyOptional({ description: 'POS revenue alias', example: 40000.0 })
  posRevenue?: number;

  @ApiPropertyOptional({ description: 'Online customer revenue alias', example: 60000.0 })
  onlineCustomerRevenue?: number;

  // Graph time series data points
  @ApiPropertyOptional({
    type: [RevenueGraphPointDto],
    description: 'Graph time series data points based on period and limit',
  })
  graphData?: RevenueGraphPointDto[];
}
