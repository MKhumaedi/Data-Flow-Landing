export type UserRole = 'FREE' | 'PREMIUM' | 'SUPERADMIN' | 'user' | 'admin' | 'executive' | 'analyst';

export type PlanType = 'free' | 'pro' | 'enterprise' | 'FREE' | 'PREMIUM';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface NotificationPreferences {
  transactions: boolean;
  subscriptionReminders: boolean;
  contentUpdates: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  verificationStatus?: VerificationStatus;
  verifiedAt?: string | Date | null;
  verifiedBy?: string | null;
  premiumExpiresAt?: string | Date | null;
  currentPlanId?: string | null;
  currentPlanName?: string | null;
  title?: string;
  avatarUrl?: string | null;
  notificationPreferences?: NotificationPreferences;
  plan?: PlanType | string;
  dashboardsUsed?: number;
  dashboardCount?: number;
  maxDashboards?: number;
  twoFactorEnabled?: boolean;
  localProcessingOnly?: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | Date | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type ColumnType = 'string' | 'number' | 'date' | 'boolean' | 'category' | 'currency';

export interface ColumnMeta {
  name: string;
  originalName?: string;
  type: ColumnType;
  sampleValues?: (string | number | boolean | null)[];
  nullCount?: number;
  uniqueCount?: number;
  isNumeric?: boolean;
  isDate?: boolean;
  isCategorical?: boolean;
  min?: number;
  max?: number;
  avg?: number;
}

export type DatasetColumn = ColumnMeta;

export interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  affectedRowIndices?: number[];
  affectedColumn?: string;
  resolved?: boolean;
}

export interface Dataset {
  id: string;
  userId: string;
  filename?: string;
  fileName?: string;
  fileSize: number;
  fileType?: 'csv' | 'xlsx' | 'xls' | string;
  rowCount: number;
  columnCount?: number;
  columns: ColumnMeta[] | any;
  data?: Record<string, any>[];
  sampleData?: Record<string, any>[];
  validationIssues?: ValidationIssue[];
  isCleaned?: boolean;
  createdAt?: string;
  uploadedAt?: string | Date;
  updatedAt?: string;
  deletedAt?: string | Date | null;
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'kpi';
export type AggregationType = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';

export interface ChartConfig {
  id: string;
  title: string;
  subtitle?: string;
  chartType: ChartType;
  dimensionColumn: string;
  metricColumn: string;
  secondaryMetricColumn?: string;
  aggregation: AggregationType;
  colorScheme?: string;
  gridSpan?: 1 | 2 | 3 | 4;
  timeGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  sortBy?: 'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
  limit?: number;
  targetValue?: number;
}

export type TemplateId = 
  | 'minimal-teal' 
  | 'corporate-navy' 
  | 'midnight-executive'
  | 'sage-analytics'
  | 'amber-insight'
  | 'slate-professional'
  | 'coral-modern'
  | 'indigo-precision'
  | 'emerald-corporate'
  | 'charcoal-minimalist'
  | string;

export interface TemplateTheme {
  id: TemplateId | string;
  name: string;
  description?: string;
  isPremium: boolean;
  thumbnailUrl?: string;
  thumbnail?: string;
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    cardBg: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    chartPalette: string[];
  };
  fontFamily?: string;
  roundedStyle?: string;
  badgeBg?: string;
  badgeText?: string;
  layoutConfig?: any;
  deletedAt?: string | Date | null;
}

export interface DashboardHeaderActions {
  editWidget: boolean;
  tema: boolean;
  exportExcel: boolean;
  exportPdf: boolean;
  shareLink: boolean;
}

export interface DashboardHeaderSettings {
  showStatusBadge: boolean;
  showSubtitle: boolean;
  visibleActions: DashboardHeaderActions;
  statCards?: any[];
}

export interface Dashboard {
  id: string;
  userId?: string;
  datasetId: string;
  templateId?: TemplateId | string;
  themeId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  config?: any;
  layout?: any;
  status?: 'active' | 'archived' | 'draft';
  charts?: ChartConfig[];
  kpis?: {
    title: string;
    value: string | number;
    changePercentage: number;
    changeDirection: 'up' | 'down' | 'neutral';
    comparisonText: string;
    metricType?: 'currency' | 'number' | 'percentage';
    targetPercentage?: number;
    color?: string;
  }[];
  filters?: {
    selectedDateRange?: string;
    selectedCategory?: string;
    selectedRegion?: string;
    currency: 'IDR' | 'USD' | 'EUR';
  };
  shared?: {
    isPublic: boolean;
    publicUrlId?: string;
    requirePassword?: boolean;
    password?: string;
    allowExport?: boolean;
  };
  isPublic?: boolean;
  publicId?: string;
  isPublicShare?: boolean;
  shareToken?: string;
  rowCount?: number;
  dataset?: Dataset;
  createdAt: string | Date;
  updatedAt?: string | Date;
  deletedAt?: string | Date | null;
  retention?: {
    isSubjectToAutoDeletion: boolean;
    daysRemaining: number | null;
    autoDeleteDate: string | null;
    isExpiringSoon: boolean;
  };
  trashRetention?: {
    daysRemaining: number;
    autoDeleteDate: string;
  };
}

