import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/dataflow_db?schema=public'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dataflow_jwt_access_super_secret_key_2024_x99'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dataflow_jwt_refresh_super_secret_key_2024_y88'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  TRIPAY_API_KEY: z.string().default('DEV-TRIPAY-API-KEY-PLACEHOLDER'),
  TRIPAY_PRIVATE_KEY: z.string().default('DEV-TRIPAY-PRIVATE-KEY-PLACEHOLDER'),
  TRIPAY_MERCHANT_CODE: z.string().default('DEV-M001'),
  TRIPAY_SANDBOX: z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower === 'false' || lower === '0') return false;
      if (lower === 'true' || lower === '1') return true;
    }
    if (typeof val === 'boolean') return val;
    const merchantCode = process.env.TRIPAY_MERCHANT_CODE?.trim();
    if (merchantCode && /^T\d+$/i.test(merchantCode)) {
      return false;
    }
    return true;
  }, z.boolean()).default(true),
  PEXELS_API_KEY: z.string().optional().default(''),
  // Optional: extra allowed CORS origins, comma separated (e.g. "https://app.example.com,https://staging.example.com")
  CORS_ORIGINS: z.string().optional().default(''),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.warn('⚠️ Environment warning: Using fallback defaults:', parsedEnv.error.format());
}

export const env = parsedEnv.success ? parsedEnv.data : envSchema.parse({});

// Refuse to boot in production with the built-in development JWT secrets.
if (env.NODE_ENV === 'production') {
  const defaults = envSchema.parse({});
  if (
    env.JWT_ACCESS_SECRET === defaults.JWT_ACCESS_SECRET ||
    env.JWT_REFRESH_SECRET === defaults.JWT_REFRESH_SECRET
  ) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set to strong, unique values in production.',
    );
  }
}
