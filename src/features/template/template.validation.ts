import { z } from 'zod';

export const getTemplateByIdSchema = z.object({
  id: z.string().min(1, 'Template ID wajib diisi'),
});

export const updateDashboardThemeSchema = z.object({
  templateId: z.enum([
    'minimal-teal',
    'corporate-navy',
    'vibrant-sales',
    'editorial-mono',
    'executive-dark',
    'modern-analytics',
  ]),
});
