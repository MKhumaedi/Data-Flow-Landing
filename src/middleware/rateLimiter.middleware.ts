import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore: Record<string, RateLimitRecord> = {};

export function rateLimiter(windowMs: number = 15 * 60 * 1000, max: number = 30) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const key = `${ip}_${req.baseUrl}${req.path}`;
    const now = Date.now();

    const record = memoryStore[key];

    if (!record || now > record.resetAt) {
      memoryStore[key] = {
        count: 1,
        resetAt: now + windowMs,
      };
      next();
      return;
    }

    if (record.count >= max) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Terlalu banyak permintaan. Silakan tunggu ${waitSeconds} detik sebelum mencoba lagi.`,
        },
      });
      return;
    }

    record.count += 1;
    next();
  };
}
