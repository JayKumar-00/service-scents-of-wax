export interface ReportColumn {
  name: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'status';
}

export interface ReportFilterOption {
  label: string;
  value: string;
}

export interface ReportFilter {
  name: string;
  label: string;
  type: 'text' | 'select' | 'date';
  options?: ReportFilterOption[];
}

export interface ReportSummaryCard {
  label: string;
  value: string | number;
  type: 'string' | 'number' | 'currency' | 'percentage';
  description?: string;
}

export interface ReportFieldRegistryItem {
  key: string;
  label: string;
  field: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'status';
  category: string;
  default: boolean;
  sortable: boolean;
  filterable: boolean;
  exportable: boolean;
  dbSelect?: any;
}

export interface ReportMetadata {
  module: string;
  title: string;
  defaultFields: string[];
  availableFields: { key: string; label: string }[];
  fieldCategories: Record<string, string[]>;
  filters: ReportFilter[];
  supportedFormats: string[];
}

export interface ReportDataResponse {
  summary: Record<string, ReportSummaryCard>;
  records: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
