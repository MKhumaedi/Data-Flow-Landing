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
  isGlobalTrialActive?: boolean;
  globalTrialLabel?: string | null;
  globalTrialEndAt?: string | null;
}
