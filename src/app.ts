import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { apiRoutes } from './routes';
import { errorHandler } from './middleware/errorHandler.middleware';
import { env } from './config/env';
import { billingController } from './features/billing/billing.controller';

export function createApiRouter() {
  const apiRouter = express.Router();

  // Define allowed origins for CORS
  const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://maystudio.id',
    'https://www.maystudio.id',
    ...env.CORS_ORIGINS.split(',').map((o) => o.trim()),
  ].filter(Boolean);

  // Core Middlewares with RAW Body capturing for webhook signature validation
  apiRouter.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. same-origin, curl, server-to-server webhooks)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin matches allowed list or trusted subdomains
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.maystudio.id') ||
        origin.endsWith('.run.app') ||
        (env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1')));

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
      }
    },
    credentials: true,
  }));
  apiRouter.use(express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  }));
  apiRouter.use(express.urlencoded({ extended: true, limit: '50mb' }));
  apiRouter.use(cookieParser());

  // Health Check
  apiRouter.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'maystudio-api',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // Tripay Webhook Route (direct matching)
  apiRouter.post('/secret/payment/tripay', (req, res, next) => {
    billingController.handleWebhook(req, res, next);
  });
  apiRouter.get('/secret/payment/tripay', (req, res) => {
    billingController.getWebhookInfo(req, res);
  });

  // Feature Routes
  apiRouter.use(apiRoutes);

  // Global Error Handler
  apiRouter.use(errorHandler);

  return apiRouter;
}

export const appRouter = createApiRouter();
