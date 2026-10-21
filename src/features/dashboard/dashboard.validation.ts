import { z } from 'zod';

export const createDashboardSchema = z
  .object({
    datasetId: z.string().min(1, 'Dataset ID harus disertakan').optional().default('ds-sample-financial'),
    title: z.string().min(1, 'Judul dashboard harus diisi').max(200),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    themeId: z.string().optional(),
    templateId: z.string().optional(),
    isPublic: z.boolean().optional(),
    status: z.string().optional(),
    charts: z.array(z.any()).optional(),
    kpis: z.array(z.any()).optional(),
    filters: z.any().optional(),
    config: z.any().optional(),
    layout: z
      .object({
        kpis: z.array(z.any()).optional().default([]),
        charts: z.array(z.any()).optional().default([]),
      })
      .optional(),
  })
  .passthrough();

export const updateDashboardSchema = z
  .object({
    datasetId: z.string().optional(),
    title: z.string().min(1).max(200).optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    themeId: z.string().optional(),
    templateId: z.string().optional(),
    isPublic: z.boolean().optional(),
    status: z.string().optional(),
    charts: z.array(z.any()).optional(),
    kpis: z.array(z.any()).optional(),
    filters: z.any().optional(),
    config: z.any().optional(),
    layout: z.any().optional(),
  })
  .passthrough();

