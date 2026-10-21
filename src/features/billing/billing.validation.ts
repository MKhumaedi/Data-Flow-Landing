import { z } from 'zod';

export const upgradePlanSchema = z.object({
  planId: z.string().optional(),
  planPricingId: z.string().optional(),
  plan: z.string().optional(),
  billingCycle: z.string().optional(),
  paymentMethod: z.enum(['qris', 'card', 'va', 'QRIS', 'QRIS2', 'OVO', 'DANA', 'SHOPEEPAY', 'BCAVA', 'BNIVA', 'BRIVA', 'MANDIRIVA']).or(z.string()).default('qris'),
});

export const tripayCallbackSchema = z.object({
  reference: z.string().min(1, 'Reference is required'),
  merchant_ref: z.string().min(1, 'Merchant ref is required'),
  payment_method: z.string().optional().nullable(),
  payment_method_code: z.string().optional().nullable(),
  total_amount: z.coerce.number().optional().default(0),
  fee_merchant: z.coerce.number().optional().nullable(),
  fee_customer: z.coerce.number().optional().nullable(),
  total_fee: z.coerce.number().optional().nullable(),
  amount_received: z.coerce.number().optional().nullable(),
  is_closed_payment: z.coerce.number().optional().nullable(),
  status: z.enum(['PAID', 'FAILED', 'EXPIRED', 'UNPAID', 'REFUND']),
  paid_at: z.coerce.number().optional().nullable(),
  note: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_email: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  order_items: z.array(z.any()).optional(),
});

export type TripayCallbackInput = z.infer<typeof tripayCallbackSchema>;
