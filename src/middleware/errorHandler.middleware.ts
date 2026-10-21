import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const statusCode = err.statusCode || err.status || 500;
  const isProd = env.NODE_ENV === 'production';

  if (statusCode >= 500) {
    logger.error(`Unhandled error at ${req.method} ${req.originalUrl}:`, err);
  } else {
    logger.warn(`Operational client error [${statusCode}] at ${req.method} ${req.originalUrl}: ${err.message || err.code || 'Request error'}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || (statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR'),
      message: isProd && statusCode === 500
        ? 'Terjadi kesalahan internal pada server. Silakan coba beberapa saat lagi.'
        : (err.message || 'Internal Server Error'),
      details: !isProd ? err.stack : undefined,
    },
  });
}
