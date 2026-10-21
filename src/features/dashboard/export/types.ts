export interface SummaryMetric {
  id?: string;
  label: string;
  title?: string;
  value: number | string;
  formattedValue: string;
  changePercentage?: number | string;
  trendPercentage?: number | string;
  trendDirection?: string;
  changeDirection?: string;
  column?: string;
  field?: string;
  metricColumn?: string;
  targetColumn?: string;
  aggregation?: string;
  notes?: string;
}

export interface ChartExportSeries {
  name: string;
  colLetter: string;
  values: number[];
  colorHex?: string;
}

export interface ChartExportDefinition {
  sheetName: string;
  dataSheetName?: string;
  headerRow?: number;
  title: string;
  chartType: 'line' | 'bar' | 'bar-horizontal' | 'area' | 'pie' | 'donut';
  categories: string[];
  dimColLetter: string;
  startRow: number;
  endRow: number;
  series: ChartExportSeries[];
  numFmt?: string;
  fromCol?: number;
  fromRow?: number;
  toCol?: number;
  toRow?: number;
  fromColOff?: number;
  toColOff?: number;
  fromRowOff?: number;
  toRowOff?: number;
}

export interface ExcelExportOptions {
  dashboardTitle?: string;
  dashboardSubtitle?: string;
  currency?: string;
  exportedAt?: Date;
  customMapBase64?: string;
  dashboardScreenshotBase64?: string;
  dashboardImageBase64?: string;
  charts?: any[];
  datasetRows?: Record<string, any>[];
  columns?: any[];
  kpis?: SummaryMetric[];
  headerSettings?: any;
  statCards?: any[];
  formatConfigs?: Record<string, any>;
}

export interface MonthlyDataRow {
  month: string;
  revenue: number;
}

export interface CategoryDataRow {
  category: string;
  revenue: number;
}

export interface DeviceDataRow {
  device: string;
  percentage: number;
}

export interface ProvinceDataRow {
  province: string;
  code: string;
  revenue: number;
  activeUsers: number;
  marketShare: number;
}
