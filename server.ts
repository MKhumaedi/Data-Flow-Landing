// Entry point of the MayStudio API (standalone backend, deployable on its own).
// IMPORTANT: keep './src/config/env' as the first import so .env is loaded
// before any other module reads process.env.
import { env } from './src/config/env';
import express from 'express';
import { createApiRouter } from './src/app';
import { billingController } from './src/features/billing/billing.controller';
import { retentionService } from './src/features/dashboard/retention.service';
import { notificationExpiryService } from './src/features/notifications/notification.expiry';

const app = express();

// Behind a reverse proxy (Vercel rewrite, Cloud Run, Railway, Render, Nginx...)
app.set('trust proxy', 1);

// Periodic jobs: Free-tier/trash retention cleanup + subscription expiry reminders
retentionService.startScheduledCleanup();
notificationExpiryService.startScheduledJob();

// Root-level body parsers with raw body capture (needed for webhook signature validation)
app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  }),
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      if (!req.rawBody) {
        req.rawBody = buf.toString('utf8');
      }
    },
  }),
);

// Tripay webhook on the exact root path: https://<domain>/secret/payment/tripay
app.post('/secret/payment/tripay', (req, res, next) => {
  billingController.handleWebhook(req, res, next);
});
app.get('/secret/payment/tripay', (req, res) => {
  billingController.getWebhookInfo(req, res);
});

// Main API router, mounted on /api
app.use('/api', createApiRouter());

// Lightweight health checks (for load balancers / container platforms)
const health = (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', service: 'maystudio-api', environment: env.NODE_ENV });
};
app.get('/health', health);
app.get('/api/health', health);

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`🚀 MayStudio API running on http://0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
});

// Graceful shutdown (Docker / Cloud Run / Railway send SIGTERM on redeploy)
const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
