import { PlanItem, PlanPricingItem } from './plan.types';

export function mapPlanRow(row: any, pricingOptions: PlanPricingItem[] = []): PlanItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || null,
    badge: row.badge || null,
    accentColor: row.accentColor || '#00685f',
    features: typeof row.features === 'string' ? JSON.parse(row.features) : row.features || [],
    dashboardLimit: row.dashboardLimit != null ? Number(row.dashboardLimit) : (Boolean(row.isFree) ? 1 : null),
    templateAccessLimit: row.templateAccessLimit != null ? Number(row.templateAccessLimit) : (Boolean(row.isFree) ? 2 : null),
    isFree: Boolean(row.isFree),
    isActive: Boolean(row.isActive),
    order: Number(row.order) || 0,
    pricingOptions,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
  };
}

export function mapPricingRow(row: any): PlanPricingItem {
  return {
    id: row.id,
    planId: row.planId,
    durationLabel: row.durationLabel,
    durationDays: Number(row.durationDays),
    normalPrice: Number(row.normalPrice),
    discountPrice: row.discountPrice != null ? Number(row.discountPrice) : null,
    isBestValue: Boolean(row.isBestValue),
    isActive: Boolean(row.isActive),
    order: Number(row.order) || 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