export interface ConfigField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  logo?: string;
  icon?: string;
  category: string;
  status?: 'available' | 'coming_soon' | 'beta';
  connected?: boolean;
  lastSync?: string;
  configFields?: ConfigField[];
  subscribersCount?: number;
  isSubscribed?: boolean;
  features?: string[];
}

export type DataIntegration = Integration;

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  userId?: string;
  amount: number;
  currency: string;
  plan?: string;
  billingCycle?: string;
  status: 'PAID' | 'UNPAID' | 'EXPIRED' | 'FAILED' | 'PENDING';
  paymentMethod: string;
  paymentUrl?: string;
  planId?: string;
  createdAt?: string;
  paidAt?: string;
}

export interface PlanFeature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

export interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  email: boolean;
  push: boolean;
}

export interface FormulaPracticeData {
  headers?: string[];
  rows: (string | number | boolean | null)[][];
  resultCell?: {
    row: number;
    col: number;
    formula: string;
    label?: string;
  };
  explanationNote?: string;
}

export interface Formula {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDesc: string;
  fullExplanation: string;
  syntaxExample: string;
  practiceData: FormulaPracticeData | any;
  order: number;
  isPublished: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
}

export type AdSlotType = 'image' | 'script_embed';

export interface AdSlot {
  id: string;
  placement: string;
  type: AdSlotType;
  imageUrl?: string | null;
  linkUrl?: string | null;
  scriptCode?: string | null;
  isActive: boolean;
  updatedAt: string | Date;
  updatedBy?: string | null;
  deletedAt?: string | Date | null;
}

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'table'
  | 'signature_line';

export interface FormFieldDef {
  id: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  columns?: string[];
}

export interface FormTemplateItem {
  id: string;
  slug: string;
  category: string;
  title: string;
  description: string;
  fields: FormFieldDef[];
  order: number;
  isPublished: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
}

export interface CreateFormTemplateDto {
  slug?: string;
  category: string;
  title: string;
  description: string;
  fields: FormFieldDef[];
  order?: number;
  isPublished?: boolean;
}

export interface UpdateFormTemplateDto {
  slug?: string;
  category?: string;
  title?: string;
  description?: string;
  fields?: FormFieldDef[];
  order?: number;
  isPublished?: boolean;
}

export interface PlanPricingItem {
  id: string;
  planId: string;
  durationLabel: string;
  durationDays: number;
  normalPrice: number;
  discountPrice?: number | null;
  isBestValue: boolean;
  isActive: boolean;
  order: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  deletedAt?: string | Date | null;
}

export interface PlanItem {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  badge?: string | null;
  accentColor: string;
  features: string[];
  dashboardLimit?: number | null;
  templateAccessLimit?: number | null;
  isFree: boolean;
  isActive: boolean;
  order: number;
  pricingOptions: PlanPricingItem[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  deletedAt?: string | Date | null;
}

export interface CreatePlanDto {
  slug?: string;
  name: string;
  tagline?: string | null;
  badge?: string | null;
  accentColor?: string;
  features: string[];
  dashboardLimit?: number | null;
  templateAccessLimit?: number | null;
  isFree?: boolean;
  isActive?: boolean;
  order?: number;
  pricingOptions?: Array<{
    durationLabel: string;
    durationDays: number;
    normalPrice: number;
    discountPrice?: number | null;
    isBestValue?: boolean;
    isActive?: boolean;
    order?: number;
  }>;
}

export interface UpdatePlanDto {
  slug?: string;
  name?: string;
  tagline?: string | null;
  badge?: string | null;
  accentColor?: string;
  features?: string[];
  dashboardLimit?: number | null;
  templateAccessLimit?: number | null;
  isFree?: boolean;
  isActive?: boolean;
  order?: number;
  pricingOptions?: Array<{
    id?: string;
    durationLabel: string;
    durationDays: number;
    normalPrice: number;
    discountPrice?: number | null;
    isBestValue?: boolean;
    isActive?: boolean;
    order?: number;
  }>;
}

export interface UserPlanLimits {
  userId: string;
  planId: string | null;
  planSlug: string;
  planName: string;
  isFree: boolean;
  isPremiumRole: boolean;
  dashboardLimit: number | null;
  templateAccessLimit: number | null;
  currentDashboardCount: number;
  canCreateDashboard: boolean;
  unlockedTemplateCount: number | null;
}

export interface CreatePlanPricingDto {
  durationLabel: string;
  durationDays: number;
  normalPrice: number;
  discountPrice?: number | null;
  isBestValue?: boolean;
  isActive?: boolean;
  order?: number;
}

export interface UpdatePlanPricingDto {
  durationLabel?: string;
  durationDays?: number;
  normalPrice?: number;
  discountPrice?: number | null;
  isBestValue?: boolean;
  isActive?: boolean;
  order?: number;
}

export interface TransactionRecord {
  id: string;
  reference: string;
  merchantRef: string;
  userId?: string | null;
  userEmail: string;
  userName?: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: 'UNPAID' | 'PAID' | 'FAILED' | 'EXPIRED';
  planId?: string | null;
  planPricingId?: string | null;
  planName?: string | null;
  durationDays?: number | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

