import { z } from 'zod';

export const planPricingSchema = z.object({
  id: z.string().optional(),
  durationLabel: z.string().min(1, 'Label durasi wajib diisi'),
  durationDays: z.coerce.number().int().positive('Jumlah hari harus bilangan bulat positif'),
  normalPrice: z.coerce.number().min(0, 'Harga normal tidak boleh negatif'),
  discountPrice: z.coerce.number().min(0).optional().nullable(),
  isBestValue: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  order: z.coerce.number().int().optional().default(0),
});

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Nama paket wajib diisi'),
  slug: z.string().optional(),
  tagline: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Format kode warna HEX tidak valid (#00685f)').optional().default('#00685f'),
  features: z.array(z.string()).default([]),
  dashboardLimit: z.coerce.number().int().min(1).optional().nullable(),
  templateAccessLimit: z.coerce.number().int().min(1).optional().nullable(),
  isFree: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  order: z.coerce.number().int().optional().default(0),
  pricingOptions: z.array(planPricingSchema).optional().default([]),
});

export const updatePlanSchema = createPlanSchema.partial();

export const createPricingSchema = planPricingSchema;
export const updatePricingSchema = planPricingSchema.partial();
