import { env } from '../config/env';

export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  error: (message: string, error?: any) => {
    const errorDetails = error instanceof Error ? { message: error.message, stack: env.NODE_ENV !== 'production' ? error.stack : undefined } : error;
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, errorDetails || '');
  },
  debug: (message: string, meta?: any) => {
    if (env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] [${new Date().toISOString()}] ${message}`, meta || '');
    }
  },
};
